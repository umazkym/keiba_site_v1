import sys
import unittest
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from core.race_name import display_race_name, split_race_name


class RaceNameTest(unittest.TestCase):
    def test_leaves_well_formed_names_untouched(self) -> None:
        """括弧の対応が取れた正規のレース名には手を加えない。"""
        for name in (
            "天皇賞（秋）",
            "3歳未勝利",
            "東京ダービー",
            "3歳八　九十(3歳九)",  # 全角スペースの表記もそのまま残す
            "浦和記念[指定交流]",
        ):
            with self.subTest(name=name):
                self.assertEqual(split_race_name(name), (name, ""))

    def test_strips_grade_badge_glued_to_a_complete_name(self) -> None:
        """一覧HTMLが名前の直後へ連結してくるグレード表記を切り離す。"""
        cases = {
            "新春ペガサスカップ重賞": ("新春ペガサスカップ", "重賞"),
            "南部杯Jpn1": ("南部杯", "Jpn1"),
            "浦和記念[指定交流]Jpn2": ("浦和記念[指定交流]", "Jpn2"),
            "雷山賞OP": ("雷山賞", "OP"),
            "障害4歳以上OP": ("障害4歳以上", "OP"),
        }
        for raw, expected in cases.items():
            with self.subTest(raw=raw):
                self.assertEqual(split_race_name(raw), expected)

    def test_repairs_names_truncated_mid_bracket(self) -> None:
        """表示幅で打ち切られ閉じ括弧を失った名前を、意味の通る範囲まで戻す。"""
        cases = {
            "スパーキングサマーカップ【地方交重賞": ("スパーキングサマーカップ", "重賞"),
            "フルールカップ〔H3〕(ミスチヴィアスア重賞": ("フルールカップ〔H3〕", "重賞"),
            "北海道2歳スプリント(ゴールデンバローズOP": ("北海道2歳スプリント", "OP"),
            "鎌倉記念【地方交流】(全日本2歳重賞": ("鎌倉記念【地方交流】", "重賞"),
            "スパーキングオールスターチャレンジ(交流(A2)": (
                "スパーキングオールスターチャレンジ",
                "",
            ),
            "関東オークス【指定交(JpnII)": ("関東オークス", ""),
        }
        for raw, expected in cases.items():
            with self.subTest(raw=raw):
                self.assertEqual(split_race_name(raw), expected)

    def test_does_not_mistake_a_race_named_open_for_a_badge(self) -> None:
        """「オープン」で終わる正式なレース名を表記と取り違えない。"""
        for name in ("トルマリンオープン", "シトリンオープン"):
            with self.subTest(name=name):
                self.assertEqual(display_race_name(name), name)

    def test_keeps_two_character_race_names(self) -> None:
        """表記を剥がすと2文字になる正当なレース名を守る。"""
        self.assertEqual(split_race_name("楠賞重賞"), ("楠賞", "重賞"))
        self.assertEqual(split_race_name("金杯重賞"), ("金杯", "重賞"))

    def test_falls_back_to_the_original_when_nothing_usable_remains(self) -> None:
        """整形の結果が短くなりすぎる場合は元の名前を返す。"""
        self.assertEqual(split_race_name("(重賞"), ("(重賞", ""))
        self.assertEqual(split_race_name(""), ("", ""))
        self.assertEqual(split_race_name(None), ("", ""))


if __name__ == "__main__":
    unittest.main()
