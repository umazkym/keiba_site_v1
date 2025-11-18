#!/usr/bin/env python3
"""
HTML検証ツール - 個別HTMLファイルの詳細調査

使用方法:
    python html_validator.py <html_file> [--type race|shutuba|horse]
    python html_validator.py <race_id> --type race --html-dir ./data/html_cache

例:
    python html_validator.py 202301010101 --type race --html-dir C:/Users/zk-ht/Keiba/Keiba_AI_v2/keibaai/data/raw/html
    python html_validator.py ./data/html_cache/race/202301010101.bin --verbose
"""

import os
import sys
import re
from pathlib import Path
from typing import Optional, Dict, Any
from bs4 import BeautifulSoup
import json


class HTMLValidator:
    """HTMLファイルを検証・分析するクラス"""

    def __init__(self, file_path: str, html_type: Optional[str] = None, verbose: bool = False):
        self.file_path = Path(file_path)
        self.html_type = html_type
        self.verbose = verbose
        self.results = {
            'file_path': str(self.file_path),
            'file_size': 0,
            'html_type': html_type,
            'is_valid': False,
            'errors': [],
            'warnings': [],
            'info': {},
            'structure': {}
        }

    def validate(self) -> Dict[str, Any]:
        """HTMLファイルを検証"""
        print("=" * 80)
        print("🔍 HTML検証ツール")
        print("=" * 80)
        print(f"📄 ファイル: {self.file_path}")
        print()

        # ファイル存在チェック
        if not self.file_path.exists():
            self.results['errors'].append(f"ファイルが存在しません: {self.file_path}")
            print(f"❌ {self.results['errors'][-1]}")
            return self.results

        # ファイルサイズチェック
        self.results['file_size'] = self.file_path.stat().st_size
        print(f"📊 ファイルサイズ: {self.results['file_size']:,} bytes")

        if self.results['file_size'] == 0:
            self.results['errors'].append("空ファイルです")
            print(f"❌ {self.results['errors'][-1]}")
            return self.results

        if self.results['file_size'] < 100:
            self.results['warnings'].append(f"ファイルサイズが小さすぎます ({self.results['file_size']} bytes)")
            print(f"⚠️  {self.results['warnings'][-1]}")

        # HTMLを読み込み
        try:
            with open(self.file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
        except Exception as e:
            self.results['errors'].append(f"ファイル読み込みエラー: {e}")
            print(f"❌ {self.results['errors'][-1]}")
            return self.results

        # エラーパターンチェック
        self._check_error_patterns(content)

        # HTML構造を解析
        self._analyze_html_structure(content)

        # タイプ別検証
        if self.html_type == 'race':
            self._validate_race_result(content)
        elif self.html_type == 'shutuba':
            self._validate_shutuba(content)
        elif self.html_type == 'horse':
            self._validate_horse(content)

        # 総合判定
        if not self.results['errors']:
            self.results['is_valid'] = True
            print("\n✅ 検証完了: 問題は検出されませんでした")
        else:
            print(f"\n❌ 検証完了: {len(self.results['errors'])} 個のエラーが検出されました")

        return self.results

    def _check_error_patterns(self, content: str):
        """エラーパターンをチェック"""
        print("\n【エラーパターンチェック】")

        error_patterns = [
            (r'404|Not Found', '404エラー（ページが見つかりません）'),
            (r'403|Forbidden|Access Denied', '403エラー（アクセス拒否）'),
            (r'400|Bad Request', '400エラー（不正なリクエスト）'),
            (r'500|Internal Server Error', '500エラー（サーバーエラー）'),
            (r'503|Service Unavailable', '503エラー（サービス利用不可）'),
            (r'IP.*(?:ban|block)', 'IP BAN の可能性'),
            (r'Too Many Requests', 'リクエスト過多（429エラー）'),
            (r'レースが中止', 'レース中止'),
            (r'該当するデータがありません', 'データなし'),
        ]

        found_errors = []
        for pattern, description in error_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                found_errors.append(description)
                self.results['errors'].append(description)
                print(f"  ❌ {description}")

        if not found_errors:
            print("  ✅ エラーパターンは検出されませんでした")

    def _analyze_html_structure(self, content: str):
        """HTML構造を解析"""
        print("\n【HTML構造解析】")

        try:
            soup = BeautifulSoup(content, 'lxml')

            # 基本構造
            structure = {
                'has_html_tag': bool(soup.find('html')),
                'has_head': bool(soup.find('head')),
                'has_body': bool(soup.find('body')),
                'title': soup.find('title').get_text(strip=True) if soup.find('title') else None,
                'total_tags': len(soup.find_all()),
                'tables': len(soup.find_all('table')),
                'divs': len(soup.find_all('div')),
                'links': len(soup.find_all('a')),
            }

            self.results['structure'] = structure

            print(f"  HTMLタグ: {'✅' if structure['has_html_tag'] else '❌'}")
            print(f"  BODYタグ: {'✅' if structure['has_body'] else '❌'}")
            print(f"  タイトル: {structure['title'] or '(なし)'}")
            print(f"  総タグ数: {structure['total_tags']}")
            print(f"  テーブル数: {structure['tables']}")
            print(f"  リンク数: {structure['links']}")

            # タグ数が少なすぎる場合は警告
            if structure['total_tags'] < 10:
                warning = f"HTMLタグ数が少なすぎます ({structure['total_tags']} 個)"
                self.results['warnings'].append(warning)
                print(f"  ⚠️  {warning}")

        except Exception as e:
            error = f"HTML構造解析エラー: {e}"
            self.results['errors'].append(error)
            print(f"  ❌ {error}")

    def _validate_race_result(self, content: str):
        """レース結果HTMLを検証"""
        print("\n【レース結果 特有の検証】")

        soup = BeautifulSoup(content, 'lxml')
        info = {}

        # レース名
        race_name_elm = soup.select_one("div.db_head h1, .RaceName")
        if race_name_elm:
            info['race_name'] = race_name_elm.get_text(strip=True)
            print(f"  ✅ レース名: {info['race_name']}")
        else:
            warning = "レース名が見つかりません"
            self.results['warnings'].append(warning)
            print(f"  ⚠️  {warning}")

        # 日付
        date_match = re.search(r'(\d{4})年(\d{1,2})月(\d{1,2})日', content)
        if date_match:
            info['date'] = f"{date_match.group(1)}-{date_match.group(2).zfill(2)}-{date_match.group(3).zfill(2)}"
            print(f"  ✅ 日付: {info['date']}")
        else:
            warning = "日付が見つかりません"
            self.results['warnings'].append(warning)
            print(f"  ⚠️  {warning}")

        # 結果テーブル
        result_table = soup.find("table", class_=re.compile(r"race_table_01|RaceTable01"))
        if result_table:
            rows = result_table.find_all('tr')
            info['result_rows'] = len(rows) - 1  # ヘッダー除く
            print(f"  ✅ 結果テーブル: {info['result_rows']} 頭")
        else:
            error = "結果テーブルが見つかりません"
            self.results['errors'].append(error)
            print(f"  ❌ {error}")

        # コース情報
        course_match = re.search(r'(芝|ダ|障).*?(\d+)m', content)
        if course_match:
            info['course'] = f"{course_match.group(1)}{course_match.group(2)}m"
            print(f"  ✅ コース: {info['course']}")
        else:
            warning = "コース情報が見つかりません"
            self.results['warnings'].append(warning)
            print(f"  ⚠️  {warning}")

        self.results['info']['race_result'] = info

    def _validate_shutuba(self, content: str):
        """出馬表HTMLを検証"""
        print("\n【出馬表 特有の検証】")

        soup = BeautifulSoup(content, 'lxml')
        info = {}

        # レース名
        race_name_elm = soup.find("h1")
        if race_name_elm:
            info['race_name'] = race_name_elm.get_text(strip=True)
            print(f"  ✅ レース名: {info['race_name']}")
        else:
            warning = "レース名が見つかりません"
            self.results['warnings'].append(warning)
            print(f"  ⚠️  {warning}")

        # 出馬表テーブル
        shutuba_table = soup.find("table", class_=re.compile(r"Shutuba_Table|RaceTable0[12]"))
        if shutuba_table:
            rows = [row for row in shutuba_table.find_all("tr")
                    if row.find('td', class_=re.compile("HorseInfo|HorseList"))]
            info['horse_count'] = len(rows)
            print(f"  ✅ 出馬表テーブル: {info['horse_count']} 頭")
        else:
            error = "出馬表テーブルが見つかりません"
            self.results['errors'].append(error)
            print(f"  ❌ {error}")

        self.results['info']['shutuba'] = info

    def _validate_horse(self, content: str):
        """馬プロフィールHTMLを検証"""
        print("\n【馬プロフィール 特有の検証】")

        soup = BeautifulSoup(content, 'lxml')
        info = {}

        # 馬名
        horse_title_div = soup.find('div', class_='horse_title')
        if horse_title_div:
            h1 = horse_title_div.find('h1')
            if h1:
                info['horse_name'] = h1.get_text(strip=True)
                print(f"  ✅ 馬名: {info['horse_name']}")
        else:
            warning = "馬名が見つかりません"
            self.results['warnings'].append(warning)
            print(f"  ⚠️  {warning}")

        # 成績テーブル
        results_table = soup.find('table', class_=re.compile("db_h_race_results|race_table_01"))
        if results_table:
            rows = results_table.find_all('tr')[1:]  # ヘッダー除く
            info['race_count'] = len(rows)
            print(f"  ✅ 成績テーブル: {info['race_count']} レース")
        else:
            warning = "成績テーブルが見つかりません（新馬の可能性）"
            self.results['warnings'].append(warning)
            print(f"  ⚠️  {warning}")

        self.results['info']['horse'] = info

    def print_content_preview(self, lines: int = 20):
        """ファイル内容のプレビューを表示"""
        print("\n" + "=" * 80)
        print(f"📄 ファイル内容プレビュー（最初の{lines}行）")
        print("=" * 80)

        try:
            with open(self.file_path, 'r', encoding='utf-8', errors='ignore') as f:
                for i, line in enumerate(f, 1):
                    if i > lines:
                        break
                    print(f"{i:4d}: {line.rstrip()}")
        except Exception as e:
            print(f"❌ プレビュー表示エラー: {e}")

    def export_report(self, output_file: str = 'html_validation_report.json'):
        """検証結果をJSONで出力"""
        output_path = Path(output_file)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, ensure_ascii=False, indent=2)
        print(f"\n💾 検証レポートを出力: {output_path}")


