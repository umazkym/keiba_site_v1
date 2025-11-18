#!/usr/bin/env python3
"""
エラー分析ツール - パースエラーの詳細調査

使用方法:
    python error_analyzer.py <html_dir> [--output report.json]

例:
    python error_analyzer.py C:/Users/zk-ht/Keiba/Keiba_AI_v2/keibaai/data/raw/html
    python error_analyzer.py ./data/html_cache --output error_report.json
"""

import os
import sys
import json
import re
from pathlib import Path
from typing import Dict, List, Optional, Any
from collections import defaultdict
from datetime import datetime


class ErrorAnalyzer:
    """HTMLファイルのエラー分析を行うクラス"""

    def __init__(self, html_base_dir: str):
        self.html_base_dir = Path(html_base_dir)
        self.results = {
            'timestamp': datetime.now().isoformat(),
            'base_dir': str(self.html_base_dir),
            'file_stats': {},
            'error_categories': defaultdict(list),
            'recommendations': []
        }

    def analyze_all(self) -> Dict[str, Any]:
        """全HTMLファイルを分析"""
        print("=" * 80)
        print("🔍 エラー分析ツール - 開始")
        print("=" * 80)
        print(f"📁 対象ディレクトリ: {self.html_base_dir}")
        print()

        # 各種HTMLディレクトリを分析
        directories = {
            'race': 'レース結果',
            'shutuba': '出馬表',
            'horse': '馬プロフィール',
            'ped': '血統',
            'racelist': 'レース一覧',
        }

        for dir_name, description in directories.items():
            self._analyze_directory(dir_name, description)

        # 推奨事項を生成
        self._generate_recommendations()

        return self.results

    def _analyze_directory(self, dir_name: str, description: str):
        """特定のディレクトリを分析"""
        dir_path = self.html_base_dir / dir_name

        if not dir_path.exists():
            print(f"⚠️  ディレクトリが見つかりません: {dir_path}")
            return

        print(f"📂 {description} ({dir_name}) を分析中...")

        # .binファイルを検索
        bin_files = list(dir_path.glob('*.bin'))

        stats = {
            'total_files': len(bin_files),
            'empty_files': 0,
            'small_files': 0,  # < 1KB
            'medium_files': 0,  # 1KB - 10KB
            'large_files': 0,  # > 10KB
            'suspicious_files': [],
            'future_race_ids': [],
            'error_indicators': []
        }

        for file_path in bin_files:
            file_size = file_path.stat().st_size
            file_id = file_path.stem  # ファイル名（拡張子なし）

            # ファイルサイズ分類
            if file_size == 0:
                stats['empty_files'] += 1
                stats['suspicious_files'].append({
                    'file': str(file_path.name),
                    'reason': '空ファイル',
                    'size': 0
                })
            elif file_size < 1024:
                stats['small_files'] += 1
                stats['suspicious_files'].append({
                    'file': str(file_path.name),
                    'reason': '1KB未満（不完全な可能性）',
                    'size': file_size
                })
            elif file_size < 10240:
                stats['medium_files'] += 1
            else:
                stats['large_files'] += 1

            # レースIDの分析（raceディレクトリの場合）
            if dir_name in ['race', 'shutuba'] and len(file_id) == 12:
                year = int(file_id[:4])
                current_year = datetime.now().year

                if year > current_year:
                    stats['future_race_ids'].append({
                        'file': str(file_path.name),
                        'race_id': file_id,
                        'year': year,
                        'reason': f'未来のレースID（{year}年）'
                    })

            # エラーインジケータをチェック（最初の数行のみ）
            if file_size > 0 and file_size < 1024 * 1024:  # 1MB未満のみチェック
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read(500)  # 最初の500文字

                        error_patterns = [
                            (r'404|Not Found', '404エラー'),
                            (r'403|Forbidden', '403エラー（アクセス拒否）'),
                            (r'500|Internal Server Error', '500エラー'),
                            (r'Access Denied', 'アクセス拒否'),
                            (r'IP.*ban', 'IP BAN'),
                            (r'Too Many Requests', 'リクエスト過多'),
                        ]

                        for pattern, error_type in error_patterns:
                            if re.search(pattern, content, re.IGNORECASE):
                                stats['error_indicators'].append({
                                    'file': str(file_path.name),
                                    'error_type': error_type,
                                    'size': file_size
                                })
                                break
                except Exception:
                    pass

        self.results['file_stats'][dir_name] = stats

        # 結果を表示
        print(f"  ✅ 総ファイル数: {stats['total_files']}")
        print(f"  📊 サイズ分布:")
        print(f"     - 空ファイル: {stats['empty_files']}")
        print(f"     - 小 (< 1KB): {stats['small_files']}")
        print(f"     - 中 (1-10KB): {stats['medium_files']}")
        print(f"     - 大 (> 10KB): {stats['large_files']}")

        if stats['future_race_ids']:
            print(f"  ⚠️  未来のレースID: {len(stats['future_race_ids'])} 件")

        if stats['error_indicators']:
            print(f"  🚨 エラーインジケータ検出: {len(stats['error_indicators'])} 件")

        print()

    def _generate_recommendations(self):
        """分析結果に基づく推奨事項を生成"""
        recommendations = []

        for dir_name, stats in self.results['file_stats'].items():
            # 空ファイルが多い場合
            if stats['empty_files'] > 0:
                recommendations.append({
                    'priority': 'HIGH',
                    'category': dir_name,
                    'issue': f"{stats['empty_files']} 個の空ファイル",
                    'action': 'これらのファイルを削除し、再スクレイピングを実行してください'
                })

            # 小さいファイルが多い場合
            if stats['small_files'] > stats['total_files'] * 0.1:  # 10%以上
                recommendations.append({
                    'priority': 'MEDIUM',
                    'category': dir_name,
                    'issue': f"{stats['small_files']} 個の小さいファイル（1KB未満）",
                    'action': 'ダウンロードが不完全な可能性があります。再スクレイピングを検討してください'
                })

            # 未来のレースID
            if stats['future_race_ids']:
                recommendations.append({
                    'priority': 'HIGH',
                    'category': dir_name,
                    'issue': f"{len(stats['future_race_ids'])} 個の未来のレースID",
                    'action': '未来のレースは結果が存在しないため、パース対象から除外してください'
                })

            # エラーインジケータ
            if stats['error_indicators']:
                recommendations.append({
                    'priority': 'CRITICAL',
                    'category': dir_name,
                    'issue': f"{len(stats['error_indicators'])} 個のエラーページ",
                    'action': 'IP BAN や 404エラーの可能性があります。詳細を確認し、再スクレイピングしてください'
                })

        self.results['recommendations'] = recommendations

    def print_summary(self):
        """サマリーを表示"""
        print("=" * 80)
        print("📊 分析サマリー")
        print("=" * 80)

        total_files = sum(s['total_files'] for s in self.results['file_stats'].values())
        total_suspicious = sum(len(s['suspicious_files']) for s in self.results['file_stats'].values())
        total_future = sum(len(s['future_race_ids']) for s in self.results['file_stats'].values())
        total_errors = sum(len(s['error_indicators']) for s in self.results['file_stats'].values())

        print(f"総HTMLファイル数: {total_files}")
        print(f"疑わしいファイル: {total_suspicious}")
        print(f"未来のレースID: {total_future}")
        print(f"エラーページ: {total_errors}")
        print()

        if self.results['recommendations']:
            print("=" * 80)
            print("💡 推奨事項")
            print("=" * 80)

            # 優先度順にソート
            priority_order = {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3}
            sorted_recommendations = sorted(
                self.results['recommendations'],
                key=lambda x: priority_order.get(x['priority'], 99)
            )

            for i, rec in enumerate(sorted_recommendations, 1):
                icon = {
                    'CRITICAL': '🔴',
                    'HIGH': '🟠',
                    'MEDIUM': '🟡',
                    'LOW': '🟢'
                }.get(rec['priority'], '⚪')

                print(f"{i}. {icon} [{rec['priority']}] {rec['category']}")
                print(f"   問題: {rec['issue']}")
                print(f"   対策: {rec['action']}")
                print()

    def export_suspicious_files(self, output_file: str = 'suspicious_files.txt'):
        """疑わしいファイルのリストをエクスポート"""
        output_path = Path(output_file)

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("=" * 80 + "\n")
            f.write("疑わしいファイル一覧\n")
            f.write(f"生成日時: {self.results['timestamp']}\n")
            f.write("=" * 80 + "\n\n")

            for dir_name, stats in self.results['file_stats'].items():
                if stats['suspicious_files'] or stats['future_race_ids'] or stats['error_indicators']:
                    f.write(f"\n【{dir_name}】\n")
                    f.write("-" * 80 + "\n")

                    # 疑わしいファイル
                    if stats['suspicious_files']:
                        f.write("\n■ サイズ異常:\n")
                        for item in stats['suspicious_files'][:50]:  # 最大50件
                            f.write(f"  - {item['file']} ({item['size']} bytes) : {item['reason']}\n")

                    # 未来のレースID
                    if stats['future_race_ids']:
                        f.write("\n■ 未来のレースID:\n")
                        for item in stats['future_race_ids'][:50]:
                            f.write(f"  - {item['file']} : {item['reason']}\n")

                    # エラーインジケータ
                    if stats['error_indicators']:
                        f.write("\n■ エラーページ:\n")
                        for item in stats['error_indicators'][:50]:
                            f.write(f"  - {item['file']} : {item['error_type']}\n")

        print(f"💾 疑わしいファイルリストを出力: {output_path}")


def main():
    """メイン関数"""
    import argparse

    parser = argparse.ArgumentParser(description='HTML ファイルのエラー分析ツール')
    parser.add_argument('html_dir', help='HTMLファイルのベースディレクトリ')
    parser.add_argument('--output', '-o', help='結果をJSONで出力', default='error_analysis_report.json')
    parser.add_argument('--suspicious', '-s', help='疑わしいファイルのリストを出力', default='suspicious_files.txt')

    args = parser.parse_args()

    if not os.path.exists(args.html_dir):
        print(f"❌ ディレクトリが見つかりません: {args.html_dir}")
        sys.exit(1)

    # 分析実行
    analyzer = ErrorAnalyzer(args.html_dir)
    results = analyzer.analyze_all()
    analyzer.print_summary()

    # 結果をJSONで保存
    output_path = Path(args.output)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"💾 詳細レポートを出力: {output_path}")

    # 疑わしいファイルのリストを保存
    analyzer.export_suspicious_files(args.suspicious)

    print("\n✅ 分析完了!")


if __name__ == '__main__':
    main()
