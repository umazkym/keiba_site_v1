import os
import sys
import psycopg2
from psycopg2 import sql
from dotenv import load_dotenv
from datetime import datetime

# .envファイルから環境変数を読み込む
load_dotenv()

# --- 設定 ---
# データベース接続URLを環境変数から取得
DATABASE_URL = "postgresql://keiba_db_user:XTme6b9rg87c6POChTgQlBFgV0NQJV8a@dpg-d1gd9ajipnbc73aj1nlg-a.oregon-postgres.render.com/keiba_db"
# 出力するデータの上限行数（matchupsテーブル以外に適用）
ROW_LIMIT = 100
# 出力ファイル名
OUTPUT_FILE = f"db_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
# 対象とするスキーマ
TARGET_SCHEMA = "public"


def get_all_tables(cursor):
    """指定されたスキーマ内のすべてのテーブル名を取得する"""
    print(f"'{TARGET_SCHEMA}'スキーマからテーブル一覧を取得しています...")
    query = sql.SQL(
        """
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = %s
        ORDER BY table_name;
    """
    )
    try:
        cursor.execute(query, (TARGET_SCHEMA,))
        tables = [row[0] for row in cursor.fetchall()]
        print(f"{len(tables)}個のテーブルが見つかりました。")
        return tables
    except Exception as e:
        print(f"エラー: テーブル一覧の取得に失敗しました。\n{e}", file=sys.stderr)
        return []

def get_primary_key(cursor, schema, table_name):
    """テーブルの主キーとなるカラム名を取得する"""
    query = sql.SQL("""
        SELECT kcu.column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = %s AND tc.table_name = %s;
    """)
    try:
        cursor.execute(query, (schema, table_name))
        result = cursor.fetchone()
        if result:
            return result[0]
        else:
            # 主キーが見つからない場合、フォールバックとして最初の列を返す
            print(f"警告: テーブル '{table_name}' に主キーが見つかりません。", file=sys.stderr)
            fallback_query = sql.SQL("""
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = %s AND table_name = %s
                ORDER BY ordinal_position LIMIT 1
            """)
            cursor.execute(fallback_query, (schema, table_name))
            fallback_result = cursor.fetchone()
            if fallback_result:
                print(f"フォールバックとして最初の列 '{fallback_result[0]}' をソートキーに使用します。", file=sys.stderr)
                return fallback_result[0]
            return None
    except Exception as e:
        print(f"エラー: 主キーの取得中にエラーが発生しました。\n{e}", file=sys.stderr)
        return None

