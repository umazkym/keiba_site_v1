import os
import sys
import unittest
from datetime import date
from pathlib import Path

from pydantic import ValidationError
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from crud import growth_crud
from database import models
from database.database import Base
from schemas import growth_schema
from scripts.agents.data_value_quality_audit import run_audit


class GrowthDataApiTest(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=self.engine)
        self.db = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)()
        growth_crud._cache.clear()
        self._seed()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def _seed(self) -> None:
        horses = [
            models.Horse(id=f"horse-{index}", name=f"確認馬{index}", sex="牡", age=4)
            for index in range(1, 7)
        ]
        jockey = models.Jockey(id="jockey-1", name="確認騎手")
        trainer = models.Trainer(id="trainer-1", name="愛知錦見勇夫")
        races = [
            models.Race(
                id="202606010511",
                race_date=date(2026, 6, 1),
                venue_name="東京",
                race_number=11,
                race_name="確認ステークス",
                race_type="中央",
                course_type="芝",
                distance=1600,
                ground_condition="良",
                total_horses=6,
            ),
            models.Race(
                id="202606080511",
                race_date=date(2026, 6, 8),
                venue_name="東京",
                race_number=11,
                race_name="確認ステークスG3",
                race_type="中央",
                course_type="芝",
                distance=1600,
                ground_condition="稍重",
                total_horses=6,
            ),
            models.Race(
                id="202606150511",
                race_date=date(2026, 6, 15),
                venue_name="東京",
                race_number=11,
                race_name="次回確認レース",
                race_type="中央",
                course_type="芝",
                distance=1600,
                ground_condition="良",
                total_horses=2,
            ),
        ]
        self.db.add_all([*horses, jockey, trainer, *races])
        self.db.flush()

        for race_index, race in enumerate(races[:2]):
            for horse_index, horse in enumerate(horses, start=1):
                rank = ((horse_index + race_index - 1) % len(horses)) + 1
                self.db.add(models.Result(
                    race_id=race.id,
                    horse_id=horse.id,
                    jockey_id=jockey.id,
                    trainer_id=trainer.id,
                    rank=rank,
                    waku_number=min(horse_index, 6),
                    horse_number=horse_index,
                    popularity=horse_index,
                    odds=float(horse_index * 2),
                    horse_weight=470 + horse_index,
                    horse_weight_diff=horse_index - 3,
                    agari_3f=34.0 + horse_index / 10,
                    corner_positions=[horse_index, horse_index, horse_index],
                ))
                self.db.add(models.Prediction(
                    race_id=race.id,
                    horse_id=horse.id,
                    horse_name=horse.name,
                    horse_number=horse_index,
                    waku_number=min(horse_index, 6),
                    deviation_score=70.0 - horse_index,
                    mark="◎" if horse_index == 1 else "",
                ))

        for horse_index, horse in enumerate(horses[:2], start=1):
            self.db.add(models.Result(
                race_id=races[2].id,
                horse_id=horse.id,
                jockey_id=jockey.id,
                trainer_id=trainer.id,
                rank=None,
                horse_number=horse_index,
                waku_number=horse_index,
            ))
            self.db.add(models.Prediction(
                race_id=races[2].id,
                horse_id=horse.id,
                horse_name=horse.name,
                horse_number=horse_index,
                waku_number=horse_index,
                deviation_score=65.0 - horse_index,
                mark="◎" if horse_index == 1 else "○",
            ))
        self.db.commit()

    def test_summary_and_search_are_schema_valid(self) -> None:
        summary = growth_crud.get_growth_summary(self.db)
        validated = growth_schema.GrowthSummaryResponse.model_validate(summary)
        self.assertEqual(validated.counts.races, 3)
        self.assertEqual(validated.counts.horses, 6)

        search = growth_crud.search_entities(self.db, "確認馬1", limit=10)
        validated_search = growth_schema.SearchResponse.model_validate(search)
        self.assertEqual(validated_search.items[0].entity_type, "horse")
        self.assertEqual(validated_search.items[0].name, "確認馬1")

    def test_horse_detail_contains_runs_upcoming_and_prediction_history(self) -> None:
        detail = growth_crud.get_entity_detail(self.db, "horse", "horse-1")
        self.assertIsNotNone(detail)
        validated = growth_schema.EntityDetailResponse.model_validate(detail)
        self.assertEqual(validated.entity.name, "確認馬1")
        self.assertEqual(validated.overall.sample_size, 2)
        self.assertEqual(len(validated.recent_runs), 2)
        self.assertEqual(len(validated.upcoming_races), 1)
        self.assertEqual(len(validated.prediction_history), 3)

    def test_course_detail_and_race_features_are_schema_valid(self) -> None:
        directory = growth_crud.list_entities(
            self.db,
            "course",
            limit=100,
            indexable_only=False,
        )
        validated_directory = growth_schema.EntityDirectoryResponse.model_validate(directory)
        self.assertEqual(validated_directory.items[0].venue_name, "東京")
        self.assertEqual(validated_directory.items[0].course_type, "芝")
        self.assertEqual(validated_directory.items[0].distance, 1600)
        self.assertEqual(validated_directory.items[0].race_count, 2)

        course = growth_crud.get_course_detail(self.db, "tokyo", "turf-1600m")
        self.assertIsNotNone(course)
        validated_course = growth_schema.CourseDetailResponse.model_validate(course)
        self.assertEqual(validated_course.venue_name, "東京")
        self.assertEqual(validated_course.overall.sample_size, 12)

        features = growth_crud.get_race_features(self.db, "202606150511")
        self.assertIsNotNone(features)
        validated_features = growth_schema.RaceFeatureResponse.model_validate(features)
        self.assertEqual(len(validated_features.runners), 2)
        self.assertEqual(validated_features.runners[0].horse_overall.sample_size, 2)
        self.assertEqual(validated_features.runners[0].horse_condition.sample_size, 2)

    def test_directory_runs_the_group_by_aggregation_only_once(self) -> None:
        # 以前は total を query.count() で別に取っていたため、GROUP BY + HAVING の
        # 全件集計が1リクエストで2回走り、本番で10秒級の応答になっていた。
        # count() OVER () へ寄せた結果、集計は1回だけになる。
        for entity_type in ("course", "horse"):
            with self.subTest(entity_type=entity_type):
                growth_crud._cache.clear()
                statements = []

                def _record(conn, cursor, statement, parameters, context, executemany):
                    statements.append(statement)

                event.listen(self.engine, "before_cursor_execute", _record)
                try:
                    growth_crud.list_entities(
                        self.db,
                        entity_type,
                        limit=10,
                        offset=0,
                        indexable_only=False,
                    )
                finally:
                    event.remove(self.engine, "before_cursor_execute", _record)

                grouped = [sql for sql in statements if "GROUP BY" in sql.upper()]
                self.assertEqual(
                    len(grouped),
                    1,
                    f"GROUP BYを含むSQLが{len(grouped)}本発行された: {grouped}",
                )
                self.assertIn("OVER (", grouped[0].upper())

    def test_directory_total_is_consistent_across_pages(self) -> None:
        # totalは count() OVER () で1回の集計から取り出している。
        # ページを切っても総数が変わらないこと、offsetが末尾を超えたときに
        # count()へ退避しても同じ総数になることを確認する。
        for entity_type in ("course", "horse", "jockey", "trainer"):
            with self.subTest(entity_type=entity_type):
                full = growth_crud.list_entities(
                    self.db,
                    entity_type,
                    limit=5000,
                    offset=0,
                    indexable_only=False,
                )
                expected_total = full["total"]
                self.assertEqual(len(full["items"]), expected_total)

                first_page = growth_crud.list_entities(
                    self.db,
                    entity_type,
                    limit=1,
                    offset=0,
                    indexable_only=False,
                )
                self.assertEqual(first_page["total"], expected_total)
                self.assertLessEqual(len(first_page["items"]), 1)

                beyond = growth_crud.list_entities(
                    self.db,
                    entity_type,
                    limit=10,
                    offset=expected_total + 50,
                    indexable_only=False,
                )
                self.assertEqual(beyond["total"], expected_total)
                self.assertEqual(beyond["items"], [])

    def test_horse_comparison_matches_conditions_and_preserves_input_order(self) -> None:
        comparison = growth_crud.get_horse_comparison(
            self.db,
            ["horse-2", "horse-1"],
            venue_name="東京競馬場",
            course_type="芝",
            distance=1600,
        )
        self.assertIsNotNone(comparison)
        validated = growth_schema.HorseComparisonResponse.model_validate(comparison)
        self.assertEqual([item.horse_id for item in validated.horses], ["horse-2", "horse-1"])
        self.assertEqual(validated.conditions.venue_name, "東京")
        self.assertEqual(validated.data_as_of_date, date(2026, 6, 15))
        self.assertEqual(validated.horses[0].overall.sample_size, 2)
        self.assertEqual(validated.horses[0].matched_condition.sample_size, 2)
        self.assertEqual(validated.horses[0].sample_quality, "insufficient")
        self.assertIsNone(validated.horses[0].wilson_lower_bound)
        self.assertEqual(len(validated.horses[0].recent_runs), 2)

        good_only = growth_crud.get_horse_comparison(
            self.db,
            ["horse-1", "horse-2"],
            venue_name="東京",
            course_type="芝",
            distance=1600,
            ground_condition="良",
        )
        self.assertIsNotNone(good_only)
        validated_good = growth_schema.HorseComparisonResponse.model_validate(good_only)
        self.assertEqual(validated_good.horses[0].matched_condition.sample_size, 1)
        self.assertEqual(validated_good.conditions.ground_condition, "良")

    def test_horse_comparison_request_enforces_two_to_five_unique_horses(self) -> None:
        common = {
            "venue_name": "東京",
            "course_type": "芝",
            "distance": 1600,
        }
        two = growth_schema.HorseComparisonRequest(
            horse_ids=["horse-1", "horse-2"],
            **common,
        )
        five = growth_schema.HorseComparisonRequest(
            horse_ids=[f"horse-{index}" for index in range(1, 6)],
            **common,
        )
        self.assertEqual(len(two.horse_ids), 2)
        self.assertEqual(len(five.horse_ids), 5)

        for invalid_ids in (
            ["horse-1"],
            [f"horse-{index}" for index in range(1, 7)],
            ["horse-1", "horse-1"],
        ):
            with self.assertRaises(ValidationError):
                growth_schema.HorseComparisonRequest(
                    horse_ids=invalid_ids,
                    **common,
                )

    def test_sample_quality_and_wilson_lower_bound(self) -> None:
        self.assertEqual(growth_crud._sample_quality(4), "insufficient")
        self.assertEqual(growth_crud._sample_quality(5), "reference")
        self.assertEqual(growth_crud._sample_quality(9), "reference")
        self.assertEqual(growth_crud._sample_quality(10), "comparable")
        self.assertIsNone(growth_crud._wilson_lower_bound(0, 0))
        self.assertAlmostEqual(
            growth_crud._wilson_lower_bound(6, 10) or 0,
            31.27,
            places=2,
        )

    def test_horse_comparison_returns_none_when_any_horse_is_missing(self) -> None:
        comparison = growth_crud.get_horse_comparison(
            self.db,
            ["horse-1", "missing-horse"],
            venue_name="東京",
            course_type="芝",
            distance=1600,
        )
        self.assertIsNone(comparison)

    def test_data_value_quality_audit_is_read_only_and_schema_stable(self) -> None:
        report = run_audit(self.db, today=date(2026, 6, 16))
        self.assertEqual(report["status"], "ok")
        self.assertEqual(report["counts"]["races"], 3)
        self.assertEqual(report["anomalies"]["invalid_rank_count"], 0)
        self.assertTrue(report["approval_required"]["data_repair"])

    def test_trainer_affiliation_is_separated_from_name(self) -> None:
        detail = growth_crud.get_entity_detail(self.db, "trainer", "trainer-1")
        self.assertIsNotNone(detail)
        validated = growth_schema.EntityDetailResponse.model_validate(detail)
        self.assertEqual(validated.entity.name, "錦見勇夫")
        self.assertEqual(validated.entity.affiliation, "愛知")

        search = growth_crud.search_entities(self.db, "錦見", limit=10)
        validated_search = growth_schema.SearchResponse.model_validate(search)
        trainer_result = next(
            item for item in validated_search.items if item.entity_type == "trainer"
        )
        self.assertEqual(trainer_result.name, "錦見勇夫")
        self.assertEqual(trainer_result.affiliation, "愛知")

    def test_obihiro_course_accepts_200_metres(self) -> None:
        parsed = growth_crud._parse_course("obihiro", "dirt-200m")
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed[2], 200)

    def test_race_series_matches_normalized_name(self) -> None:
        series = growth_crud.get_race_series(self.db, "確認ステークス")
        self.assertIsNotNone(series)
        validated = growth_schema.RaceSeriesResponse.model_validate(series)
        self.assertEqual(validated.sample_size, 2)
        self.assertEqual(validated.history[0].winner_name, "確認馬6")


if __name__ == "__main__":
    unittest.main()
