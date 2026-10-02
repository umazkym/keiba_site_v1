"""重賞の開催前公開期限に関する共有ポリシー。"""

from __future__ import annotations

import re


def normalize_grade_for_publication(value: str) -> str:
    """日程・計測台帳で使う格付けの表記ゆれを最小限にそろえる。"""
    normalized = re.sub(r"\s+", "", str(value or ""))
    return {
        "GⅠ": "G1",
        "GⅡ": "G2",
        "GⅢ": "G3",
        "JpnⅠ": "JpnI",
        "JpnⅡ": "JpnII",
        "JpnⅢ": "JpnIII",
        "Jpn1": "JpnI",
        "Jpn2": "JpnII",
        "Jpn3": "JpnIII",
    }.get(normalized, normalized)


def grade_race_publish_lead_days(grade: str) -> int:
    """確認済み日程がある全重賞の初回公開期限を返す。"""
    return 21 if normalize_grade_for_publication(grade) in {"G1", "JpnI"} else 14


# 最初の1本を早く出す格（公開期限の D-21 から）。ほかの重賞は、出馬表が入るころ（D-3 以内）に出す（2026-10-02）。
EARLY_INITIAL_ARTICLE_GRADES = frozenset({"G1", "JpnI"})
LATE_INITIAL_ARTICLE_MAX_DAYS = 3


def grade_race_initial_article_due_days(grade: str) -> int:
    """最初の1本を実際に出す期限（レースの何日前までか）を返す。

    題材づくり（news_topic_planner）が初回を出す時期と同じにする。
    計測の「公開が遅い」と、監査の「次回公開期限」はこの値で判定する。
    """
    normalized = normalize_grade_for_publication(grade)
    if normalized in EARLY_INITIAL_ARTICLE_GRADES:
        return grade_race_publish_lead_days(normalized)
    return LATE_INITIAL_ARTICLE_MAX_DAYS
