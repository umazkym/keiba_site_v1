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
from scripts.agents.data_page_publication import (
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
            "projected_monthly_vcpu_seconds": 50000,
            "error_rate": 0.001,
            "p95_latency_ms": 800,
            "max_instance_saturated": False,
            "cloudflare_cache_hit_ratio": 0.9,
        })
        self.assertEqual(mode, "green")

        mode, _ = determine_capacity_mode({
            "cloud_run_metrics_available": True,
            "projected_monthly_vcpu_seconds": 50000,
            "error_rate": 0.001,
            "p95_latency_ms": 800,
            "max_instance_saturated": False,
            "cloudflare_cache_hit_ratio": None,
        })
        self.assertEqual(mode, "yellow")

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


if __name__ == "__main__":
    unittest.main()
