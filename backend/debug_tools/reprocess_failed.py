#!/usr/bin/env python3
"""
失敗ファイル再処理ツール - エラーファイルの再取得・再パース

使用方法:
    python reprocess_failed.py --input suspicious_files.txt --mode delete
    python reprocess_failed.py --input error_analysis_report.json --mode list

モード:
    list   : 失敗したファイルのリストを表示（デフォルト）
    delete : 失敗したファイルを削除（再スクレイピングを促す）
    export : 再取得が必要なレースIDリストをエクスポート

例:
    # 疑わしいファイルをリスト表示
    python reprocess_failed.py --input suspicious_files.txt --mode list

    # 空ファイル・エラーファイルを削除
    python reprocess_failed.py --input error_analysis_report.json --mode delete --category empty,error

    # 未来のレースIDを除外するリストを作成
    python reprocess_failed.py --input error_analysis_report.json --mode export --output exclude_race_ids.txt
"""

import os
import sys
import json
import re
from pathlib import Path
from typing import List, Dict, Any, Set
from datetime import datetime


class ReprocessManager:
    """失敗したファイルの再処理を管理するクラス"""

    def __init__(self, input_file: str, html_base_dir: str = None):
        self.input_file = Path(input_file)
        self.html_base_dir = Path(html_base_dir) if html_base_dir else None
        self.failed_files = {
            'empty': [],
            'small': [],
            'future': [],
            'error': [],
            'other': []
        }
        self.race_ids_to_exclude = set()
        self.race_ids_to_redownload = set()

    def load_from_json(self) -> bool:
        """error_analysis_report.json から読み込み"""
        print(f"📂 JSON レポートを読み込み中: {self.input_file}")

        try:
            with open(self.input_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            for dir_name, stats in data.get('file_stats', {}).items():
                # 疑わしいファイル
                for item in stats.get('suspicious_files', []):
                    if item['size'] == 0:
                        self.failed_files['empty'].append({
                            'file': item['file'],
                            'dir': dir_name,
                            'reason': item['reason']
                        })
                    else:
                        self.failed_files['small'].append({
                            'file': item['file'],
                            'dir': dir_name,
                            'size': item['size'],
                            'reason': item['reason']
                        })

                # 未来のレースID
                for item in stats.get('future_race_ids', []):
                    self.failed_files['future'].append({
                        'file': item['file'],
                        'dir': dir_name,
                        'race_id': item['race_id'],
                        'reason': item['reason']
                    })
                    self.race_ids_to_exclude.add(item['race_id'])

                # エラーページ
                for item in stats.get('error_indicators', []):
                    self.failed_files['error'].append({
                        'file': item['file'],
                        'dir': dir_name,
                        'error_type': item['error_type'],
                    })

                    # レースIDを抽出
                    race_id_match = re.search(r'(\d{12})', item['file'])
                    if race_id_match:
                        self.race_ids_to_redownload.add(race_id_match.group(1))

            print(f"  ✅ 読み込み完了")
            print(f"     - 空ファイル: {len(self.failed_files['empty'])} 件")
            print(f"     - 小ファイル: {len(self.failed_files['small'])} 件")
            print(f"     - 未来ID: {len(self.failed_files['future'])} 件")
            print(f"     - エラー: {len(self.failed_files['error'])} 件")
            return True

        except Exception as e:
            print(f"❌ JSONファイルの読み込みエラー: {e}")
            return False

    def load_from_txt(self) -> bool:
        """suspicious_files.txt から読み込み"""
        print(f"📂 テキストファイルを読み込み中: {self.input_file}")

        try:
            with open(self.input_file, 'r', encoding='utf-8') as f:
                current_dir = None
                current_category = None

                for line in f:
                    line = line.strip()

                    # ディレクトリ名を抽出
                    if line.startswith('【') and line.endswith('】'):
                        current_dir = line[1:-1]
                        continue

                    # カテゴリを抽出
                    if line.startswith('■'):
                        if 'サイズ異常' in line:
                            current_category = 'small'
                        elif '未来のレースID' in line:
                            current_category = 'future'
                        elif 'エラーページ' in line:
                            current_category = 'error'
                        continue

                    # ファイル情報を抽出
                    if line.startswith('- ') and current_dir and current_category:
                        file_info = line[2:].strip()

                        # ファイル名とレースIDを抽出
                        parts = file_info.split(':')
                        if len(parts) >= 2:
                            file_name = parts[0].strip()
                            reason = ':'.join(parts[1:]).strip()

                            race_id_match = re.search(r'(\d{12})', file_name)
                            race_id = race_id_match.group(1) if race_id_match else None

                            item = {
                                'file': file_name,
                                'dir': current_dir,
                                'reason': reason
                            }

                            if race_id:
                                item['race_id'] = race_id

                            self.failed_files[current_category].append(item)

                            # レースIDをセットに追加
                            if current_category == 'future' and race_id:
                                self.race_ids_to_exclude.add(race_id)
                            elif current_category in ['empty', 'error'] and race_id:
                                self.race_ids_to_redownload.add(race_id)

            print(f"  ✅ 読み込み完了")
            print(f"     - 小ファイル: {len(self.failed_files['small'])} 件")
            print(f"     - 未来ID: {len(self.failed_files['future'])} 件")
            print(f"     - エラー: {len(self.failed_files['error'])} 件")
            return True

        except Exception as e:
            print(f"❌ テキストファイルの読み込みエラー: {e}")
            return False

    def list_files(self, categories: List[str] = None):
        """失敗ファイルをリスト表示"""
        print("\n" + "=" * 80)
        print("📋 失敗ファイル一覧")
        print("=" * 80)

        if categories is None:
            categories = ['empty', 'small', 'future', 'error']

        total = 0
        for category in categories:
            files = self.failed_files.get(category, [])
            if not files:
                continue

            category_names = {
                'empty': '空ファイル',
                'small': '小ファイル（1KB未満）',
                'future': '未来のレースID',
                'error': 'エラーページ'
            }

            print(f"\n【{category_names.get(category, category)}】 {len(files)} 件")
            print("-" * 80)

            for i, item in enumerate(files[:50], 1):  # 最大50件表示
                print(f"{i:3d}. {item['file']}")
                if 'reason' in item:
                    print(f"     理由: {item['reason']}")
                if 'error_type' in item:
                    print(f"     エラー: {item['error_type']}")

            if len(files) > 50:
                print(f"\n     ... 他 {len(files) - 50} 件")

            total += len(files)

        print("\n" + "=" * 80)
        print(f"総計: {total} 件")

    def delete_files(self, categories: List[str] = None, dry_run: bool = True):
        """失敗ファイルを削除"""
        print("\n" + "=" * 80)
        print("🗑️  失敗ファイル削除" + (" (DRY RUN)" if dry_run else ""))
        print("=" * 80)

        if not self.html_base_dir:
            print("❌ --html-dir オプションが必要です")
            return

        if categories is None:
            categories = ['empty', 'error']  # デフォルトは空とエラーのみ

        deleted_count = 0
        error_count = 0

        for category in categories:
            files = self.failed_files.get(category, [])
            if not files:
                continue

            print(f"\n【{category}】 {len(files)} 件を削除中...")

            for item in files:
                file_path = self.html_base_dir / item['dir'] / item['file']

                if not file_path.exists():
                    print(f"  ⚠️  ファイルが見つかりません: {file_path}")
                    error_count += 1
                    continue

                if dry_run:
                    print(f"  [DRY RUN] 削除対象: {file_path}")
                    deleted_count += 1
                else:
                    try:
                        file_path.unlink()
                        print(f"  ✅ 削除: {file_path}")
                        deleted_count += 1
                    except Exception as e:
                        print(f"  ❌ 削除失敗: {file_path} ({e})")
                        error_count += 1

        print("\n" + "=" * 80)
        if dry_run:
            print(f"削除対象: {deleted_count} 件")
            print("\n実際に削除するには --no-dry-run オプションを追加してください")
        else:
            print(f"削除完了: {deleted_count} 件")
            if error_count > 0:
                print(f"削除失敗: {error_count} 件")

    def export_race_ids(self, output_file: str, mode: str = 'exclude'):
        """レースIDリストをエクスポート"""
        print("\n" + "=" * 80)
        print(f"📤 レースIDリストをエクスポート ({mode})")
        print("=" * 80)

        if mode == 'exclude':
            race_ids = sorted(self.race_ids_to_exclude)
            description = "除外すべきレースID（未来のレース）"
        elif mode == 'redownload':
            race_ids = sorted(self.race_ids_to_redownload)
            description = "再ダウンロードすべきレースID（エラー・空ファイル）"
        else:
            print(f"❌ 不明なモード: {mode}")
            return

        output_path = Path(output_file)

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(f"# {description}\n")
            f.write(f"# 生成日時: {datetime.now().isoformat()}\n")
            f.write(f"# 総数: {len(race_ids)}\n")
            f.write("#\n")

            for race_id in race_ids:
                f.write(f"{race_id}\n")

        print(f"✅ {len(race_ids)} 件のレースIDを出力: {output_path}")
        print(f"\n使用例:")
        print(f"  # Python でこのファイルを読み込む")
        print(f"  exclude_ids = set()")
        print(f"  with open('{output_path}', 'r') as f:")
        print(f"      for line in f:")
        print(f"          if not line.startswith('#'):")
        print(f"              exclude_ids.add(line.strip())")


def main():
    """メイン関数"""
    import argparse

    parser = argparse.ArgumentParser(description='失敗ファイル再処理ツール')
    parser.add_argument('--input', '-i', required=True,
                        help='入力ファイル (suspicious_files.txt or error_analysis_report.json)')
    parser.add_argument('--html-dir', help='HTMLディレクトリのベースパス（削除モード時に必要）')
    parser.add_argument('--mode', '-m', choices=['list', 'delete', 'export'], default='list',
                        help='動作モード (list: リスト表示, delete: 削除, export: レースIDエクスポート)')
    parser.add_argument('--category', '-c', help='対象カテゴリ（カンマ区切り: empty,small,future,error）')
    parser.add_argument('--output', '-o', help='出力ファイル名（exportモード時）', default='race_ids_to_exclude.txt')
    parser.add_argument('--no-dry-run', action='store_true', help='削除を実行（デフォルトはdry-run）')
    parser.add_argument('--export-mode', choices=['exclude', 'redownload'], default='exclude',
                        help='エクスポートモード (exclude: 除外リスト, redownload: 再ダウンロードリスト)')

    args = parser.parse_args()

    if not args.input:
        print("❌ --input オプションが必要です")
        sys.exit(1)

    # ReprocessManager のインスタンス作成
    manager = ReprocessManager(args.input, args.html_dir)

    # ファイル読み込み
    if args.input.endswith('.json'):
        success = manager.load_from_json()
    else:
        success = manager.load_from_txt()

    if not success:
        sys.exit(1)

    # カテゴリ解析
    categories = None
    if args.category:
        categories = [c.strip() for c in args.category.split(',')]

    # モード別処理
    if args.mode == 'list':
        manager.list_files(categories)

    elif args.mode == 'delete':
        if not args.html_dir:
            print("❌ 削除モードには --html-dir オプションが必要です")
            sys.exit(1)
        manager.delete_files(categories, dry_run=not args.no_dry_run)

    elif args.mode == 'export':
        manager.export_race_ids(args.output, args.export_mode)

    print("\n✅ 処理完了!")


if __name__ == '__main__':
    main()
