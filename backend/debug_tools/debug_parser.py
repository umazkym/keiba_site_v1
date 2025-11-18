#!/usr/bin/env python3
"""
デバッグ用パーサー - 詳細ログ出力機能付きパーサー

使用方法:
    python debug_parser.py <html_file> --type race --race-id 202301010101
    python debug_parser.py <html_file> --type shutuba --race-id 202301010101

例:
    python debug_parser.py C:/path/to/202301010101.bin --type race --race-id 202301010101 --verbose
    python debug_parser.py ./data/html_cache/shutuba/202301010101.bin --type shutuba --race-id 202301010101
"""

import os
import sys
import json
import re
from pathlib import Path
from typing import Optional, Dict, Any
from bs4 import BeautifulSoup
from datetime import datetime
import traceback


class DebugParser:
    """デバッグ出力機能付きパーサー"""

    def __init__(self, file_path: str, html_type: str, race_id: str = None, verbose: bool = False):
        self.file_path = Path(file_path)
        self.html_type = html_type
        self.race_id = race_id or self.file_path.stem
        self.verbose = verbose
        self.debug_info = {
            'file_path': str(self.file_path),
            'race_id': self.race_id,
            'html_type': html_type,
            'steps': [],
            'errors': [],
            'warnings': [],
            'extracted_data': {}
        }

    def log(self, message: str, level: str = 'INFO', data: Any = None):
        """ログを記録"""
        step = {
            'level': level,
            'message': message,
            'timestamp': datetime.now().isoformat()
        }

        if data is not None:
            step['data'] = data

        self.debug_info['steps'].append(step)

        # コンソール出力
        icons = {'INFO': 'ℹ️', 'SUCCESS': '✅', 'WARNING': '⚠️', 'ERROR': '❌', 'DEBUG': '🔍'}
        icon = icons.get(level, 'ℹ️')

        if level == 'DEBUG' and not self.verbose:
            return  # verbose モードでない場合は DEBUG は出力しない

        print(f"{icon}  {message}")

        if self.verbose and data is not None:
            if isinstance(data, (dict, list)):
                print(f"    データ: {json.dumps(data, ensure_ascii=False, indent=2)}")
            else:
                print(f"    データ: {data}")

    def parse(self) -> Dict[str, Any]:
        """パースを実行"""
        print("=" * 80)
        print("🔍 デバッグパーサー")
        print("=" * 80)
        print(f"📄 ファイル: {self.file_path}")
        print(f"🏷️  タイプ: {self.html_type}")
        print(f"🆔 レースID: {self.race_id}")
        print()

        # ファイル読み込み
        self.log("HTMLファイルを読み込み中...", 'INFO')

        if not self.file_path.exists():
            self.log(f"ファイルが存在しません: {self.file_path}", 'ERROR')
            return self.debug_info

        file_size = self.file_path.stat().st_size
        self.log(f"ファイルサイズ: {file_size:,} bytes", 'INFO', file_size)

        if file_size == 0:
            self.log("空ファイルです", 'ERROR')
            self.debug_info['errors'].append("Empty file")
            return self.debug_info

        try:
            with open(self.file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            self.log(f"ファイル読み込み成功: {len(content):,} 文字", 'SUCCESS', len(content))
        except Exception as e:
            self.log(f"ファイル読み込みエラー: {e}", 'ERROR')
            self.debug_info['errors'].append(str(e))
            return self.debug_info

        # BeautifulSoup でパース
        self.log("BeautifulSoup でHTML解析中...", 'INFO')
        try:
            soup = BeautifulSoup(content, 'lxml')
            self.log("HTML解析成功", 'SUCCESS', {'total_tags': len(soup.find_all())})
        except Exception as e:
            self.log(f"HTML解析エラー: {e}", 'ERROR')
            self.debug_info['errors'].append(str(e))
            return self.debug_info

        # タイプ別パース
        if self.html_type == 'race':
            self._parse_race_result(soup, content)
        elif self.html_type == 'shutuba':
            self._parse_shutuba(soup, content)
        elif self.html_type == 'horse':
            self._parse_horse(soup, content)
        else:
            self.log(f"不明なHTMLタイプ: {self.html_type}", 'ERROR')

        # サマリー
        print("\n" + "=" * 80)
        print("📊 パース結果サマリー")
        print("=" * 80)
        print(f"成功ステップ: {len([s for s in self.debug_info['steps'] if s['level'] == 'SUCCESS'])}")
        print(f"警告: {len(self.debug_info['warnings'])}")
        print(f"エラー: {len(self.debug_info['errors'])}")

        return self.debug_info

    def _parse_race_result(self, soup: BeautifulSoup, content: str):
        """レース結果をパース（詳細ログ付き）"""
        self.log("=== レース結果パース開始 ===", 'INFO')

        # ステップ1: レース中止チェック
        self.log("【ステップ1】レース中止チェック", 'DEBUG')
        info_box = soup.select_one(".Race_Infomation_Box")
        if info_box:
            info_text = info_box.get_text()
            self.log(f"情報ボックス発見: {info_text[:100]}", 'DEBUG', info_text)
            if "中止" in info_text or "取り止め" in info_text:
                self.log("レースが中止されています", 'WARNING')
                self.debug_info['warnings'].append("Race cancelled")
                self.debug_info['extracted_data']['cancelled'] = True
                return
        else:
            self.log("情報ボックスなし（通常レース）", 'DEBUG')

        # ステップ2: レース名の取得
        self.log("【ステップ2】レース名の取得", 'DEBUG')
        race_header = soup.select_one("div.db_head") or soup.select_one(".RaceList_NameBox")
        if race_header:
            self.log("レースヘッダー発見", 'DEBUG')
            race_name_elm = race_header.select_one("h1") or race_header.select_one(".RaceName")
            if race_name_elm:
                race_name = race_name_elm.get_text(strip=True)
                self.log(f"レース名取得成功: {race_name}", 'SUCCESS', race_name)
                self.debug_info['extracted_data']['race_name'] = race_name
            else:
                self.log("レース名要素が見つかりません", 'WARNING')
                self.debug_info['warnings'].append("Race name element not found")
        else:
            self.log("レースヘッダーが見つかりません", 'WARNING')
            self.debug_info['warnings'].append("Race header not found")

        # ステップ3: 日付の取得
        self.log("【ステップ3】日付の取得", 'DEBUG')
        date_match = re.search(r'(\d{4})年(\d{1,2})月(\d{1,2})日', content)
        if date_match:
            date_str = f"{date_match.group(1)}-{date_match.group(2).zfill(2)}-{date_match.group(3).zfill(2)}"
            self.log(f"日付取得成功: {date_str}", 'SUCCESS', date_str)
            self.debug_info['extracted_data']['race_date'] = date_str
        else:
            self.log("日付が見つかりません", 'WARNING')
            self.debug_info['warnings'].append("Race date not found in HTML")

        # ステップ4: コース情報の取得
        self.log("【ステップ4】コース情報の取得", 'DEBUG')
        race_data_elements = soup.select(".RaceData01, .RaceData02, .diary_snap span")
        if race_data_elements:
            race_data_text = " ".join([e.get_text(strip=True, separator=' ') for e in race_data_elements])
            self.log(f"レースデータテキスト: {race_data_text[:200]}", 'DEBUG', race_data_text)

            # コースタイプと距離
            m_course = re.search(r'(芝|ダ|障).*?(\d+)m', race_data_text)
            if m_course:
                course_info = f"{m_course.group(1)}{m_course.group(2)}m"
                self.log(f"コース情報取得成功: {course_info}", 'SUCCESS', {
                    'course_type': m_course.group(1),
                    'distance': int(m_course.group(2))
                })
                self.debug_info['extracted_data']['course_type'] = m_course.group(1)
                self.debug_info['extracted_data']['distance'] = int(m_course.group(2))
            else:
                self.log("コース情報が見つかりません", 'WARNING')
                self.debug_info['warnings'].append("Course info not found")

            # 天候
            m_weather = re.search(r'天候\s*:\s*([^/\s]+)', race_data_text)
            if m_weather:
                weather = m_weather.group(1).strip().rstrip('/')
                self.log(f"天候取得成功: {weather}", 'SUCCESS', weather)
                self.debug_info['extracted_data']['weather'] = weather

            # 馬場状態
            m_ground = re.search(r'(?:芝|ダ)\s*:\s*([^/\s]+)|馬場\s*:\s*([^/\s]+)', race_data_text)
            if m_ground:
                ground_condition = next((g for g in m_ground.groups() if g is not None), None)
                if ground_condition:
                    self.log(f"馬場状態取得成功: {ground_condition}", 'SUCCESS', ground_condition)
                    self.debug_info['extracted_data']['ground_condition'] = ground_condition.strip().rstrip('/')
        else:
            self.log("レースデータ要素が見つかりません", 'WARNING')

        # ステップ5: 結果テーブルの取得
        self.log("【ステップ5】結果テーブルの取得", 'DEBUG')
        result_table = soup.find("table", class_=re.compile(r"race_table_01|RaceTable01"))
        if result_table:
            rows = result_table.find_all('tr')
            header_row = rows[0] if rows else None
            data_rows = rows[1:] if len(rows) > 1 else []

            self.log(f"結果テーブル発見: {len(data_rows)} 頭", 'SUCCESS', {
                'total_rows': len(rows),
                'data_rows': len(data_rows)
            })

            if header_row:
                headers = [th.get_text(strip=True) for th in header_row.find_all(['th', 'td'])]
                self.log(f"テーブルヘッダー: {headers}", 'DEBUG', headers)

            if not data_rows:
                self.log("データ行が見つかりません（未確定レースの可能性）", 'WARNING')
                self.debug_info['warnings'].append("No data rows in result table")
            else:
                self.debug_info['extracted_data']['total_horses'] = len(data_rows)

                # 最初の1行だけ詳細解析（サンプル）
                if self.verbose and len(data_rows) > 0:
                    first_row = data_rows[0]
                    cols = first_row.find_all(['td', 'th'])
                    self.log(f"1行目のカラム数: {len(cols)}", 'DEBUG')
                    for i, col in enumerate(cols):
                        self.log(f"  カラム{i}: {col.get_text(strip=True)[:50]}", 'DEBUG')

        else:
            self.log("結果テーブルが見つかりません", 'ERROR')
            self.debug_info['errors'].append("Result table not found")

            # 代替方法を試す
            self.log("代替方法: すべてのテーブルを検索", 'DEBUG')
            all_tables = soup.find_all('table')
            self.log(f"総テーブル数: {len(all_tables)}", 'DEBUG', len(all_tables))

            for i, table in enumerate(all_tables):
                class_attr = table.get('class', [])
                id_attr = table.get('id', '')
                self.log(f"  テーブル{i}: class={class_attr}, id={id_attr}", 'DEBUG')

    def _parse_shutuba(self, soup: BeautifulSoup, content: str):
        """出馬表をパース（詳細ログ付き）"""
        self.log("=== 出馬表パース開始 ===", 'INFO')

        # ステップ1: レース名の取得
        self.log("【ステップ1】レース名の取得", 'DEBUG')
        h1_elms = soup.find_all("h1")
        race_name = None
        for i, h1 in enumerate(h1_elms):
            text = h1.get_text(strip=True)
            self.log(f"h1タグ {i}: {text}", 'DEBUG', text)
            if text and len(text) > 2:
                race_name = text
                self.log(f"レース名取得成功: {race_name}", 'SUCCESS', race_name)
                self.debug_info['extracted_data']['race_name'] = race_name
                break

        if not race_name:
            self.log("レース名が見つかりません", 'WARNING')

        # ステップ2: 日付の取得
        self.log("【ステップ2】日付の取得", 'DEBUG')
        date_match = re.search(r'(\d{4})年(\d{1,2})月(\d{1,2})日', content)
        if date_match:
            date_str = f"{date_match.group(1)}-{date_match.group(2).zfill(2)}-{date_match.group(3).zfill(2)}"
            self.log(f"日付取得成功: {date_str}", 'SUCCESS', date_str)
            self.debug_info['extracted_data']['race_date'] = date_str
        else:
            self.log("日付が見つかりません", 'WARNING')

        # ステップ3: 出馬表テーブルの取得
        self.log("【ステップ3】出馬表テーブルの取得", 'DEBUG')
        shutuba_table = soup.find("table", class_=re.compile(r"Shutuba_Table|RaceTable0[12]|race_table_01", re.IGNORECASE))

        if shutuba_table:
            rows = shutuba_table.find_all("tr")
            horse_rows = [row for row in rows if row.find('td', class_=re.compile("HorseInfo|HorseList"))]

            self.log(f"出馬表テーブル発見: {len(horse_rows)} 頭", 'SUCCESS', {
                'total_rows': len(rows),
                'horse_rows': len(horse_rows)
            })
            self.debug_info['extracted_data']['total_horses'] = len(horse_rows)

        else:
            self.log("出馬表テーブルが見つかりません", 'ERROR')
            self.debug_info['errors'].append("Shutuba table not found")

            # 代替方法
            self.log("代替方法: すべてのテーブルを検索", 'DEBUG')
            all_tables = soup.find_all('table')
            self.log(f"総テーブル数: {len(all_tables)}", 'DEBUG', len(all_tables))

    def _parse_horse(self, soup: BeautifulSoup, content: str):
        """馬プロフィールをパース（詳細ログ付き）"""
        self.log("=== 馬プロフィールパース開始 ===", 'INFO')

        # ステップ1: 馬名の取得
        self.log("【ステップ1】馬名の取得", 'DEBUG')
        horse_title_div = soup.find('div', class_='horse_title')
        if horse_title_div:
            h1 = horse_title_div.find('h1')
            if h1:
                horse_name = h1.get_text(strip=True)
                self.log(f"馬名取得成功: {horse_name}", 'SUCCESS', horse_name)
                self.debug_info['extracted_data']['horse_name'] = horse_name
        else:
            self.log("馬名が見つかりません", 'WARNING')

        # ステップ2: 成績テーブルの取得
        self.log("【ステップ2】成績テーブルの取得", 'DEBUG')
        results_table = soup.find('table', class_=re.compile("db_h_race_results|race_table_01"))
        if results_table:
            rows = results_table.find_all('tr')[1:]  # ヘッダー除く
            self.log(f"成績テーブル発見: {len(rows)} レース", 'SUCCESS', len(rows))
            self.debug_info['extracted_data']['race_count'] = len(rows)
        else:
            self.log("成績テーブルが見つかりません（新馬の可能性）", 'WARNING')

    def export_report(self, output_file: str = 'debug_parse_report.json'):
        """デバッグレポートをJSON出力"""
        output_path = Path(output_file)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(self.debug_info, f, ensure_ascii=False, indent=2)
        print(f"\n💾 デバッグレポートを出力: {output_path}")


def main():
    """メイン関数"""
    import argparse

    parser = argparse.ArgumentParser(description='デバッグ用パーサー')
    parser.add_argument('file', help='HTMLファイルのパス')
    parser.add_argument('--type', '-t', choices=['race', 'shutuba', 'horse'], required=True,
                        help='HTMLのタイプ')
    parser.add_argument('--race-id', help='レースID（省略時はファイル名から推測）')
    parser.add_argument('--verbose', '-v', action='store_true', help='詳細出力モード')
    parser.add_argument('--output', '-o', help='デバッグレポートの出力先', default='debug_parse_report.json')

    args = parser.parse_args()

    if not os.path.exists(args.file):
        print(f"❌ ファイルが見つかりません: {args.file}")
        sys.exit(1)

    # パース実行
    parser = DebugParser(args.file, args.type, args.race_id, args.verbose)
    results = parser.parse()

    # レポート出力
    parser.export_report(args.output)

    # 終了コード
    sys.exit(0 if not results['errors'] else 1)


if __name__ == '__main__':
    main()
