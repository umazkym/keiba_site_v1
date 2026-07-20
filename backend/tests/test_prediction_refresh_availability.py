import os
import sys
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


BACKEND_DIR = Path(__file__).resolve().parents[1]
REPOSITORY_DIR = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from database import models
from database.database import Base
from scripts import database_loader
import db_handler


class PredictionRefreshAvailabilityTest(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
        )
        Base.metadata.create_all(bind=self.engine)
        session_factory = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=self.engine,
        )
        self.db = session_factory()
        self.target_date = date(2099, 1, 1)
        self.race_id = "209901010101"

        self.db.add(
            models.Race(
                id=self.race_id,
                race_date=self.target_date,
                venue_name="東京",
                race_number=1,
                race_name="更新確認レース",
                race_type="中央",
                course_type="芝",
                distance=1600,
            )
        )
        self.db.add(
            models.Prediction(
                race_id=self.race_id,
                horse_id="old-horse",
                horse_name="更新前の馬",
                horse_number=1,
                waku_number=1,
                deviation_score=60.0,
                mark="◎",
            )
        )
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def test_refresh_keeps_existing_predictions_when_race_list_fetch_fails(self) -> None:
        with (
            patch.object(db_handler.os.path, "exists", return_value=False),
            patch.object(db_handler, "get_race_list_html", return_value=(None, False)),
        ):
            db_handler.insert_new_predictions(self.db, self.target_date)

        predictions = self.db.query(models.Prediction).filter(
            models.Prediction.race_id == self.race_id
        ).all()
        self.assertEqual(len(predictions), 1)
        self.assertEqual(predictions[0].horse_name, "更新前の馬")

    def test_prediction_replacement_rolls_back_to_previous_data_on_insert_error(self) -> None:
        new_predictions = [
            {
                "horse_id": "new-horse",
                "horse_name": "更新後の馬",
                "horse_number": 2,
                "waku_number": 2,
                "deviation_score": 65.0,
                "mark": "◎",
            }
        ]

        with patch.object(
            self.db,
            "bulk_insert_mappings",
            side_effect=RuntimeError("挿入失敗"),
        ):
            with self.assertRaisesRegex(RuntimeError, "挿入失敗"):
                database_loader.save_prediction(
                    self.db,
                    self.race_id,
                    new_predictions,
                )

        predictions = self.db.query(models.Prediction).filter(
            models.Prediction.race_id == self.race_id
        ).all()
        self.assertEqual(len(predictions), 1)
        self.assertEqual(predictions[0].horse_name, "更新前の馬")

    def test_prediction_replacement_commits_only_new_data(self) -> None:
        new_predictions = [
            {
                "horse_id": "new-horse",
                "horse_name": "更新後の馬",
                "horse_number": 2,
                "waku_number": 2,
                "deviation_score": 65.0,
                "mark": "◎",
            }
        ]

        database_loader.save_prediction(
            self.db,
            self.race_id,
            new_predictions,
        )

        predictions = self.db.query(models.Prediction).filter(
            models.Prediction.race_id == self.race_id
        ).all()
        self.assertEqual(len(predictions), 1)
        self.assertEqual(predictions[0].horse_name, "更新後の馬")

    def test_morning_refresh_schedule_covers_every_day(self) -> None:
        workflow_path = (
            REPOSITORY_DIR
            / ".github"
            / "workflows"
            / "keiba-data-fetch-morning-today.yml"
        )
        workflow = workflow_path.read_text(encoding="utf-8")

        self.assertIn("cron: '30 21 * * *'", workflow)


if __name__ == "__main__":
    unittest.main()
