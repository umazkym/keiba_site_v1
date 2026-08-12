import importlib
import json
import os
import sys
import unittest
from datetime import date
from pathlib import Path

from fastapi.testclient import TestClient
from fastapi import HTTPException
from fastapi.responses import Response
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
        race_crud._article_preview_cache.clear()
        race_crud._race_detail_cache.clear()

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

    def test_prediction_detail_returns_only_selected_race_and_published_links(self) -> None:
        from crud import race_crud

        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=engine)
        db = sessionmaker(autocommit=False, autoflush=False, bind=engine)()
        target_date = date(2026, 6, 20)
        try:
            races = [
                models.Race(
                    id="202606200101",
                    race_date=target_date,
                    venue_name="東京",
                    race_number=1,
                    race_name="確認用1R",
                    race_type="中央",
                    course_type="芝",
                    distance=1600,
                ),
                models.Race(
                    id="202606200102",
                    race_date=target_date,
                    venue_name="東京",
                    race_number=2,
                    race_name="確認用2R",
                    race_type="中央",
                    course_type="芝",
                    distance=1800,
                ),
                models.Race(
                    id="202606203501",
                    race_date=target_date,
                    venue_name="盛岡",
                    race_number=1,
                    race_name="別会場1R",
                    race_type="地方",
                    course_type="ダート",
                    distance=1200,
                ),
            ]
            horses = [
                models.Horse(id="horse-published", name="公開馬"),
                models.Horse(id="horse-candidate", name="候補馬"),
                models.Horse(id="horse-other", name="別レース馬"),
            ]
            db.add_all([*races, *horses])
            db.flush()
            db.add_all([
                models.Prediction(
                    race_id=races[0].id,
                    horse_id=horses[0].id,
                    horse_name=horses[0].name,
                    horse_number=1,
                    deviation_score=65.0,
                    mark="◎",
                ),
                models.Prediction(
                    race_id=races[0].id,
                    horse_id=horses[1].id,
                    horse_name=horses[1].name,
                    horse_number=2,
                    deviation_score=60.0,
                    mark="○",
                ),
                models.Prediction(
                    race_id=races[1].id,
                    horse_id=horses[2].id,
                    horse_name=horses[2].name,
                    horse_number=1,
                    deviation_score=55.0,
                    mark="▲",
                ),
                models.DataPagePublication(
                    entity_type="horse",
                    entity_id=horses[0].id,
                    url=f"/horses/{horses[0].id}",
                    status="published",
                    quality_score=90,
                ),
                models.DataPagePublication(
                    entity_type="horse",
                    entity_id=horses[1].id,
                    url=f"/horses/{horses[1].id}",
                    status="candidate",
                    quality_score=90,
                ),
            ])
            db.commit()

            result = race_crud.get_prediction_detail(db, target_date, "tokyo", 1)

            self.assertIsNotNone(result)
            self.assertEqual(result["race"]["id"], races[0].id)
            self.assertEqual(result["race_numbers"], [1, 2])
            self.assertEqual(result["venue_name"], "東京")
            self.assertEqual(
                [item["detail_page_indexable"] for item in result["race"]["predictions"]],
                [True, False],
            )
            self.assertNotIn(horses[2].name, json.dumps(result, ensure_ascii=False, default=str))
        finally:
            db.close()
            engine.dispose()

    def test_prediction_detail_not_found_is_no_store(self) -> None:
        from api.v1.endpoints.races import read_prediction_detail

        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=engine)
        db = sessionmaker(autocommit=False, autoflush=False, bind=engine)()
        response = Response()
        try:
            with self.assertRaises(HTTPException) as context:
                read_prediction_detail(
                    target_date=date(2026, 6, 20),
                    venue_slug="unknown",
                    response=response,
                    race_number=1,
                    db=db,
                )
            self.assertEqual(context.exception.status_code, 404)
            self.assertEqual(response.headers.get("Cache-Control"), "no-store")
        finally:
            db.close()
            engine.dispose()

    def test_race_features_only_marks_published_entity_links(self) -> None:
        from crud import growth_crud

        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=engine)
        db = sessionmaker(autocommit=False, autoflush=False, bind=engine)()
        try:
            race = models.Race(
                id="202606200105",
                race_date=date(2026, 6, 20),
                venue_name="東京",
                race_number=5,
                race_name="公開状態確認レース",
                race_type="中央",
                course_type="芝",
                distance=1600,
            )
            horse = models.Horse(id="horse-feature", name="確認馬")
            jockey = models.Jockey(id="jockey-feature", name="確認騎手")
            trainer = models.Trainer(id="trainer-feature", name="確認調教師")
            db.add_all([race, horse, jockey, trainer])
            db.flush()
            db.add_all([
                models.Result(
                    race_id=race.id,
                    horse_id=horse.id,
                    jockey_id=jockey.id,
                    trainer_id=trainer.id,
                    horse_number=1,
                    rank=1,
                ),
                models.Prediction(
                    race_id=race.id,
                    horse_id=horse.id,
                    horse_name=horse.name,
                    horse_number=1,
                    deviation_score=65.0,
                    mark="◎",
                ),
                models.DataPagePublication(
                    entity_type="horse",
                    entity_id=horse.id,
                    url=f"/horses/{horse.id}",
                    status="published",
                    quality_score=90,
                ),
                models.DataPagePublication(
                    entity_type="jockey",
                    entity_id=jockey.id,
                    url=f"/jockeys/data/{jockey.id}",
                    status="candidate",
                    quality_score=90,
                ),
                models.DataPagePublication(
                    entity_type="trainer",
                    entity_id=trainer.id,
                    url=f"/trainers/{trainer.id}",
                    status="published",
                    quality_score=90,
                ),
            ])
            db.commit()
            growth_crud._cache.clear()

            result = growth_crud.get_race_features(db, race.id)

            self.assertIsNotNone(result)
            runner = result["runners"][0]
            self.assertTrue(runner["horse_detail_page_indexable"])
            self.assertFalse(runner["jockey_detail_page_indexable"])
            self.assertTrue(runner["trainer_detail_page_indexable"])
        finally:
            db.close()
            engine.dispose()

    def test_article_preview_requires_unique_exact_name_and_predictions(self) -> None:
        from crud import race_crud

        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=engine)
        db = sessionmaker(autocommit=False, autoflush=False, bind=engine)()
        target_date = date(2026, 7, 20)
        try:
            race = models.Race(
                id="202607203512",
                race_date=target_date,
                venue_name="盛岡",
                race_number=12,
                race_name="マーキュリーカップJpn3",
                race_type="地方",
                course_type="ダ",
                distance=2000,
            )
            db.add(race)
            db.flush()
            db.add_all([
                models.Prediction(
                    race_id=race.id,
                    horse_id="horse-1",
                    horse_name="長い馬名の確認用競走馬一号",
                    horse_number=1,
                    deviation_score=68.4,
                    mark="◎",
                ),
                models.Prediction(
                    race_id=race.id,
                    horse_id="horse-2",
                    horse_name="確認馬二",
                    horse_number=2,
                    deviation_score=None,
                    mark="",
                ),
            ])
            db.commit()

            result = race_crud.get_article_race_preview(db, target_date, "マーキュリーカップ")
            self.assertEqual(result["status"], "available")
            self.assertEqual(result["race"]["race_url"], "/races/2026-07-20/morioka/12")
            self.assertEqual(result["top_predictions"][0]["horse_name"], "長い馬名の確認用競走馬一号")
            race_crud._article_preview_cache.clear()
            normalized_result = race_crud.get_article_race_preview(
                db,
                target_date,
                "第30回マーキュリーカップ（JpnIII）",
            )
            self.assertEqual(normalized_result["status"], "available")
            self.assertEqual(normalized_result["race"]["id"], race.id)
            self.assertEqual(
                race_crud.get_article_race_preview(db, target_date, "マーキュリー")["status"],
                "not_found",
            )

            duplicate = models.Race(
                id="202607203511",
                race_date=target_date,
                venue_name="盛岡",
                race_number=11,
                race_name="マーキュリーカップ",
                race_type="地方",
            )
            db.add(duplicate)
            db.commit()
            race_crud._article_preview_cache.clear()
            self.assertEqual(
                race_crud.get_article_race_preview(db, target_date, "マーキュリーカップ")["status"],
                "not_found",
            )
        finally:
            db.close()
            engine.dispose()

    def test_article_preview_returns_race_only_without_predictions(self) -> None:
        from crud import race_crud

        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(bind=engine)
        db = sessionmaker(autocommit=False, autoflush=False, bind=engine)()
        target_date = date(2026, 7, 23)
        try:
            db.add(models.Race(
                id="202607233601",
                race_date=target_date,
                venue_name="門別",
                race_number=1,
                race_name="確認用重賞",
                race_type="地方",
            ))
            db.commit()
            result = race_crud.get_article_race_preview(db, target_date, "確認用重賞")
            self.assertEqual(result["status"], "race_only")
            self.assertEqual(result["top_predictions"], [])
        finally:
            db.close()
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
