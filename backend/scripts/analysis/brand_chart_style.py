"""記事に載せるグラフ（matplotlib）の見た目をサイトと合わせる（2026-09-25 デザイン改修 段階5）。

- 書体は backend/fonts の M PLUS Rounded 1c（端末の日本語書体に頼らない。環境で見た目が変わらない）
- 色はサイトと同じ：比べる棒は淡いインディゴ、最も良い値だけインディゴ、勝率など重ねる系列は紺
- 率の軸は「%」で表示する（0.35 ではなく 35%）
- 上と右の枠線を消し、横の目盛り線だけを薄く引く。題名は左寄せ

使い方:
    from brand_chart_style import apply_brand_chart_style, percent_axis, highlight_colors, finish_axes
    apply_brand_chart_style()
    fig, ax = plt.subplots(figsize=(10, 5.6))
    ax.bar(labels, rates, color=highlight_colors(rates))
    percent_axis(ax, fraction=True)
    finish_axes(ax, '東京 芝2400m 枠番別の3着以内率', note='2024年10月〜2025年9月 · 対象512頭')
"""
from __future__ import annotations

from pathlib import Path
from typing import Iterable, Sequence

import matplotlib as mpl
from matplotlib import font_manager
from matplotlib.colors import LinearSegmentedColormap
from matplotlib.ticker import PercentFormatter

FONTS_DIR = Path(__file__).resolve().parents[2] / 'fonts'

# サイトの色（frontend/tailwind.config.ts・backend/scripts/brand_tokens.py と同じ値）
BRAND = '#4C4EFF'
BRAND_SOFT = '#B9BBFF'
BRAND_TINT = '#EEEEFF'
NAVY = '#1C2787'
AI = '#F2A516'
AI_DEEP = '#865300'
TURF = '#2E8B57'
DIRT = '#A5692F'
ROSE = '#C8364A'
INK = '#151A3D'
INK2 = '#3A4063'
MUTED = '#5A6183'
LINE = '#E2E5EF'
LINE2 = '#CDD2E2'

# 系列の順番（凡例のある図）：インディゴ → 紺 → 琥珀 → 芝 → ダート → 淡いインディゴ
SERIES = [BRAND, NAVY, AI, TURF, DIRT, BRAND_SOFT]

_FONT_FAMILY: str | None = None


def _register_fonts() -> str:
    """同梱の M PLUS Rounded 1c を登録し、書体の名前を返す。"""
    global _FONT_FAMILY
    if _FONT_FAMILY:
        return _FONT_FAMILY
    family = 'sans-serif'
    for name in ('MPLUSRounded1c-Regular.ttf', 'MPLUSRounded1c-Bold.ttf', 'MPLUSRounded1c-ExtraBold.ttf'):
        path = FONTS_DIR / name
        if path.exists():
            font_manager.fontManager.addfont(str(path))
            family = font_manager.FontProperties(fname=str(path)).get_name()
    _FONT_FAMILY = family
    return family


def apply_brand_chart_style() -> None:
    """全体の見た目を設定する。図を作る前に1回呼ぶ。"""
    family = _register_fonts()
    mpl.rcParams.update({
        'font.family': family,
        'font.size': 12,
        'text.color': INK,
        'axes.unicode_minus': False,
        'figure.facecolor': 'white',
        'savefig.facecolor': 'white',
        'axes.facecolor': 'white',
        'axes.edgecolor': LINE2,
        'axes.linewidth': 1.0,
        'axes.labelcolor': INK2,
        'axes.labelsize': 12,
        'axes.labelweight': 'bold',
        'axes.titlesize': 17,
        'axes.titleweight': 'bold',
        'axes.titlecolor': INK,
        'axes.titlelocation': 'left',
        'axes.titlepad': 16,
        'axes.spines.top': False,
        'axes.spines.right': False,
        'axes.grid': True,
        'axes.grid.axis': 'y',
        'axes.axisbelow': True,
        'grid.color': LINE,
        'grid.linewidth': 1.0,
        'xtick.color': INK2,
        'ytick.color': MUTED,
        'xtick.labelsize': 12,
        'ytick.labelsize': 11,
        'xtick.major.size': 0,
        'ytick.major.size': 0,
        'legend.frameon': False,
        'legend.fontsize': 11.5,
        'axes.prop_cycle': mpl.cycler(color=SERIES),
        'patch.edgecolor': 'none',
    })


def percent_axis(ax, fraction: bool = True, axis: str = 'y', decimals: int = 0) -> None:
    """率の軸を % で表示する。値が 0〜1 なら fraction=True、0〜100 なら False。"""
    formatter = PercentFormatter(1.0 if fraction else 100.0, decimals=decimals)
    (ax.yaxis if axis == 'y' else ax.xaxis).set_major_formatter(formatter)


def highlight_colors(values: Sequence[float], best: str = 'max') -> list[str]:
    """最も良い値だけインディゴ、ほかは淡いインディゴ。best='min' なら最小を強調する。"""
    if not values:
        return []
    target = max(values) if best == 'max' else min(values)
    return [BRAND if value == target else BRAND_SOFT for value in values]


def brand_cmap(reverse: bool = False) -> LinearSegmentedColormap:
    """ヒートマップ用（白 → 淡いインディゴ → インディゴ）。値が小さいほど良いときは reverse=True。"""
    colors = ['#FFFFFF', BRAND_TINT, BRAND_SOFT, BRAND]
    if reverse:
        colors = list(reversed(colors))
    return LinearSegmentedColormap.from_list('uma_free_brand', colors)


def label_bars(ax, bars: Iterable, texts: Iterable[str], color: str = INK, inside: bool = False) -> None:
    """棒の上（inside=True なら中）に数字を書く。"""
    for bar, text in zip(bars, texts):
        height = bar.get_height()
        x = bar.get_x() + bar.get_width() / 2
        if inside:
            ax.text(x, bar.get_y() + height / 2, text, ha='center', va='center', fontsize=12, fontweight='bold', color='white')
        else:
            ax.annotate(text, (x, bar.get_y() + height), xytext=(0, 5), textcoords='offset points',
                        ha='center', va='bottom', fontsize=12.5, fontweight='bold', color=color)


def finish_axes(ax, title: str, note: str | None = None) -> None:
    """題名（左寄せ）と、題名の下の注記（期間・母数）を付ける。"""
    ax.set_title(title, loc='left', pad=30 if note else 16)
    if note:
        ax.text(0, 1.02, note, transform=ax.transAxes, ha='left', va='bottom', fontsize=11.5, color=MUTED)
