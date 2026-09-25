import sys
import unittest
from datetime import date
from pathlib import Path
from types import SimpleNamespace


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from crud.race_crud import _serialize_race_for_cache
from schemas.race_schema import RacePrediction


def _race(**overrides):
    base = dict(
        id='202606040911',
        race_date=date(2026, 9, 20),
        venue_name='中山',
        race_number=11,
        race_name='オールカマー',
        race_type='中央',
        course_type='芝',
        distance=2200,
        total_horses=13,
        ground_condition='良',
        weather='晴',
        ai_analysis_text=None,
        predictions=[],
        results=[],
    )
    base.update(overrides)
    return SimpleNamespace(**base)


class RaceSerializerConditionsTest(unittest.TestCase):
    def test_includes_field_size_ground_and_weather(self) -> None:
        payload = _serialize_race_for_cache(_race(), [])
        self.assertEqual(payload['total_horses'], 13)
        self.assertEqual(payload['ground_condition'], '良')
        self.assertEqual(payload['weather'], '晴')
        RacePrediction.model_validate(payload)

    def test_conditions_are_optional_before_the_race_card_is_published(self) -> None:
        payload = _serialize_race_for_cache(_race(total_horses=None, ground_condition=None, weather=None), [])
        validated = RacePrediction.model_validate(payload)
        self.assertIsNone(validated.total_horses)
        self.assertIsNone(validated.ground_condition)
        self.assertIsNone(validated.weather)

    def test_placeholder_marks_are_treated_as_unannounced(self) -> None:
        # 地方の出馬表は発表前の馬場を「−」（U+2212）で返す。見出しに「馬場 −」と出さない
        for mark in ('−', '-', '―', '－', ' '):
            payload = _serialize_race_for_cache(_race(ground_condition=mark, weather=mark), [])
            self.assertIsNone(payload['ground_condition'], repr(mark))
            self.assertIsNone(payload['weather'], repr(mark))
        payload = _serialize_race_for_cache(_race(ground_condition='稍重', weather='曇'), [])
        self.assertEqual(payload['ground_condition'], '稍重')
        self.assertEqual(payload['weather'], '曇')


if __name__ == '__main__':
    unittest.main()
