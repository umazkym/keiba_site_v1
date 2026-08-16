import os
import sys
import unittest
from datetime import date, datetime
from pathlib import Path
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from crud import growth_crud
from database import models
from database.database import Base
from scripts.agents.cloud_run_capacity import (
    ServiceConfig,
    aggregate_cloud_run_metrics,
    collect_cloud_run_capacity,
    parse_service_config,
)
from scripts.agents.data_page_publication import (
    DEFAULT_INITIAL_SEED_LIMIT,
    MINIMUM_PUBLICATION_QUALITY_SCORE,
    PUBLICATION_DAILY_LIMITS,
    calculate_quality_score,
    determine_capacity_mode,
    publish_candidates,
)


class DataPagePublicationTest(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine)
        self.db = sessionmaker(bind=self.engine)()
        growth_crud._cache.clear()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def test_missing_publication_is_safe_noindex(self) -> None:
        item = {
            "entity_type": "horse",
            "id": "horse-1",
            "url": "/horses/horse-1",
            "quality_eligible": True,
            "indexable": True,
        }
        result = growth_crud._apply_publication_state(self.db, [item])[0]
        self.assertTrue(result["quality_eligible"])
        self.assertEqual(result["search_publication_status"], "candidate")
        self.assertFalse(result["indexable"])

    def test_published_requires_both_quality_and_state(self) -> None:
        self.db.add(models.DataPagePublication(
            entity_type="horse",
            entity_id="horse-1",
            url="/horses/horse-1",
            status="published",
            quality_score=80,
        ))
        self.db.commit()
        valid, invalid = growth_crud._apply_publication_state(self.db, [
            {
                "entity_type": "horse",
                "id": "horse-1",
                "url": "/horses/horse-1",
                "quality_eligible": True,
            },
            {
                "entity_type": "horse",
                "id": "horse-1",
                "url": "/horses/horse-1",
                "quality_eligible": False,
            },
        ])
        self.assertTrue(valid["indexable"])
        self.assertFalse(invalid["indexable"])

    def test_quality_score_uses_sample_freshness_and_demand(self) -> None:
        score, factors = calculate_quality_score(
            {
                "entity_type": "horse",
                "id": "horse-1",
                "name": "確認馬",
                "url": "/horses/horse-1",
                "sample_size": 15,
                "last_race_date": date(2026, 8, 1),
            },
            dataset_last=date(2026, 8, 4),
            demand={"clicks": 1, "impressions": 20},
        )
        self.assertEqual(score, 100)
        self.assertEqual(factors["sample_points"], 40)
        self.assertEqual(factors["freshness_points"], 30)
        self.assertEqual(factors["demand_points"], 20)

    def test_capacity_modes_and_fail_closed(self) -> None:
        mode, _ = determine_capacity_mode({"cloud_run_metrics_available": False})
        self.assertEqual(mode, "red")

        mode, _ = determine_capacity_mode({
            "cloud_run_metrics_available": True,
            "db_network_metrics_available": True,
            "db_sent_gib_24h": 0.1,
            "db_sent_gib_7d": 0.7,
            "projected_monthly_vcpu_seconds": 50000,
            "error_rate": 0.001,
            "p95_latency_ms": 800,
            "max_instance_saturated": False,
            "cloudflare_cache_hit_ratio": 0.9,
        })
        self.assertEqual(mode, "green")

        mode, _ = determine_capacity_mode({
            "cloud_run_metrics_available": True,
            "db_network_metrics_available": True,
            "db_sent_gib_24h": 0.1,
            "db_sent_gib_7d": 0.7,
            "projected_monthly_vcpu_seconds": 50000,
            "error_rate": 0.001,
            "p95_latency_ms": 800,
            "max_instance_saturated": False,
            "cloudflare_cache_hit_ratio": None,
        })
        self.assertEqual(mode, "yellow")

    def test_capacity_mode_uses_all_free_tier_dimensions(self) -> None:
        base = {
            "cloud_run_metrics_available": True,
            "db_network_metrics_available": True,
            "db_sent_gib_24h": 0.1,
            "db_sent_gib_7d": 0.7,
            "projected_monthly_vcpu_seconds": 50000,
            "projected_monthly_gib_seconds": 100000,
            "projected_monthly_requests": 500000,
            "projected_monthly_internet_egress_bytes": 1024 ** 3,
            "error_rate": 0.001,
            "p95_latency_ms": 800,
            "max_instance_saturated": False,
            "cloudflare_cache_hit_ratio": 0.9,
        }
        mode, _ = determine_capacity_mode(base)
        self.assertEqual(mode, "green")

        memory_red = {**base, "projected_monthly_gib_seconds": 240000}
        mode, reasons = determine_capacity_mode(memory_red)
        self.assertEqual(mode, "red")
        self.assertTrue(any("GiB秒" in reason for reason in reasons))

        request_red = {**base, "projected_monthly_requests": 1400000}
        mode, reasons = determine_capacity_mode(request_red)
        self.assertEqual(mode, "red")
        self.assertTrue(any("リクエスト" in reason for reason in reasons))

        egress_red = {
            **base,
            "projected_monthly_internet_egress_bytes": 10 * 1024 ** 3,
        }
        mode, reasons = determine_capacity_mode(egress_red)
        self.assertEqual(mode, "red")
        self.assertTrue(any("送信量" in reason for reason in reasons))

        db_warning = {**base, "db_sent_gib_24h": 0.5}
        mode, reasons = determine_capacity_mode(db_warning)
        self.assertEqual(mode, "yellow")
        self.assertTrue(any("DB送信量" in reason for reason in reasons))

        db_red = {**base, "db_sent_gib_24h": 2.0}
        mode, reasons = determine_capacity_mode(db_red)
        self.assertEqual(mode, "red")
        self.assertTrue(any("24時間" in reason for reason in reasons))

        db_week_red = {**base, "db_sent_gib_7d": 10.0}
        mode, reasons = determine_capacity_mode(db_week_red)
        self.assertEqual(mode, "red")
        self.assertTrue(any("7日" in reason for reason in reasons))

    def test_initial_seed_stops_when_capacity_is_red(self) -> None:
        rows = []
        for index in range(12):
            row = models.DataPagePublication(
                entity_type="course" if index < 2 else "horse",
                entity_id=f"entity-{index}",
                url=f"/entities/{index}",
                status="candidate",
                quality_score=80 - index,
                score_factors={},
                first_eligible_at=datetime(2026, 8, 4),
                last_evaluated_at=datetime(2026, 8, 4),
            )
            self.db.add(row)
            rows.append(row)
        self.db.flush()

        published, initial = publish_candidates(
            self.db,
            candidates=rows,
            capacity_mode="red",
            evaluated_at=datetime(2026, 8, 4),
            initial_seed_limit=5,
        )
        self.assertTrue(initial)
        self.assertEqual(len(published), 0)

    def test_initial_seed_is_bounded_and_later_red_publishes_nothing(self) -> None:
        rows = []
        for index in range(12):
            row = models.DataPagePublication(
                entity_type="course" if index < 2 else "horse",
                entity_id=f"entity-seed-{index}",
                url=f"/entities/seed-{index}",
                status="candidate",
                quality_score=80 - index,
                score_factors={},
                first_eligible_at=datetime(2026, 8, 4),
                last_evaluated_at=datetime(2026, 8, 4),
            )
            self.db.add(row)
            rows.append(row)
        self.db.flush()

        published, initial = publish_candidates(
            self.db,
            candidates=rows,
            capacity_mode="yellow",
            evaluated_at=datetime(2026, 8, 4),
            initial_seed_limit=5,
        )
        self.assertTrue(initial)
        self.assertEqual(len(published), 5)
        self.db.commit()

        extra = models.DataPagePublication(
            entity_type="horse",
            entity_id="extra",
            url="/entities/extra",
            status="candidate",
            quality_score=99,
            score_factors={},
            first_eligible_at=datetime(2026, 8, 5),
            last_evaluated_at=datetime(2026, 8, 5),
        )
        self.db.add(extra)
        self.db.flush()
        second, second_initial = publish_candidates(
            self.db,
            candidates=[extra],
            capacity_mode="red",
            evaluated_at=datetime(2026, 8, 5),
        )
        self.assertFalse(second_initial)
        self.assertEqual(second, [])

    def test_daily_limits_are_small_batch(self) -> None:
        """データ詳細ページは少数精選で公開する。

        2026-08-16の実測で、公開59ページの収益寄与は全体の0.3%にとどまる一方、
        DB転送とCPUの大半を消費し、GSCのnoindex除外6,018件の主因にもなっていた。
        green100件/日に戻すと同じ問題が再発するため、上限を固定して守る。
        """
        self.assertEqual(PUBLICATION_DAILY_LIMITS["green"], 10)
        self.assertEqual(PUBLICATION_DAILY_LIMITS["yellow"], 3)
        self.assertEqual(PUBLICATION_DAILY_LIMITS["red"], 0)
        self.assertEqual(DEFAULT_INITIAL_SEED_LIMIT, 50)

        rows = []
        for index in range(30):
            row = models.DataPagePublication(
                entity_type="horse",
                entity_id=f"entity-daily-{index}",
                url=f"/entities/daily-{index}",
                status="candidate",
                quality_score=90,
                score_factors={},
                first_eligible_at=datetime(2026, 8, 16),
                last_evaluated_at=datetime(2026, 8, 16),
            )
            self.db.add(row)
            rows.append(row)
        # 初回シード扱いを避けるため、既に公開済みの行を1つ用意する。
        seeded = models.DataPagePublication(
            entity_type="course",
            entity_id="already-published",
            url="/courses/already-published",
            status="published",
            quality_score=90,
            score_factors={},
            first_eligible_at=datetime(2026, 8, 15),
            last_evaluated_at=datetime(2026, 8, 15),
        )
        self.db.add(seeded)
        self.db.flush()

        published, initial = publish_candidates(
            self.db,
            candidates=rows,
            capacity_mode="green",
            evaluated_at=datetime(2026, 8, 16),
        )
        self.assertFalse(initial)
        self.assertEqual(len(published), 10)

    def test_publication_requires_high_quality_score(self) -> None:
        """品質スコアが65未満の候補は公開しない。"""
        self.assertEqual(MINIMUM_PUBLICATION_QUALITY_SCORE, 65)

        seeded = models.DataPagePublication(
            entity_type="course",
            entity_id="seeded-course",
            url="/courses/seeded",
            status="published",
            quality_score=90,
            score_factors={},
            first_eligible_at=datetime(2026, 8, 15),
            last_evaluated_at=datetime(2026, 8, 15),
        )
        below = models.DataPagePublication(
            entity_type="horse",
            entity_id="below-threshold",
            url="/horses/below-threshold",
            status="candidate",
            quality_score=64,
            score_factors={},
            first_eligible_at=datetime(2026, 8, 16),
            last_evaluated_at=datetime(2026, 8, 16),
        )
        at_threshold = models.DataPagePublication(
            entity_type="horse",
            entity_id="at-threshold",
            url="/horses/at-threshold",
            status="candidate",
            quality_score=65,
            score_factors={},
            first_eligible_at=datetime(2026, 8, 16),
            last_evaluated_at=datetime(2026, 8, 16),
        )
        self.db.add_all([seeded, below, at_threshold])
        self.db.flush()

        published, _ = publish_candidates(
            self.db,
            candidates=[below, at_threshold],
            capacity_mode="green",
            evaluated_at=datetime(2026, 8, 16),
        )
        self.assertEqual([row.entity_id for row in published], ["at-threshold"])

    def test_sitemap_is_stably_sharded(self) -> None:
        entries = [
            {
                "url": f"/horses/{index:04d}",
                "entity_type": "horse",
                "last_modified": date(2026, 8, 1),
            }
            for index in range(1001)
        ]
        with patch.object(growth_crud, "get_data_sitemap", return_value=entries):
            manifest = growth_crud.get_data_sitemap_manifest(self.db, shard_size=1000)
            second = growth_crud.get_data_sitemap_shard(
                self.db,
                "horse",
                2,
                shard_size=1000,
            )
        self.assertEqual([item["count"] for item in manifest], [1000, 1])
        self.assertEqual(second[0]["url"], "/horses/1000")


