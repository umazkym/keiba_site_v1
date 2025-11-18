# 競馬データ デバッグツールキット

スクレイピング・パースのエラーを効率的にデバッグし、再処理するためのツール集です。

## 📦 ツール一覧

### 1. エラー分析ツール (`error_analyzer.py`)

HTMLファイルを一括分析し、問題のあるファイルを特定します。

**機能:**
- 空ファイル・小さいファイルの検出
- 未来のレースIDの検出
- エラーページ（404, 403, IP BANなど）の検出
- 疑わしいファイルのリスト出力

**使用方法:**
```bash
# 基本的な使用方法
python error_analyzer.py <HTMLディレクトリ>

# 例: Keiba_AI_v2のHTMLディレクトリを分析
python error_analyzer.py C:/Users/zk-ht/Keiba/Keiba_AI_v2/keibaai/data/raw/html

# 出力ファイルを指定
python error_analyzer.py ./data/html_cache --output my_report.json --suspicious my_suspicious.txt
```

**出力:**
- `error_analysis_report.json` - 詳細な分析結果（JSON形式）
- `suspicious_files.txt` - 疑わしいファイルのリスト（テキスト形式）

---

### 2. HTML検証ツール (`html_validator.py`)

個別のHTMLファイルを詳細に検証します。

**機能:**
- HTMLの構造チェック
- エラーパターンの検出
- タイプ別（race/shutuba/horse）の検証
- ファイル内容のプレビュー表示

**使用方法:**
```bash
# ファイルパスを直接指定
python html_validator.py <HTMLファイル> --type race

# レースIDとHTMLディレクトリを指定
python html_validator.py 202301010101 --type race --html-dir C:/path/to/html

# ファイル内容のプレビューを表示（最初の30行）
python html_validator.py ./data/race/202301010101.bin --type race --preview 30 --verbose
```

**オプション:**
- `--type, -t`: HTMLのタイプ (`race`, `shutuba`, `horse`)
- `--html-dir`: HTMLベースディレクトリ（レースID指定時）
- `--verbose, -v`: 詳細出力モード
- `--preview, -p`: ファイル内容のプレビュー行数
- `--output, -o`: 検証結果の出力先（JSON）

**出力:**
- `html_validation_report.json` - 検証結果レポート

---

### 3. 失敗ファイル再処理ツール (`reprocess_failed.py`)

エラー分析結果を使って、失敗したファイルを効率的に再処理します。

**機能:**
- 失敗ファイルのリスト表示
- 失敗ファイルの削除（再スクレイピングを促す）
- 除外すべきレースIDのエクスポート（未来のレースなど）
- 再ダウンロードすべきレースIDのエクスポート

**使用方法:**
```bash
# リスト表示モード（デフォルト）
python reprocess_failed.py --input suspicious_files.txt --mode list

# 削除モード（DRY RUN）
python reprocess_failed.py --input error_analysis_report.json --mode delete --html-dir C:/path/to/html

# 実際に削除する場合
python reprocess_failed.py --input error_analysis_report.json --mode delete --html-dir C:/path/to/html --no-dry-run

# 空ファイルとエラーファイルのみ削除
python reprocess_failed.py --input error_analysis_report.json --mode delete --category empty,error --html-dir C:/path/to/html --no-dry-run

# 除外すべきレースIDをエクスポート
python reprocess_failed.py --input error_analysis_report.json --mode export --output exclude_ids.txt

# 再ダウンロードすべきレースIDをエクスポート
python reprocess_failed.py --input error_analysis_report.json --mode export --export-mode redownload --output redownload_ids.txt
```

**モード:**
- `list`: 失敗ファイルのリスト表示
- `delete`: 失敗ファイルの削除
- `export`: レースIDリストのエクスポート

**カテゴリ:**
- `empty`: 空ファイル
- `small`: 小ファイル（< 1KB）
- `future`: 未来のレースID
- `error`: エラーページ

---

### 4. デバッグ用パーサー (`debug_parser.py`)

パース処理を段階的に実行し、詳細なログを出力します。

**機能:**
- ステップバイステップのパース処理
- 各ステップの成功/失敗を記録
- 抽出されたデータの詳細表示
- デバッグレポートの出力

**使用方法:**
```bash
# 基本的な使用方法
python debug_parser.py <HTMLファイル> --type race

# 詳細モード（全ステップのログを表示）
python debug_parser.py ./data/race/202301010101.bin --type race --verbose

# レースIDを指定
python debug_parser.py C:/path/to/202301010101.bin --type shutuba --race-id 202301010101 --verbose
```

**オプション:**
- `--type, -t`: HTMLのタイプ (`race`, `shutuba`, `horse`)
- `--race-id`: レースID（省略時はファイル名から推測）
- `--verbose, -v`: 詳細出力モード
- `--output, -o`: デバッグレポートの出力先（JSON）

**出力:**
- `debug_parse_report.json` - デバッグレポート

---

## 🔄 推奨ワークフロー

### 1. エラーの発見と分析

```bash
# ステップ1: 全体を分析
python error_analyzer.py C:/Users/zk-ht/Keiba/Keiba_AI_v2/keibaai/data/raw/html

# 出力例:
# - error_analysis_report.json
# - suspicious_files.txt
```

