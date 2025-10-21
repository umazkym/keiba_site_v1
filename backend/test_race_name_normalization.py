#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
レース名正規化関数のテストスクリプト

テスト内容：
1. parser.py の _normalize_race_name() が期待通りに動作しているか
2. database_loader.py の _normalize_race_name_for_db() が期待通りに動作しているか
"""

import sys
import os

# Windows での UTF-8 出力対応
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

sys.path.insert(0, os.path.dirname(__file__))

from scripts.parser import _normalize_race_name
from scripts.database_loader import _normalize_race_name_for_db

def test_normalize_race_name():
    """レース名正規化関数をテスト"""

    test_cases = [
        # (入力, 期待される出力, 説明)
        ("アルゼンチン共和国杯（G2）", "アルゼンチン共和国杯", "末尾の（G2）を除去"),
        ("東京優駿 日本ダービー（G1）", "東京優駿 日本ダービー", "末尾の（G1）を除去"),
        ("新潟大賞典\n(OP)", "新潟大賞典", "改行と末尾の(OP)を除去"),
        ("天皇賞（春）\t（G1）", "天皇賞（春）", "タブと末尾の（G1）を除去。括弧内の文字は保持"),
        ("シンザン記念  　（G3）", "シンザン記念", "複数の空白と末尾の（G3）を除去"),
        ("レース名", "レース名", "グレード情報がない場合は変更なし"),
        ("  前半木曜　後半  ", "前半木曜 後半", "前後の空白を除去し、複数の空白を統一"),
        (None, "", "None が渡された場合は空文字列を返す"),
        ("", "", "空文字列が渡された場合は空文字列を返す"),
    ]

    print("=" * 70)
    print("レース名正規化テスト")
    print("=" * 70)

    passed = 0
    failed = 0

    for input_val, expected, description in test_cases:
        try:
            result = _normalize_race_name(input_val) if input_val is not None else _normalize_race_name("")

            if result == expected:
                print(f"✓ PASS: {description}")
                print(f"  入力: {repr(input_val)}")
                print(f"  出力: {repr(result)}")
                passed += 1
            else:
                print(f"✗ FAIL: {description}")
                print(f"  入力: {repr(input_val)}")
                print(f"  期待: {repr(expected)}")
                print(f"  実際: {repr(result)}")
                failed += 1
        except Exception as e:
            print(f"✗ ERROR: {description}")
            print(f"  入力: {repr(input_val)}")
            print(f"  エラー: {str(e)}")
            failed += 1
        print()

    print("=" * 70)
    print(f"結果: {passed} 合格, {failed} 不合格")
    print("=" * 70)

    return failed == 0

def test_normalize_race_name_for_db():
    """DB保存用の正規化関数をテスト"""

    test_cases = [
        # (入力, 期待される出力, 説明)
        ("アルゼンチン共和国杯（G2）", "アルゼンチン共和国杯", "末尾の（G2）を除去"),
        ("東京優駿 日本ダービー（G1）", "東京優駿 日本ダービー", "末尾の（G1）を除去"),
        ("新潟大賞典\n(OP)", "新潟大賞典", "改行と末尾の(OP)を除去"),
        (None, "", "None が渡された場合は空文字列を返す"),
        ("", "", "空文字列が渡された場合は空文字列を返す"),
        (123, "", "数字が渡された場合は空文字列を返す"),
    ]

    print("=" * 70)
    print("DB保存用レース名正規化テスト")
    print("=" * 70)

    passed = 0
    failed = 0

    for input_val, expected, description in test_cases:
        try:
            result = _normalize_race_name_for_db(input_val)

            if result == expected:
                print(f"✓ PASS: {description}")
                print(f"  入力: {repr(input_val)}")
                print(f"  出力: {repr(result)}")
                passed += 1
            else:
                print(f"✗ FAIL: {description}")
                print(f"  入力: {repr(input_val)}")
                print(f"  期待: {repr(expected)}")
                print(f"  実際: {repr(result)}")
                failed += 1
        except Exception as e:
            print(f"✗ ERROR: {description}")
            print(f"  入力: {repr(input_val)}")
            print(f"  エラー: {str(e)}")
            failed += 1
        print()

    print("=" * 70)
    print(f"結果: {passed} 合格, {failed} 不合格")
    print("=" * 70)

    return failed == 0

if __name__ == "__main__":
    test1_passed = test_normalize_race_name()
    print()
    test2_passed = test_normalize_race_name_for_db()

    if test1_passed and test2_passed:
        print("\n🎉 すべてのテストに合格しました!")
        sys.exit(0)
    else:
        print("\n❌ 一部のテストが失敗しました")
        sys.exit(1)
