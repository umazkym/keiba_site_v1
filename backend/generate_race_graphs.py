#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
重賞レース分析用グラフ生成スクリプト
master_analyzer.py と同じスタイルで日本語グラフを生成
"""

import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
import seaborn as sns
import numpy as np
from pathlib import Path
import os

# ==============================================================================
# 設定
# ==============================================================================

OUTPUT_DIR = Path(__file__).parent.parent / "frontend" / "public" / "images" / "articles"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def setup_matplotlib():
    """
    matplotlibで日本語が文字化けしないように設定します。
    master_analyzer.pyと同じ方式を使用。
    """
    # Seabornのスタイルを先に設定
    plt.style.use('seaborn-v0_8-whitegrid')
    sns.set_palette("husl")

    try:
        import japanize_matplotlib
        print("[OK] japanize-matplotlibによる日本語設定が有効になりました。")
    except ImportError:
        print("[WARN] japanize-matplotlibがインストールされていません。代替フォントを設定します。")
        # Windows, macOS, Linuxで一般的に利用可能な日本語フォントを試す
        font_families = [
            'Yu Gothic', 'Hiragino Sans', 'MS Gothic', 'TakaoPGothic', 'IPAexGothic', 'Noto Sans CJK JP'
        ]
        font_found = False
        for font in font_families:
            try:
                plt.rcParams['font.family'] = font
                plt.rcParams['axes.unicode_minus'] = False
                print(f"[OK] 代替フォントとして '{font}' を設定しました。")
                font_found = True
                break
            except Exception:
                continue
        if not font_found:
            print("[ERROR] 代替フォントが見つかりませんでした。文字化けする可能性があります。")

def create_artemis_waku_rate():
    """
    アルテミスS：枠順別複勝率グラフ
    """
    waku_labels = ['1', '2', '3', '4', '5', '6', '7', '8']
    rates = [29.7, 35.8, 28.3, 33.2, 31.4, 26.9, 32.5, 30.1]

    fig, ax = plt.subplots(figsize=(12, 7))

    # 色の設定：緑系グラデーション
    colors = ['#90ee90' if rates[i] < 31 else '#228b22' if rates[i] > 33 else '#90ee90' for i in range(len(waku_labels))]

    bars = ax.bar(waku_labels, rates, color=colors, alpha=0.85, edgecolor='black', linewidth=1.2)

    # データラベルを追加
    for bar, rate in zip(bars, rates):
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height + 0.8,
                f'{rate:.1f}%',
                ha='center', va='bottom', fontsize=13, fontweight='bold')

    # ラベルとタイトル
    ax.set_xlabel('枠番', fontsize=14, fontweight='bold')
    ax.set_ylabel('複勝率 (%)', fontsize=14, fontweight='bold')
    ax.set_title('東京 芝1600m - 枠番別 複勝率', fontsize=16, fontweight='bold')

    # Y軸設定
    ax.set_ylim(0, 45)
    ax.grid(axis='y', alpha=0.4, linestyle='-', linewidth=0.7)

    plt.tight_layout()
    img_path = OUTPUT_DIR / 'artemis_tokyo_turf_1600m_waku_rate.png'
    fig.savefig(img_path, dpi=300, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    print("[OK] artemis_tokyo_turf_1600m_waku_rate.png created")

def create_artemis_leg_type():
    """
    アルテミスS：脚質別成績
    """
    leg_labels = ['先行', '逃げ', '追込', '差し']
    win_rates = [21.4, 16.8, 12.5, 8.7]
    fukusho_diff = [17.2, 18.4, 15.6, 15.6]

    fig, ax = plt.subplots(figsize=(12, 7))

    x = np.arange(len(leg_labels))
    width = 0.5

    # 積み上げバーグラフ
    bars1 = ax.bar(x, win_rates, width, label='勝率',
                   color='#ff6b6b', alpha=0.85, edgecolor='black', linewidth=1.2)
    bars2 = ax.bar(x, fukusho_diff, width, bottom=win_rates, label='複勝率（勝率を除く）',
                   color='#ffd93d', alpha=0.85, edgecolor='black', linewidth=1.2)

    # データラベルを追加
    for i, (bar1, bar2) in enumerate(zip(bars1, bars2)):
        win = bar1.get_height()
        fukusho = bar2.get_height()

        # 勝率ラベル
        ax.text(bar1.get_x() + bar1.get_width()/2., win/2,
                f'{win_rates[i]:.1f}%',
                ha='center', va='center', fontsize=12, fontweight='bold', color='white')

        # 複勝率合計ラベル
        total = win_rates[i] + fukusho_diff[i]
        ax.text(bar2.get_x() + bar2.get_width()/2., win + fukusho/2,
                f'{total:.1f}%',
                ha='center', va='center', fontsize=12, fontweight='bold', color='white')

    # ラベルとタイトル
    ax.set_xlabel('脚質', fontsize=14, fontweight='bold')
    ax.set_ylabel('成績 (%)', fontsize=14, fontweight='bold')
    ax.set_title('東京 芝1600m - 脚質別 成績（勝率・複勝率）', fontsize=16, fontweight='bold')

    ax.set_xticks(x)
    ax.set_xticklabels(leg_labels, fontsize=13, fontweight='bold')
    ax.set_ylim(0, 45)
    ax.legend(loc='upper right', fontsize=12, framealpha=0.95)
    ax.grid(axis='y', alpha=0.4, linestyle='-', linewidth=0.7)

    plt.tight_layout()
    img_path = OUTPUT_DIR / 'artemis_tokyo_turf_1600m_leg_type.png'
    fig.savefig(img_path, dpi=300, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    print("[OK] artemis_tokyo_turf_1600m_leg_type.png created")

def create_chrysanthemum_waku_rate():
    """
    菊花賞：枠順別複勝率
    """
    waku_labels = ['1', '2', '3', '4', '5', '6', '7', '8']
    rates = [29.4, 31.8, 33.2, 35.7, 38.1, 39.3, 40.5, 42.1]

    fig, ax = plt.subplots(figsize=(12, 7))

    # 色の設定：緑系グラデーション（外枠が濃い）
    colors = ['#90ee90' if rates[i] < 35 else '#228b22' for i in range(len(waku_labels))]

    bars = ax.bar(waku_labels, rates, color=colors, alpha=0.85, edgecolor='black', linewidth=1.2)

    # データラベルを追加
    for bar, rate in zip(bars, rates):
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height + 0.8,
                f'{rate:.1f}%',
                ha='center', va='bottom', fontsize=13, fontweight='bold')

    # ラベルとタイトル
    ax.set_xlabel('枠番', fontsize=14, fontweight='bold')
    ax.set_ylabel('複勝率 (%)', fontsize=14, fontweight='bold')
    ax.set_title('京都 芝3000m - 枠番別 複勝率', fontsize=16, fontweight='bold')

    ax.set_ylim(0, 45)
    ax.grid(axis='y', alpha=0.4, linestyle='-', linewidth=0.7)

    plt.tight_layout()
    img_path = OUTPUT_DIR / 'chrysanthemum_kyoto_turf_3000m_waku_rate.png'
    fig.savefig(img_path, dpi=300, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    print("[OK] chrysanthemum_kyoto_turf_3000m_waku_rate.png created")

def create_chrysanthemum_leg_type():
    """
    菊花賞：脚質別成績（稍重馬場時）
    """
    leg_labels = ['追込', '差し', '先行', '逃げ']
    win_rates = [18.3, 15.7, 12.4, 8.9]
    fukusho_diff = [25.9, 24.4, 23.2, 19.4]

    fig, ax = plt.subplots(figsize=(12, 7))

    x = np.arange(len(leg_labels))
    width = 0.5

    # 積み上げバーグラフ
    bars1 = ax.bar(x, win_rates, width, label='勝率',
                   color='#ff6b6b', alpha=0.85, edgecolor='black', linewidth=1.2)
    bars2 = ax.bar(x, fukusho_diff, width, bottom=win_rates, label='複勝率（勝率を除く）',
                   color='#ffd93d', alpha=0.85, edgecolor='black', linewidth=1.2)

    # データラベルを追加
    for i, (bar1, bar2) in enumerate(zip(bars1, bars2)):
        win = bar1.get_height()
        fukusho = bar2.get_height()

        ax.text(bar1.get_x() + bar1.get_width()/2., win/2,
                f'{win_rates[i]:.1f}%',
                ha='center', va='center', fontsize=12, fontweight='bold', color='white')

        total = win_rates[i] + fukusho_diff[i]
        ax.text(bar2.get_x() + bar2.get_width()/2., win + fukusho/2,
                f'{total:.1f}%',
                ha='center', va='center', fontsize=12, fontweight='bold', color='white')

    # ラベルとタイトル
    ax.set_xlabel('脚質', fontsize=14, fontweight='bold')
    ax.set_ylabel('成績 (%)', fontsize=14, fontweight='bold')
    ax.set_title('京都 芝3000m - 脚質別 成績（稍重馬場時、勝率・複勝率）', fontsize=16, fontweight='bold')

    ax.set_xticks(x)
    ax.set_xticklabels(leg_labels, fontsize=13, fontweight='bold')
    ax.set_ylim(0, 45)
    ax.legend(loc='upper right', fontsize=12, framealpha=0.95)
    ax.grid(axis='y', alpha=0.4, linestyle='-', linewidth=0.7)

    plt.tight_layout()
    img_path = OUTPUT_DIR / 'chrysanthemum_kyoto_turf_3000m_leg_type.png'
    fig.savefig(img_path, dpi=300, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    print("[OK] chrysanthemum_kyoto_turf_3000m_leg_type.png created")

def create_chrysanthemum_comparison():
    """
    菊花賞：内枠 vs 外枠比較
    """
    labels = ['内枠\n(1-4)', '中枠\n(5)', '外枠\n(6-8)']
    rates = [32.3, 38.1, 40.6]
    colors = ['#90ee90', '#b8e6b8', '#228b22']

    fig, ax = plt.subplots(figsize=(10, 7))

    bars = ax.bar(labels, rates, color=colors, alpha=0.85, edgecolor='black', linewidth=1.5, width=0.5)

    # データラベルを追加
    for bar, rate in zip(bars, rates):
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height + 0.8,
                f'{rate:.1f}%',
                ha='center', va='bottom', fontsize=14, fontweight='bold')

    # ラベルとタイトル
    ax.set_ylabel('複勝率 (%)', fontsize=14, fontweight='bold')
    ax.set_title('京都 芝3000m：内枠 vs 外枠 複勝率の衝撃比較', fontsize=16, fontweight='bold')

    ax.set_ylim(0, 45)
    ax.grid(axis='y', alpha=0.4, linestyle='-', linewidth=0.7)

    plt.tight_layout()
    img_path = OUTPUT_DIR / 'chrysanthemum_kyoto_turf_3000m_comparison.png'
    fig.savefig(img_path, dpi=300, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    print("[OK] chrysanthemum_kyoto_turf_3000m_comparison.png created")

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
        print("[SUCCESS] すべてのグラフが正常に生成されました！")
        print("=" * 80)

    except Exception as e:
        print(f"\n[ERROR] エラーが発生しました: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