### 2. 個別ファイルの詳細調査

```bash
# ステップ2: 疑わしいファイルを個別に検証
python html_validator.py 202301010101 --type race --html-dir C:/path/to/html --preview 30 --verbose

# さらに詳細なデバッグが必要な場合
python debug_parser.py C:/path/to/html/race/202301010101.bin --type race --verbose
```

### 3. 失敗ファイルの処理

```bash
# ステップ3a: 未来のレースIDを除外リストに追加
python reprocess_failed.py --input error_analysis_report.json --mode export --output exclude_race_ids.txt

# ステップ3b: 空ファイルとエラーファイルを削除（再スクレイピングのため）
python reprocess_failed.py --input error_analysis_report.json --mode delete --category empty,error --html-dir C:/path/to/html --no-dry-run

# ステップ3c: 再ダウンロードすべきレースIDをエクスポート
python reprocess_failed.py --input error_analysis_report.json --mode export --export-mode redownload --output redownload_ids.txt
```

### 4. 除外リストの活用

```python
# Pythonスクリプト内で除外リストを使用
exclude_race_ids = set()
with open('exclude_race_ids.txt', 'r', encoding='utf-8') as f:
    for line in f:
        if not line.startswith('#'):
            race_id = line.strip()
            if race_id:
                exclude_race_ids.add(race_id)

# パース処理時にスキップ
for race_id in all_race_ids:
    if race_id in exclude_race_ids:
        print(f"Skipping excluded race: {race_id}")
        continue
    # 通常のパース処理
```

---

## 📊 ログ分析時の確認ポイント

### 1. クリティカルエラー

```
HTTP 400 Error. IP BANの可能性
```

**対策:**
- リクエスト間隔を増やす（3-7秒）
- User-Agentをランダム化
- 時間を空けて再試行

### 2. パースエラー

```
パースエラー (results_parser): .../race/20250...
```

**確認事項:**
- 未来のレースIDではないか？
- ファイルサイズは適切か？
- HTMLに結果テーブルが存在するか？

**デバッグ方法:**
```bash
# ファイルを詳細検証
python html_validator.py 202501010101 --type race --html-dir C:/path/to/html --preview 50

# さらに詳細なデバッグ
python debug_parser.py C:/path/to/html/race/202501010101.bin --type race --verbose
```

### 3. 日付抽出の失敗

```
HTMLから日付を抽出できませんでした (race_id: 202310010201)
```

**確認事項:**
- HTMLに「YYYY年MM月DD日」の形式があるか？
- 特定の競馬場のみ失敗しているか？

**デバッグ方法:**
```bash
python debug_parser.py C:/path/to/html/race/202310010201.bin --type race --verbose
# 【ステップ3】日付の取得 のログを確認
```

---

## 💡 トラブルシューティング

### Q1. エラー分析ツールが「ディレクトリが見つかりません」と表示される

**A:** HTMLディレクトリのパスを確認してください。ディレクトリ構造は以下を想定しています：

```
html_base_dir/
  ├─ race/
  │   └─ 202301010101.bin
  ├─ shutuba/
  │   └─ 202301010101.bin
  ├─ horse/
  │   └─ 2020100123.bin
  └─ ped/
      └─ 2020100123.bin
```

### Q2. 削除モードで「ファイルが見つかりません」と表示される

**A:** `--html-dir` オプションに正しいベースディレクトリを指定してください。

```bash
# 正しい例
python reprocess_failed.py --input error_analysis_report.json --mode delete --html-dir C:/Users/zk-ht/Keiba/Keiba_AI_v2/keibaai/data/raw/html --no-dry-run
```

### Q3. デバッグパーサーでエラーが大量に出る

**A:** `--verbose` オプションを使って、どのステップで失敗しているかを確認してください。

```bash
python debug_parser.py <file> --type race --verbose
```

---

## 🛠️ 必要なライブラリ

```bash
pip install beautifulsoup4 lxml
```

---

## 📝 出力ファイルの説明

### error_analysis_report.json

```json
{
  "timestamp": "2025-11-18T19:37:36.123456",
  "base_dir": "C:/path/to/html",
  "file_stats": {
    "race": {
      "total_files": 20157,
      "empty_files": 10,
      "suspicious_files": [...],
      "future_race_ids": [...]
    }
  },
  "recommendations": [...]
}
```

### suspicious_files.txt

```
疑わしいファイル一覧
生成日時: 2025-11-18T19:37:36.123456

【race】
────────────────────────────────────────
■ サイズ異常:
  - 202501010101.bin (512 bytes) : 1KB未満（不完全な可能性）

■ 未来のレースID:
  - 202501010101.bin : 未来のレースID（2025年）
```

---

## 📞 サポート

問題が発生した場合は、以下の情報を提供してください：

1. 実行したコマンド
2. エラーメッセージ
3. デバッグレポート（JSON）
4. 環境情報（OS、Pythonバージョン）

---

## 🔖 バージョン

- Version: 1.0.0
- Last Updated: 2025-11-18
- Author: Claude Code