class CloudRunCapacityTest(unittest.TestCase):
    def test_parse_repeated_service_config_shape(self) -> None:
        config = parse_service_config("keiba-site-v1,1,0.5,3")
        self.assertEqual(config.service_name, "keiba-site-v1")
        self.assertEqual(config.cpu, 1.0)
        self.assertEqual(config.memory_gib, 0.5)
        self.assertEqual(config.max_instances, 3)

    def test_aggregate_cloud_run_metrics_preserves_legacy_totals(self) -> None:
        aggregate = aggregate_cloud_run_metrics([
            {
                "service_name": "keiba-frontend-v1",
                "cloud_run_metrics_available": True,
                "billable_instance_seconds_7d": 7000,
                "projected_monthly_vcpu_seconds": 30000,
                "projected_monthly_gib_seconds": 30000,
                "request_count_7d": 70000,
                "projected_monthly_requests": 300000,
                "error_count_7d": 70,
                "error_rate": 0.001,
                "p95_latency_ms": 900,
                "max_active_instances": 1,
                "max_instance_saturated": False,
                "internet_egress_bytes_7d": 100,
                "projected_monthly_internet_egress_bytes": 430,
                "window_start": "2026-07-28T00:00:00+00:00",
                "window_end": "2026-08-04T00:00:00+00:00",
            },
            {
                "service_name": "keiba-site-v1",
                "cloud_run_metrics_available": True,
                "billable_instance_seconds_7d": 3500,
                "projected_monthly_vcpu_seconds": 15000,
                "projected_monthly_gib_seconds": 7500,
                "request_count_7d": 35000,
                "projected_monthly_requests": 150000,
                "error_count_7d": 35,
                "error_rate": 0.001,
                "p95_latency_ms": 1200,
                "max_active_instances": 3,
                "max_instance_saturated": True,
                "internet_egress_bytes_7d": 200,
                "projected_monthly_internet_egress_bytes": 860,
                "window_start": "2026-07-28T00:00:00+00:00",
                "window_end": "2026-08-04T00:00:00+00:00",
            },
        ])
        self.assertEqual(aggregate["schema_version"], "cloud-run-capacity.v3")
        self.assertTrue(aggregate["cloud_run_metrics_available"])
        self.assertEqual(aggregate["projected_monthly_vcpu_seconds"], 45000)
        self.assertEqual(aggregate["projected_monthly_gib_seconds"], 37500)
        self.assertEqual(aggregate["projected_monthly_requests"], 450000)
        self.assertEqual(aggregate["error_rate"], 0.001)
        self.assertEqual(aggregate["p95_latency_ms"], 1200)
        self.assertTrue(aggregate["max_instance_saturated"])
        self.assertEqual(aggregate["saturated_services"], ["keiba-site-v1"])

    def test_one_missing_service_fails_closed_but_keeps_other_metrics(self) -> None:
        configs = [
            ServiceConfig("keiba-frontend-v1", 1, 1, 2),
            ServiceConfig("keiba-site-v1", 1, 0.5, 3),
        ]

        def fake_collect(*, service_config, **_kwargs):
            if service_config.service_name == "keiba-site-v1":
                raise RuntimeError("monitoring unavailable")
            return {
                "service_name": service_config.service_name,
                "cloud_run_metrics_available": True,
                "projected_monthly_vcpu_seconds": 100,
                "request_count_7d": 10,
                "window_start": "2026-07-28T00:00:00+00:00",
                "window_end": "2026-08-04T00:00:00+00:00",
            }

        with patch(
            "scripts.agents.cloud_run_capacity.collect_cloud_run_metrics",
            side_effect=fake_collect,
        ):
            result = collect_cloud_run_capacity(
                project_id="keiba-api-project",
                service_configs=configs,
            )
        self.assertFalse(result["cloud_run_metrics_available"])
        self.assertEqual(result["projected_monthly_vcpu_seconds"], 100)
        self.assertIn("keiba-site-v1", result["cloud_run_errors"])


if __name__ == "__main__":
    unittest.main()
