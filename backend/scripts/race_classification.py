from __future__ import annotations

import unicodedata
from typing import Any


# 地方競馬では「新馬」を含まない主催者固有の名称でデビュー戦が行われる。
# 後続の2歳条件戦まで広く除外しないよう、初出走戦として使われる名称だけを列挙する。
NEWCOMER_RACE_NAME_MARKERS = (
    "新馬",
    "ゴールデンデビュー",
    "スパーキングデビュー",
    "リアトリスデビュー",
    "フレッシュチャレンジ",
    "ドリームチャレンジ",
    "ファーストステップ",
    "ファーストトライ",
)


def is_newcomer_race_name(race_name: Any) -> bool:
    """中央・地方のレース名から、AI偏差値の対象外となるデビュー戦を判定する。"""
    normalized = unicodedata.normalize("NFKC", str(race_name or ""))
    compact = "".join(normalized.split())
    return any(marker in compact for marker in NEWCOMER_RACE_NAME_MARKERS)