def main():
    """メイン関数"""
    import argparse

    parser = argparse.ArgumentParser(description='HTML検証ツール')
    parser.add_argument('file', help='HTMLファイルのパス または レースID')
    parser.add_argument('--type', '-t', choices=['race', 'shutuba', 'horse'],
                        help='HTMLのタイプ（race: レース結果, shutuba: 出馬表, horse: 馬プロフィール）')
    parser.add_argument('--html-dir', help='HTMLディレクトリのベースパス（レースIDを指定した場合に使用）')
    parser.add_argument('--verbose', '-v', action='store_true', help='詳細表示')
    parser.add_argument('--preview', '-p', type=int, default=0, help='ファイル内容のプレビュー行数')
    parser.add_argument('--output', '-o', help='検証結果をJSONで出力', default='html_validation_report.json')

    args = parser.parse_args()

    # ファイルパスの解決
    file_path = args.file

    # レースIDが指定された場合、ファイルパスを構築
    if re.match(r'^\d{12}$', args.file):
        if not args.html_dir:
            print("❌ --html-dir オプションが必要です（レースIDを指定した場合）")
            sys.exit(1)

        if not args.type:
            print("❌ --type オプションが必要です（レースIDを指定した場合）")
            sys.exit(1)

        race_id = args.file
        html_dir = Path(args.html_dir)

        if args.type == 'race':
            file_path = html_dir / 'race' / f'{race_id}.bin'
        elif args.type == 'shutuba':
            file_path = html_dir / 'shutuba' / f'{race_id}.bin'
        else:
            print(f"❌ --type '{args.type}' はレースID指定時に使用できません")
            sys.exit(1)

    # 検証実行
    validator = HTMLValidator(file_path, args.type, args.verbose)
    results = validator.validate()

    # プレビュー表示
    if args.preview > 0:
        validator.print_content_preview(args.preview)

    # レポート出力
    validator.export_report(args.output)

    # 終了コード
    sys.exit(0 if results['is_valid'] else 1)


if __name__ == '__main__':
    main()
