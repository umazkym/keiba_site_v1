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
