import os
import sys
import unittest
from datetime import date
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from crud import growth_crud
from database import models
from database.database import Base
from schemas import growth_schema


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
