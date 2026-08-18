"""レース名の表示用整形。

netkeibaのレース一覧HTMLはレース名を表示幅で打ち切ったうえで、直後の
グレード表記（重賞 / OP / Jpn3 など）をそのまま連結して返すことがある。
そのためDBには次のような文字列が入る。

    スパーキングサマーカップ【地方交重賞      閉じ括弧が無い
    新春ペガサスカップ重賞                    表記が名前に貼り付いている
    北海道2歳スプリント(ゴールデンバローズOP  両方

これをそのままページタイトルや動画のタイトルに使うと、
「スパーキングサマーカップ 予想」のような検索意図の強いクエリに
一致しなくなる。

racesテーブルにgrade列が無く、地方重賞の判定は
crud.race_crud._detect_grade() がこの末尾表記を読んで行っている。
そのためDBの値は生のまま保持し、表示する直前にこのモジュールで整える。
グレードを算出してからレース名を整形する順序を守ること。

DBにもORMにも依存しない純粋なモジュールとして保つ。
"""

from __future__ import annotations

import re
from typing import Optional


# 対応する括弧。開き括弧が閉じられないまま終わる場合、
# そこから先は打ち切りの残骸なので落とす。
_BRACKET_PAIRS = {
    "(": ")",
    "（": "）",
    "【": "】",
    "〔": "〕",
    "[": "]",
    "「": "」",
    "<": ">",
    "＜": "＞",
}

# 末尾に貼り付くグレード表記。
# 「オープン」は入れてはいけない。トルマリンオープン・シトリンオープンは
# 正式なレース名であり、剥がすと別のレースになってしまう。
_TRAILING_GRADE_BADGE = re.compile(r"(?:重賞|OP|Jpn[1-3]|G[1-3])\s*$")

# 整形後にこれより短くなる場合は打ち切りの誤検出とみなす。
# 「楠賞重賞」→「楠賞」、「金杯重賞」→「金杯」のように
# 2文字の正当なレース名が実在するため、下限は2文字。
_MIN_DISPLAY_LENGTH = 2

# 切り落とした末尾に残る区切り文字。
_TRAILING_SEPARATORS = " 　・／/―—-"


def _first_unclosed_bracket_index(name: str) -> Optional[int]:
    """閉じられていない開き括弧のうち、最も手前の位置を返す。"""
    stack: list[tuple[int, str]] = []
    for index, char in enumerate(name):
        if char in _BRACKET_PAIRS:
            stack.append((index, _BRACKET_PAIRS[char]))
        elif stack and char == stack[-1][1]:
            stack.pop()
    return stack[0][0] if stack else None


def split_race_name(raw_name: str) -> tuple[str, str]:
    """レース名を (表示用の名前, 剥がしたグレード表記) に分ける。

    グレード表記が無く括弧の対応も取れている通常のレース名は、
    全角スペースなどの表記も含めてそのまま返す。
    整形の結果が短くなりすぎる場合は、打ち切りの誤検出とみなして
    元の名前を返す。
    """
    name = re.sub(r"[\r\n\t]+", " ", str(raw_name or "")).strip()
    if not name:
        return "", ""

    badge_match = _TRAILING_GRADE_BADGE.search(name)
    badge = badge_match.group(0).strip() if badge_match else ""
    trimmed = name[: badge_match.start()].rstrip() if badge_match else name

    cut_at = _first_unclosed_bracket_index(trimmed)
    if cut_at is not None:
        trimmed = trimmed[:cut_at]

    trimmed = trimmed.strip(_TRAILING_SEPARATORS).strip()
    if len(trimmed) < _MIN_DISPLAY_LENGTH:
        return name, ""
    return trimmed, badge


def display_race_name(raw_name: str) -> str:
    """表示用に整えたレース名を返す。"""
    return split_race_name(raw_name)[0]
