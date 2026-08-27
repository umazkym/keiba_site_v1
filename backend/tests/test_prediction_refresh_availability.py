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

    def _prediction_payload(self, race_id: str, horse_id: str) -> list[dict]:
        return [
            {
                "horse_id": f"{horse_id}-{number}",
                "horse_name": f"更新後の馬-{race_id[-2:]}-{number}",
                "horse_number": number,
                "waku_number": number,
                "deviation_score": 66.0 - number,
                "mark": "◎" if number == 1 else "",
                "unpredictable_reason": None,
            }
            for number in range(1, 4)
        ]

    def test_refresh_preserves_existing_predictions_but_fails_when_race_data_stays_missing(self) -> None:
        with (
            patch.object(db_handler.os.path, "exists", return_value=False),
            patch.object(db_handler, "get_race_list_html", return_value=(None, False)),
            patch.object(db_handler, "get_shutuba_html_content", return_value=None),
            patch.object(db_handler.predictor, "create_predictions_for_race", return_value=None),
        ):
            with self.assertRaisesRegex(
                RuntimeError,
                rf"{self.race_id} 東京 1R 更新確認レース",
            ):
                db_handler.insert_new_predictions(self.db, self.target_date)

        predictions = self.db.query(models.Prediction).filter(
            models.Prediction.race_id == self.race_id
        ).all()
        self.assertEqual(len(predictions), 1)
        self.assertEqual(predictions[0].horse_name, "更新前の馬")

    def test_only_incomplete_race_is_retried_and_recovers(self) -> None:
        healthy_race_id = "209901010201"
        self.db.add(
            models.Race(
                id=healthy_race_id,
                race_date=self.target_date,
                venue_name="中山",
                race_number=1,
                race_name="正常会場レース",
                race_type="中央",
                course_type="芝",
                distance=1800,
            )
        )
        self.db.add(
            models.Prediction(
                race_id=healthy_race_id,
                horse_id="healthy-old",
                horse_name="正常会場の更新前データ",
                horse_number=1,
                waku_number=1,
                deviation_score=58.0,
                mark="◎",
            )
        )
        self.db.commit()

        shutuba_attempts: dict[str, int] = {}
        prediction_attempts: dict[str, int] = {}

        def get_shutuba(race_id: str, **_: object) -> str | None:
            shutuba_attempts[race_id] = shutuba_attempts.get(race_id, 0) + 1
            if race_id == self.race_id and shutuba_attempts[race_id] == 1:
                return None
            return f"shutuba:{race_id}"

        def parse_shutuba(_: str, race_id: str) -> dict:
            return {
                "horses": [
                    {
                        "horse_id": f"horse-{race_id}",
                        "horse_name": f"出走馬-{race_id}",
                        "horse_number": 2,
                    }
                ]
            }

        def create_predictions(race_id: str, _: object) -> list[dict] | None:
            prediction_attempts[race_id] = prediction_attempts.get(race_id, 0) + 1
            if race_id == self.race_id and prediction_attempts[race_id] == 1:
                return None
            return self._prediction_payload(race_id, f"horse-{race_id}")

        with (
            patch.object(db_handler.os.path, "exists", return_value=False),
            patch.object(db_handler, "get_race_list_html", return_value=(None, False)),
            patch.object(db_handler, "get_shutuba_html_content", side_effect=get_shutuba),
            patch.object(db_handler.parser, "parse_shutuba_page", side_effect=parse_shutuba),
            patch.object(db_handler.database_loader, "load_shutuba_data"),
            patch.object(db_handler, "_fetch_and_load_horse_past_data"),
            patch.object(db_handler.predictor, "create_predictions_for_race", side_effect=create_predictions),
            patch.object(db_handler.predictor, "calculate_and_save_matchups_for_race"),
            patch("scripts.llm_generator.generate_analyses_in_batches"),
        ):
            db_handler.insert_new_predictions(self.db, self.target_date)

        self.assertEqual(shutuba_attempts[self.race_id], 2)
        self.assertEqual(shutuba_attempts[healthy_race_id], 1)
        self.assertEqual(prediction_attempts[self.race_id], 2)
        self.assertEqual(prediction_attempts[healthy_race_id], 1)

        refreshed = self.db.query(models.Prediction).filter(
            models.Prediction.race_id == self.race_id
        ).order_by(models.Prediction.horse_number).all()
        self.assertEqual(len(refreshed), 3)
        self.assertEqual(refreshed[0].horse_id, f"horse-{self.race_id}-1")

    def test_newcomer_with_explicit_reason_passes_completeness_audit(self) -> None:
        race = self.db.query(models.Race).filter(models.Race.id == self.race_id).one()
        race.race_name = "2歳新馬"
        self.db.query(models.Prediction).filter(
            models.Prediction.race_id == self.race_id
        ).delete(synchronize_session=False)
        self.db.add(
            models.Prediction(
                race_id=self.race_id,
                horse_id="debut-horse",
                horse_name="デビュー馬",
                horse_number=1,
                waku_number=1,
                deviation_score=None,
                mark="—",
                unpredictable_reason="新馬戦のため、予測対象外です。",
            )
        )
        self.db.commit()

        issues = db_handler.audit_prediction_completeness(
            self.db,
            [(self.race_id, False)],
        )

        self.assertEqual(issues, [])

    def test_obstacle_with_explicit_reason_passes_completeness_audit(self) -> None:
        race = self.db.query(models.Race).filter(models.Race.id == self.race_id).one()
        race.race_name = "障害4歳以上未勝利"
        race.course_type = "障害"
        self.db.query(models.Prediction).filter(
            models.Prediction.race_id == self.race_id
        ).delete(synchronize_session=False)
        self.db.add(
            models.Prediction(
                race_id=self.race_id,
                horse_id="jump-horse",
                horse_name="障害出走馬",
                horse_number=1,
                waku_number=1,
                deviation_score=None,
                mark="—",
                unpredictable_reason="障害戦のため、予測対象外です。",
            )
        )
        self.db.commit()

        issues = db_handler.audit_prediction_completeness(
            self.db,
            [(self.race_id, False)],
        )

        self.assertEqual(issues, [])

    def test_general_race_prediction_error_fails_completeness_audit(self) -> None:
        self.db.query(models.Prediction).filter(
            models.Prediction.race_id == self.race_id
        ).delete(synchronize_session=False)
        self.db.add(
            models.Prediction(
                race_id=self.race_id,
                horse_id="error-horse",
                horse_name="計算失敗馬",
                horse_number=1,
                waku_number=1,
                deviation_score=None,
                mark="—",
                unpredictable_reason="予測計算中にエラーが発生",
            )
        )
        self.db.commit()

        issues = db_handler.audit_prediction_completeness(
            self.db,
            [(self.race_id, False)],
        )

        self.assertEqual(len(issues), 1)
        self.assertIn("一般レースの予測計算エラー", issues[0].reason)

    def test_comparison_data_shortage_is_a_normal_prediction_exclusion(self) -> None:
        self.db.query(models.Prediction).filter(
            models.Prediction.race_id == self.race_id
        ).delete(synchronize_session=False)
        self.db.add(
            models.Prediction(
                race_id=self.race_id,
                horse_id="short-history-horse",
                horse_name="比較データ不足馬",
                horse_number=1,
                waku_number=1,
                deviation_score=None,
                mark="—",
                unpredictable_reason=(
                    "比較可能な過去データを持つ馬が2頭未満のため、予測対象外です。"
                ),
            )
        )
        self.db.commit()

        issues = db_handler.audit_prediction_completeness(
            self.db,
            [(self.race_id, False)],
        )

        self.assertEqual(issues, [])
        self.assertEqual(
            db_handler.count_renderable_prediction_races(
                self.db,
                [(self.race_id, False)],
            ),
            0,
        )

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

    def test_youtube_workflow_uses_successful_scheduled_upstream_and_fallback_cron(self) -> None:
        workflow_path = (
            REPOSITORY_DIR
            / ".github"
            / "workflows"
            / "keiba-youtube-video-pipeline.yml"
        )
        workflow = workflow_path.read_text(encoding="utf-8")

        self.assertIn("github.event.workflow_run.conclusion == 'success'", workflow)
        self.assertIn("github.event.workflow_run.event == 'schedule'", workflow)
        self.assertIn("YOUTUBE_READINESS_ATTEMPTS: '3'", workflow)
        self.assertIn("YOUTUBE_READINESS_DELAY_SECONDS: '120'", workflow)
        self.assertIn("cron: '20 9 * * *'", workflow)
        self.assertRegex(
            workflow,
            r"name: Set up IAP database tunnel[\s\S]*?continue-on-error: true",
        )


if __name__ == "__main__":
    unittest.main()
