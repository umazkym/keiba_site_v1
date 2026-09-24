#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
重賞レース分析用グラフ生成スクリプト
サイトと同じ見た目（brand_chart_style.py）で日本語グラフを生成する。数値はこのファイルに書いた集計値
"""

import matplotlib.pyplot as plt
import numpy as np
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from brand_chart_style import (  # noqa: E402
    BRAND_SOFT,
    INK,
    NAVY,
    apply_brand_chart_style,
    finish_axes,
    highlight_colors,
    label_bars,
    percent_axis,
)

# ==============================================================================
# 設定
# ==============================================================================

OUTPUT_DIR = Path(__file__).resolve().parents[3] / "frontend" / "public" / "images" / "articles"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
DPI = 200


def setup_matplotlib():
    """サイトと同じ見た目（書体・色・%表記）にする。書体は backend/fonts の M PLUS Rounded 1c。"""
    apply_brand_chart_style()


def _save(fig, name):
    fig.tight_layout()
    fig.savefig(OUTPUT_DIR / name, dpi=DPI, bbox_inches='tight')
    plt.close(fig)
    print(f"[OK] {name} created")


def _waku_rate_chart(title, rates, name):
    """枠番別の複勝率：最も高い枠だけインディゴ"""
    waku_labels = [str(i) for i in range(1, len(rates) + 1)]
    fig, ax = plt.subplots(figsize=(10, 5.6))
    bars = ax.bar(waku_labels, rates, color=highlight_colors(rates), width=0.62)
    label_bars(ax, bars, [f'{rate:.1f}%' for rate in rates])
    ax.set_xlabel('枠番')
    ax.set_ylim(0, 45)
    percent_axis(ax, fraction=False)
    finish_axes(ax, title)
    _save(fig, name)


def _leg_type_chart(title, leg_labels, win_rates, fukusho_diff, name):
    """脚質別の勝率（紺）と複勝率（紺＋淡いインディゴの合計）"""
    fig, ax = plt.subplots(figsize=(10, 5.6))
    x = np.arange(len(leg_labels))
    bars1 = ax.bar(x, win_rates, 0.56, label='勝率', color=NAVY)
    bars2 = ax.bar(x, fukusho_diff, 0.56, bottom=win_rates, label='複勝率（勝率を含む）', color=BRAND_SOFT)
    label_bars(ax, bars1, [f'{rate:.1f}%' for rate in win_rates], inside=True)
    totals = [win + rest for win, rest in zip(win_rates, fukusho_diff)]
    for bar, total in zip(bars2, totals):
        ax.annotate(f'{total:.1f}%', (bar.get_x() + bar.get_width() / 2, total), xytext=(0, 5),
                    textcoords='offset points', ha='center', va='bottom', fontsize=12.5, fontweight='bold', color=INK)
    ax.set_xticks(x)
    ax.set_xticklabels(leg_labels)
    ax.set_ylim(0, 50)
    percent_axis(ax, fraction=False)
    ax.legend(loc='upper right')
    finish_axes(ax, title)
    _save(fig, name)


def create_artemis_waku_rate():
    """アルテミスS：枠番別複勝率"""
    _waku_rate_chart('東京 芝1600m 枠番別の複勝率', [29.7, 35.8, 28.3, 33.2, 31.4, 26.9, 32.5, 30.1],
                     'artemis_tokyo_turf_1600m_waku_rate.png')


def create_artemis_leg_type():
    """アルテミスS：脚質別成績"""
    _leg_type_chart('東京 芝1600m 脚質別の勝率・複勝率', ['先行', '逃げ', '追込', '差し'],
                    [21.4, 16.8, 12.5, 8.7], [17.2, 18.4, 15.6, 15.6], 'artemis_tokyo_turf_1600m_leg_type.png')


def create_chrysanthemum_waku_rate():
    """菊花賞：枠番別複勝率"""
    _waku_rate_chart('京都 芝3000m 枠番別の複勝率', [29.4, 31.8, 33.2, 35.7, 38.1, 39.3, 40.5, 42.1],
                     'chrysanthemum_kyoto_turf_3000m_waku_rate.png')


def create_chrysanthemum_leg_type():
    """菊花賞：脚質別成績（稍重馬場時）"""
    _leg_type_chart('京都 芝3000m 脚質別の勝率・複勝率（稍重）', ['追込', '差し', '先行', '逃げ'],
                    [18.3, 15.7, 12.4, 8.9], [25.9, 24.4, 23.2, 19.4], 'chrysanthemum_kyoto_turf_3000m_leg_type.png')


def create_chrysanthemum_comparison():
    """菊花賞：内枠・中枠・外枠の比較"""
    labels = ['内枠（1〜4）', '中枠（5）', '外枠（6〜8）']
    rates = [32.3, 38.1, 40.6]
    fig, ax = plt.subplots(figsize=(9, 5.6))
    bars = ax.bar(labels, rates, color=highlight_colors(rates), width=0.5)
    label_bars(ax, bars, [f'{rate:.1f}%' for rate in rates])
    ax.set_ylim(0, 45)
    percent_axis(ax, fraction=False)
    finish_axes(ax, '京都 芝3000m 内枠・中枠・外枠の複勝率')
    _save(fig, 'chrysanthemum_kyoto_turf_3000m_comparison.png')


def main():
    """メイン処理"""
    print("=" * 80)
    print("重賞レース分析用グラフ生成スクリプト")
    print("=" * 80)
    print(f"\n出力ディレクトリ: {OUTPUT_DIR}\n")

    # matplotlib設定
    setup_matplotlib()

    try:
        print("[アルテミスS] グラフ生成中...")
        create_artemis_waku_rate()
        create_artemis_leg_type()

        print("\n[菊花賞] グラフ生成中...")
        create_chrysanthemum_waku_rate()
        create_chrysanthemum_leg_type()
        create_chrysanthemum_comparison()

        print("\n" + "=" * 80)
        print("[SUCCESS] すべてのグラフを生成しました")
        print("=" * 80)

    except Exception as e:
        print(f"\n[ERROR] エラーが発生しました: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
