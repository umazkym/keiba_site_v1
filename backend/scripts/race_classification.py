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
    "NewBeginning",
)


def is_newcomer_race_name(race_name: Any) -> bool:
    """中央・地方のレース名から、AI偏差値の対象外となるデビュー戦を判定する。"""
    normalized = unicodedata.normalize("NFKC", str(race_name or ""))
    compact = "".join(normalized.split())
    return any(marker in compact for marker in NEWCOMER_RACE_NAME_MARKERS)


def is_obstacle_race(race_name: Any, course_type: Any = None) -> bool:
    """レース名またはコース種別から、AI偏差値の対象外となる障害戦を判定する。"""
    normalized_name = unicodedata.normalize("NFKC", str(race_name or ""))
    normalized_course = unicodedata.normalize("NFKC", str(course_type or "")).strip()
    return "障害" in normalized_name or normalized_course in {"障", "障害"}


def prediction_exclusion_reason(race_name: Any, course_type: Any = None) -> str:
    """予測エンジンと公開処理で共有するAI偏差値の算出対象外理由を返す。"""
    if is_newcomer_race_name(race_name):
        return "新馬戦のため、予測対象外です。"
    if is_obstacle_race(race_name, course_type):
        return "障害戦のため、予測対象外です。"
    return ""
