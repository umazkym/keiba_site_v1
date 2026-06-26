import importlib
import json
import os
import sys
import unittest
from datetime import date
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from database import models
from database.database import Base


class ApiCostOptimizationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        main_module = importlib.import_module("main")
        cls.client = TestClient(main_module.app)

    def setUp(self) -> None:
        from crud import race_crud

        race_crud._predictions_cache.clear()

    def test_grade_detection_does_not_treat_generic_two_year_old_race_as_grade(self) -> None:
        from crud import race_crud

        self.assertEqual(race_crud._detect_grade("2歳", "地方"), "")
        self.assertEqual(race_crud._detect_grade("２歳", "地方"), "")
        self.assertEqual(race_crud._detect_grade("2歳", "中央"), "")
        self.assertEqual(race_crud._detect_grade("金沢サマーカップ重賞", "地方"), "地方重賞")
        self.assertEqual(race_crud._detect_grade("サファイア賞重賞", "地方"), "地方重賞")
        self.assertEqual(race_crud._detect_grade("帝王賞Jpn1", "地方"), "Jpn1")
        self.assertEqual(race_crud._detect_grade("ラジオNIKKEI賞", "中央"), "G3")
        self.assertEqual(race_crud._detect_grade("函館記念", "中央"), "G3")
        self.assertEqual(race_crud._detect_grade("京王杯2歳S", "中央"), "G2")

    def test_large_response_is_gzip_encoded(self) -> None:
        response = self.client.get(
            "/",
            headers={"Accept-Encoding": "gzip"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertNotEqual(response.headers.get("content-encoding"), "gzip")

        @self.client.app.get("/__test_large_response")
        def test_large_response():
            return {"payload": "競馬データ" * 1000}

        response = self.client.get(
            "/__test_large_response",
            headers={"Accept-Encoding": "gzip"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("content-encoding"), "gzip")
        self.assertIn("Accept-Encoding", response.headers.get("vary", ""))
        self.assertEqual(
            response.json(),
            {"payload": "競馬データ" * 1000},
        )

    def test_prediction_query_preserves_response_structure(self) -> None:
        from crud import race_crud

        engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
        )
        Base.metadata.create_all(bind=engine)
        session_factory = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=engine,
        )
        db = session_factory()

        try:
            target_date = date(2026, 6, 20)
            race = models.Race(
                id="202606200101",
                race_date=target_date,
                venue_name="東京",
                race_number=1,
                race_name="確認用レース",
                race_type="中央",
                course_type="芝",
                distance=1600,
            )
            horse_one = models.Horse(id="horse-1", name="確認馬一")
            horse_two = models.Horse(id="horse-2", name="確認馬二")
            db.add_all([race, horse_one, horse_two])
            db.flush()

            db.add_all(
                [
                    models.Prediction(
                        race_id=race.id,
                        horse_id=horse_one.id,
                        horse_name=horse_one.name,
                        horse_number=1,
                        waku_number=1,
                        deviation_score=65.0,
                        mark="◎",
                    ),
                    models.Prediction(
                        race_id=race.id,
                        horse_id=horse_two.id,
                        horse_name=horse_two.name,
                        horse_number=2,
                        waku_number=2,
                        deviation_score=60.0,
                        mark="○",
                    ),
                    models.Result(
                        race_id=race.id,
                        horse_id=horse_one.id,
                        horse_number=1,
                        rank=1,
                    ),
                    models.Result(
                        race_id=race.id,
                        horse_id=horse_two.id,
                        horse_number=2,
                        rank=2,
                    ),
                    models.HorseNumberAdvantage(
                        venue_name="東京",
                        course_type="芝",
                        distance=1600,
                        horse_number=1,
                        advantage_score=0.2,
                    ),
                ]
            )
            db.commit()

            result = race_crud.get_predictions_by_date(
                db=db,
                target_date=target_date,
            )

            self.assertEqual(len(result["jra"]), 1)
            self.assertEqual(result["nar"], [])
            returned_race = result["jra"][0]["races"][0]
            self.assertEqual(returned_race["id"], race.id)
            self.assertEqual(
                [item["horse_name"] for item in returned_race["predictions"]],
                ["確認馬一", "確認馬二"],
            )
            self.assertEqual(
                [item["horse_name"] for item in returned_race["results"]],
                ["確認馬一", "確認馬二"],
            )
            self.assertEqual(
                returned_race["horse_number_advantages"],
                [{"horse_number": 1, "advantage_score": 0.2}],
            )
            self.assertIsNone(returned_race["matchup"])

            json.dumps(result, ensure_ascii=False, default=str)
        finally:
            db.close()
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
