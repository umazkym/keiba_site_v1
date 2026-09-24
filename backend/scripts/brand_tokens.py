"""UMA-FREE のブランド色（SNS画像・動画用）。

ロゴ（インディゴの円と紺の線の馬）から決めた値で、
frontend/tailwind.config.ts・frontend/app/globals.css・frontend/lib/brand.ts と同じ値にそろえる。
値を変えるときは4か所を同時に変える（frontend の `npm run design:audit` が一致を確かめる）。
"""

from __future__ import annotations


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16))


# 役割の色（16進）
BRAND_HEX = "#4C4EFF"  # ロゴの円：リンク・選択中・主ボタン
BRAND_DEEP_HEX = "#3638D6"
BRAND_SOFT_HEX = "#E5E6FF"
BRAND_TINT_HEX = "#F3F3FF"
NAVY_HEX = "#1C2787"  # ロゴの線：見出し・会場×Rのプレート
NIGHT_HEX = "#0E1440"  # 画像・動画の暗い面、写真の上の幕
INK_HEX = "#151A3D"
INK2_HEX = "#3A4063"
MUTED_HEX = "#5A6183"
FAINT_HEX = "#8388A6"
LINE_HEX = "#E2E5EF"
LINE2_HEX = "#CDD2E2"
BG_HEX = "#F3F5FA"
ON_NIGHT_SUB_HEX = "#C9CDEB"  # 夜の紺の上の補足文字
AI_HEX = "#F2A516"  # AI偏差値の棒と◎（面だけに使う）
AI_DEEP_HEX = "#865300"  # 白地の上のAI偏差値の数字
AI_SOFT_HEX = "#FFF1D1"
TURF_HEX = "#2E8B57"
DIRT_HEX = "#A5692F"
JUMP_HEX = "#6C54C8"
GRADE_HEX = {"G1": "#1F5FD1", "G2": "#D23B3B", "G3": "#1E8E4F", "LOCAL": "#8E5E26"}

# Pillow 用（RGB）
BRAND = hex_to_rgb(BRAND_HEX)
BRAND_DEEP = hex_to_rgb(BRAND_DEEP_HEX)
BRAND_SOFT = hex_to_rgb(BRAND_SOFT_HEX)
BRAND_TINT = hex_to_rgb(BRAND_TINT_HEX)
NAVY = hex_to_rgb(NAVY_HEX)
NIGHT = hex_to_rgb(NIGHT_HEX)
INK = hex_to_rgb(INK_HEX)
INK2 = hex_to_rgb(INK2_HEX)
MUTED = hex_to_rgb(MUTED_HEX)
FAINT = hex_to_rgb(FAINT_HEX)
LINE = hex_to_rgb(LINE_HEX)
LINE2 = hex_to_rgb(LINE2_HEX)
BG = hex_to_rgb(BG_HEX)
ON_NIGHT_SUB = hex_to_rgb(ON_NIGHT_SUB_HEX)
AI = hex_to_rgb(AI_HEX)
AI_DEEP = hex_to_rgb(AI_DEEP_HEX)
AI_SOFT = hex_to_rgb(AI_SOFT_HEX)
TURF = hex_to_rgb(TURF_HEX)
DIRT = hex_to_rgb(DIRT_HEX)
JUMP = hex_to_rgb(JUMP_HEX)
GRADE = {key: hex_to_rgb(value) for key, value in GRADE_HEX.items()}
WHITE = (255, 255, 255)

# JRAの枠の色（背景, 文字, 縁）。意味を変えないため、ブランドの色とは別に持つ。
WAKU = {
    1: (hex_to_rgb("#FFFFFF"), INK, hex_to_rgb("#AEB4C8")),
    2: (hex_to_rgb("#1B1C22"), WHITE, hex_to_rgb("#1B1C22")),
    3: (hex_to_rgb("#E03A2F"), WHITE, hex_to_rgb("#E03A2F")),
    4: (hex_to_rgb("#2563EB"), WHITE, hex_to_rgb("#2563EB")),
    5: (hex_to_rgb("#F5C518"), INK, hex_to_rgb("#E0B000")),
    6: (hex_to_rgb("#26954B"), WHITE, hex_to_rgb("#26954B")),
    7: (hex_to_rgb("#EE7D1F"), WHITE, hex_to_rgb("#EE7D1F")),
    8: (hex_to_rgb("#EC5A96"), WHITE, hex_to_rgb("#EC5A96")),
}

# 書体（backend/fonts に置くファイル名）。見出しは M PLUS Rounded 1c、本文は Noto Sans JP。
FONT_DISPLAY_BOLD = "MPLUSRounded1c-Bold.ttf"
FONT_DISPLAY_BLACK = "MPLUSRounded1c-Black.ttf"