def get_table_data(cursor, table_name):
    """
    指定されたテーブルの列名とデータを取得する。
    'matchups'テーブルの場合は特別な処理を行う。
    戻り値: (columns, data, total_rows, needs_omission_mark)
    """
    print(f"テーブル'{table_name}'のデータを取得しています...")
    try:
        # 列名を取得
        columns_query = sql.SQL(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position;
        """
        )
        cursor.execute(columns_query, (TARGET_SCHEMA, table_name))
        columns = [row[0] for row in cursor.fetchall()]

        # 'matchups'テーブルの場合の特別処理
        if table_name == 'matchups':
            print(f"テーブル'{table_name}'の特別処理を実行しています...")
            # 総行数を取得
            count_query = sql.SQL("SELECT COUNT(*) FROM {}.{}").format(
                sql.Identifier(TARGET_SCHEMA), sql.Identifier(table_name)
            )
            cursor.execute(count_query)
            total_rows = cursor.fetchone()[0]

            # 行数が2行以下なら、全件取得して中略なしで返す
            if total_rows <= 2:
                data_query = sql.SQL("SELECT * FROM {}.{}").format(
                    sql.Identifier(TARGET_SCHEMA), sql.Identifier(table_name)
                )
                cursor.execute(data_query)
                data = cursor.fetchall()
                return columns, data, total_rows, False # 中略不要

            # ソートキーとなる主キーを取得
            sort_key = get_primary_key(cursor, TARGET_SCHEMA, table_name)
            if not sort_key:
                print(f"警告: '{table_name}'のソートキーが見つからないため、通常のLIMIT処理にフォールバックします。", file=sys.stderr)
                # フォールバックして通常のLIMIT処理へ
                data_query = sql.SQL("SELECT * FROM {}.{} LIMIT %s;").format(
                    sql.Identifier(TARGET_SCHEMA), sql.Identifier(table_name)
                )
                cursor.execute(data_query, (ROW_LIMIT,))
                data = cursor.fetchall()
                return columns, data, total_rows, False

            # 主キーを使って最初と最後の行を取得
            first_row_query = sql.SQL("(SELECT * FROM {}.{} ORDER BY {} ASC LIMIT 1)").format(
                sql.Identifier(TARGET_SCHEMA), sql.Identifier(table_name), sql.Identifier(sort_key)
            )
            last_row_query = sql.SQL("(SELECT * FROM {}.{} ORDER BY {} DESC LIMIT 1)").format(
                sql.Identifier(TARGET_SCHEMA), sql.Identifier(table_name), sql.Identifier(sort_key)
            )
            query = sql.SQL(" UNION ALL ").join([first_row_query, last_row_query])
            cursor.execute(query)
            data = cursor.fetchall() # [最初の行, 最後の行]
            return columns, data, total_rows, True # 中略必要

        # 'matchups'以外のテーブルは、従来通りLIMITで取得
        data_query = sql.SQL("SELECT * FROM {}.{} LIMIT %s;").format(
            sql.Identifier(TARGET_SCHEMA), sql.Identifier(table_name)
        )
        cursor.execute(data_query, (ROW_LIMIT,))
        data = cursor.fetchall()
        return columns, data, None, False # 総行数不明、中略不要

    except Exception as e:
        print(
            f"エラー: テーブル'{table_name}'のデータ取得に失敗しました。\n{e}",
            file=sys.stderr,
        )
        return None, None, None, False


def main():
    """メイン処理"""
    if not DATABASE_URL:
        print(
            "エラー: 環境変数 'DATABASE_URL' が設定されていません。", file=sys.stderr
        )
        print(
            "スクリプトと同じディレクトリに .env ファイルを作成し、'DATABASE_URL=your_url' を記述してください。",
            file=sys.stderr,
        )
        sys.exit(1)

    conn = None
    try:
        # データベースに接続
        print("データベースに接続しています...")
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        print("接続に成功しました。")

        # 全テーブル名を取得
        tables = get_all_tables(cursor)
        if not tables:
            print("処理対象のテーブルが見つからなかったため、終了します。")
            return

        # ファイルに出力
        print(f"ファイル'{OUTPUT_FILE}'への書き込みを開始します...")
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            f.write(f"Render DB Export\n")
            f.write(f"Exported at: {datetime.now().isoformat()}\n")
            f.write(f"Target Schema: {TARGET_SCHEMA}\n")
            f.write("=" * 80 + "\n\n")

            for table_name in tables:
                f.write(f"Table: {table_name}\n")
                f.write("-" * 80 + "\n")

                columns, data, total_rows, needs_omission = get_table_data(cursor, table_name)

                if columns is None:
                    f.write("  -> データ取得中にエラーが発生しました。\n\n")
                    continue

                # 列名を書き込む
                f.write("Columns:\n")
                f.write(f"  {', '.join(columns)}\n\n")

                # データを書き込む
                if needs_omission:
                    f.write(f"Data (Total: {total_rows} rows, showing first and last):\n")
                    if not data or len(data) < 2:
                        f.write("  -> 表示するデータが不足しています。\n")
                    else:
                        # 1行目
                        row_first = ", ".join(str(item) if item is not None else "NULL" for item in data[0])
                        f.write(f"  {row_first}\n")
                        # 中略
                        f.write("  （中略）\n")
                        # 最後の行
                        row_last = ", ".join(str(item) if item is not None else "NULL" for item in data[1])
                        f.write(f"  {row_last}\n")
                else:
                    # 通常の書き込み処理
                    if total_rows is not None:
                         f.write(f"Data ({total_rows} rows):\n")
                    else:
                         f.write(f"Data (Top {ROW_LIMIT} rows):\n")

                    if not data:
                        f.write("  -> データがありませんでした。\n")
                    else:
                        for row in data:
                            row_str = ", ".join(
                                [
                                    str(item) if item is not None else "NULL"
                                    for item in row
                                ]
                            )
                            f.write(f"  {row_str}\n")
                f.write("\n" + "=" * 80 + "\n\n")
                print(f"  -> テーブル'{table_name}'の処理が完了しました。")

        print(f"\n処理が正常に完了しました。出力ファイル: '{OUTPUT_FILE}'")

    except psycopg2.Error as e:
        print(f"データベース接続エラー: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        # 接続を閉じる
        if conn:
            conn.close()
            print("データベース接続を閉じました。")


if __name__ == "__main__":
    main()