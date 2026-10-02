import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import pandas as pd


SCIENTIST_PATH = Path(__file__).resolve().parents[1] / "scripts" / "agents" / "data_scientist.py"
SPEC = importlib.util.spec_from_file_location("data_scientist_test_target", SCIENTIST_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("data_scientist.py を読み込めません。")

scientist = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = scientist
SPEC.loader.exec_module(scientist)


def _race_frame() -> pd.DataFrame:
    return pd.DataFrame({"race_date": pd.to_datetime(["2023-10-01", "2026-09-27"])})


def _ranked(conditions) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "condition": list(conditions),
            "anomaly_score": [30.0 - index for index, _ in enumerate(conditions)],
        }
    )


class DataScientistCourseDedupTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        root = Path(self._tmp.name)
        self.articles_dir = root / "articles"
        self.articles_dir.mkdir()
        self.orders_dir = root / "write_orders"
        self.conditions = []

        # DB にはつながない。集計の結果だけを差し替える。
        patcher = patch.multiple(
            scientist,
            ARTICLES_DIR=str(self.articles_dir),
            WRITE_ORDERS_DIR=str(self.orders_dir),
            POSTED_HISTORY_PATH=str(root / "posted_history.json"),
            fetch_data=_race_frame,
            analyze_jockey_bias=self._analyze(
                {"jockey_name": "テスト騎手", "total_runs": 40, "win_rate": 0.2, "roi": 1.1}
            ),
            analyze_popularity_bias=self._analyze(
                {"popularity": 1, "total_runs": 120, "win_rate": 0.3, "place_rate": 0.6, "roi": 0.8}
            ),
            analyze_waku_bias=self._analyze(
                {"waku_number": 1, "total_runs": 90, "win_rate": 0.1, "place_rate": 0.3, "roi": 0.9}
            ),
            analyze_running_style_bias=self._analyze(
                {"running_style": "先行", "total_runs": 200, "win_rate": 0.12, "place_rate": 0.35}
            ),
        )
        patcher.start()
        self.addCleanup(patcher.stop)

    def _analyze(self, metric_row):
        def fake(df):
            stats = pd.DataFrame([{"condition": condition, **metric_row} for condition in self.conditions])
            return _ranked(self.conditions), stats, df

        return fake

    def _write_article(self, slug: str, lines, newline: str = "\n") -> None:
        text = newline.join(["---", *lines, "---", "", "本文"]) + newline
        (self.articles_dir / f"{slug}.md").write_bytes(text.encode("utf-8"))

    def _orders(self):
        if not self.orders_dir.exists():
            return []
        return [
            json.loads(path.read_text(encoding="utf-8"))
            for path in sorted(self.orders_dir.glob("*.json"))
        ]

    def test_course_with_published_article_is_not_reordered_under_another_theme(self) -> None:
        # 公開側は同じコースの記事を上書きするので、題材の語が入れ替わっても同じコースは選ばない。
        self.conditions = ["阪神ダート1800m"]
        for keyword in ("阪神ダート1800m 荒れる 傾向", "阪神ダート1800m 騎手 データ"):
            with self.subTest(keyword=keyword):
                # 本番の記事ファイルと同じ CRLF で書く。
                self._write_article(
                    "2026-08-29-hanshindirt-1800-m-jockey-data",
                    [
                        f'target_keyword: "{keyword}"',
                        "entity_type: course",
                        "entity_key: hanshin-dirt-1800m",
                        "draft: false",
                    ],
                    newline="\r\n",
                )
                scientist.generate_write_order()
                self.assertEqual(self._orders(), [])

    def test_course_without_article_still_gets_an_order(self) -> None:
        self.conditions = ["阪神ダート1800m", "中山芝1600m"]
        self._write_article(
            "2026-08-29-hanshindirt-1800-m-jockey-data",
            [
                "target_keyword: 阪神ダート1800m 荒れる 傾向",
                "entity_type: course",
                "entity_key: hanshin-dirt-1800m",
                "draft: false",
            ],
        )

        scientist.generate_write_order()

        orders = self._orders()
        self.assertEqual(len(orders), 1)
        self.assertEqual(orders[0]["target_keyword"], "中山芝1600m 騎手 データ")
        self.assertEqual(orders[0]["entity_type"], "course")
        self.assertEqual(orders[0]["entity_key"], "nakayama-turf-1600m")

    def test_legacy_article_without_entity_blocks_only_its_keyword(self) -> None:
        # entity を持たない古いデータ記事は、公開側で上書きの相手にならない。語の重複だけを見る。
        self.conditions = ["東京ダート1600m"]
        self._write_article(
            "2026-04-11-tokyodirt1600m-jockey-data",
            ["target_keyword: 東京ダート1600m 騎手 データ", "draft: false"],
        )

        scientist.generate_write_order()

        orders = self._orders()
        self.assertEqual(len(orders), 1)
        self.assertEqual(orders[0]["target_keyword"], "東京ダート1600m 荒れる 傾向")
        self.assertEqual(orders[0]["entity_key"], "tokyo-dirt-1600m")

    def test_draft_and_other_entity_types_do_not_block_a_course(self) -> None:
        self.conditions = ["小倉芝2000m"]
        self._write_article(
            "draft-kokura-turf-2000m",
            [
                "target_keyword: 小倉芝2000m 枠順 データ",
                "entity_type: course",
                "entity_key: kokura-turf-2000m",
                "draft: true",
            ],
        )
        self._write_article(
            "2026-07-20-kokura-kinen",
            [
                "target_keyword: 小倉記念 2026",
                "entity_type: grade_race",
                "entity_key: kokura-turf-2000m",
                "draft: false",
            ],
        )

        self.assertEqual(scientist.load_existing_course_entity_keys(), set())
        scientist.generate_write_order()

        orders = self._orders()
        self.assertEqual(len(orders), 1)
        self.assertEqual(orders[0]["target_keyword"], "小倉芝2000m 騎手 データ")

    def test_pending_order_for_same_course_blocks_a_second_order(self) -> None:
        # 持ち越された注文が同じコースにあるときは、別の題材の注文を重ねない。
        self.conditions = ["東京芝1600m"]
        self.orders_dir.mkdir()
        pending = {
            "target_keyword": "東京芝1600m 枠順 データ",
            "entity_type": "course",
            "entity_key": "tokyo-turf-1600m",
        }
        (self.orders_dir / "20261001_090000.json").write_text(
            json.dumps(pending, ensure_ascii=False), encoding="utf-8"
        )

        scientist.generate_write_order()

        self.assertEqual(self._orders(), [pending])

    def test_load_existing_course_entity_keys_reads_published_course_articles(self) -> None:
        self._write_article(
            "2026-08-18-tokyoturf-1600-m",
            [
                "title: '東京芝1600mの傾向'",
                "entity_type: 'course'",
                'entity_key: "Tokyo-Turf-1600m"',
                "reference_data:",
                "  entity_key: nested-key",
            ],
            newline="\r\n",
        )
        self._write_article("no-frontmatter-entity", ["title: 見出しだけ"])

        self.assertEqual(scientist.load_existing_course_entity_keys(), {"tokyo-turf-1600m"})


if __name__ == "__main__":
    unittest.main()
