import os
from datetime import datetime

# --- 設定項目 ---

# 無視したいディレクトリ名のリスト
# これらの名前を持つディレクトリは、中身を探索しません。
IGNORE_DIRS = {
    'node_modules',
    '__pycache__',
    '.git',
    '.next',
    '.idea',
    '.vscode',
    'venv',
    '.venv',
    'data',  # scraperが作成するキャッシュディレクトリなども除外
}

# 読み込み対象とするファイルの拡張子リスト
# このリストに含まれる拡張子のファイルのみがテキストファイルとして保存されます。
# 必要に応じて追加・削除してください。
TARGET_EXTENSIONS = {
    '.py', '.tsx', '.ts', '.js', '.jsx', '.css', '.json',
    '.md', '.mjs', '.yaml', '.yml', '.gitignore', '.env.example', '.env'
}

# --- プログラム本体 ---

def is_target_file(file_path: str) -> bool:
    """
    ファイルパスが読み込み対象の拡張子を持つか、
    あるいは特定のファイル名であるかを判定する。
    """
    # まず特定のファイル名と完全一致するかをチェック
    file_name = os.path.basename(file_path)
    if file_name in TARGET_EXTENSIONS:
        return True
    
    # 次に、ファイルの拡張子が対象リストに含まれるかをチェック
    _, ext = os.path.splitext(file_name)
    return ext.lower() in TARGET_EXTENSIONS

def get_all_source_files(src_dir: str) -> list[str]:
    """
    指定されたディレクトリを再帰的に探索し、対象となるファイルのパスリストを返す。
    """
    source_files = []
    for root, dirs, files in os.walk(src_dir, topdown=True):
        # 無視するディレクトリを探索対象から除外する
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]

        for file in files:
            file_path = os.path.join(root, file)
            if is_target_file(file_path):
                source_files.append(file_path)

    return source_files

def save_all_code_to_txt(src_dir: str, output_file: str) -> None:
    """
    ソースコードを収集し、1つのテキストファイルにまとめるメイン関数。
    """
    # 1. ソースディレクトリが存在するかチェック
    if not os.path.isdir(src_dir):
        print(f"エラー: 指定されたディレクトリ '{src_dir}' が存在しません。")
        return

    # 2. 対象となる全ソースファイルのリストを取得
    print(f"'{src_dir}' からソースファイルを収集しています...")
    source_files = get_all_source_files(src_dir)

    if not source_files:
        print("エラー: 対象となるソースファイルが見つかりませんでした。")
        return

    print(f"{len(source_files)} 個のファイルが見つかりました。")

    # 3. 収集したファイルの内容を1つのテキストファイルに書き出す
    try:
        with open(output_file, 'w', encoding='utf-8', errors='ignore') as f:
            # ファイルの先頭に概要を書き込む
            f.write("=" * 80 + "\n")
            f.write(f"ソースコード集約ファイル\n")
            f.write(f"作成日時: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"対象ディレクトリ: {os.path.abspath(src_dir)}\n")
            f.write(f"総ファイル数: {len(source_files)}\n")
            f.write("=" * 80 + "\n\n")
            
            # 各ファイルの内容を書き込む
            for i, file_path in enumerate(source_files):
                relative_path = os.path.relpath(file_path, src_dir)
                print(f"  ({i+1}/{len(source_files)}) 読み込み中: {relative_path}")
                
                # ファイル内容の前にヘッダーを挿入
                f.write("-" * 80 + "\n")
                f.write(f"ファイルパス: {relative_path}\n")
                f.write("-" * 80 + "\n\n")
                
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as src_file:
                        f.write(src_file.read())
                    f.write("\n\n") # ファイルの終わりに改行を追加
                except Exception as e:
                    f.write(f"*** ファイルの読み込み中にエラーが発生しました: {e} ***\n\n")

        print(f"\n処理が完了しました。すべてのソースコードが '{output_file}' に保存されました。")

    except IOError as e:
        print(f"エラー: 出力ファイル '{output_file}' の書き込みに失敗しました: {e}")
    except Exception as e:
        print(f"予期せぬエラーが発生しました: {e}")

if __name__ == '__main__':
    # --- 実行 ---
    
    # ここにソースコードが保存されているフォルダのパスを指定してください。
    # 例: "C:/Users/YourUser/Documents/my_project"
    #     "/home/user/projects/keiba_site_v1"
    #     "."  (このスクリプトと同じ階層にあるフォルダを指定する場合)
    SOURCE_DIRECTORY = '.' # <- ★★★★★ あなたのフォルダパスに変更してください ★★★★★

    # 出力されるテキストファイルの名前
    OUTPUT_FILE = 'all_source_code.txt'

    # 関数を実行
    save_all_code_to_txt(SOURCE_DIRECTORY, OUTPUT_FILE)