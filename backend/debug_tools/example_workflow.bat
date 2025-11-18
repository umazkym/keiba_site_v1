@echo off
REM デバッグツール 使用例ワークフロー (Windows版)
REM
REM このスクリプトは、デバッグツールの典型的な使用方法を示します。
REM 実際に実行する前に、パスを環境に合わせて修正してください。

REM ============================================================================
REM 設定: 環境に合わせて以下のパスを変更してください
REM ============================================================================
set HTML_BASE_DIR=C:\Users\zk-ht\Keiba\Keiba_AI_v2\keibaai\data\raw\html
set OUTPUT_DIR=.\debug_output

REM ============================================================================
REM ステップ0: 出力ディレクトリの準備
REM ============================================================================
echo ==========================================
echo ステップ0: 準備
echo ==========================================
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

REM ============================================================================
REM ステップ1: 全体的なエラー分析
REM ============================================================================
echo.
echo ==========================================
echo ステップ1: エラー分析
echo ==========================================
python error_analyzer.py "%HTML_BASE_DIR%" ^
    --output "%OUTPUT_DIR%\error_analysis_report.json" ^
    --suspicious "%OUTPUT_DIR%\suspicious_files.txt"

REM ============================================================================
REM ステップ2: 除外すべきレースIDのエクスポート（未来のレース）
REM ============================================================================
echo.
echo ==========================================
echo ステップ2: 除外リストの作成
echo ==========================================
python reprocess_failed.py ^
    --input "%OUTPUT_DIR%\error_analysis_report.json" ^
    --mode export ^
    --export-mode exclude ^
    --output "%OUTPUT_DIR%\exclude_race_ids.txt"

REM ============================================================================
REM ステップ3: 再ダウンロードすべきレースIDのエクスポート
REM ============================================================================
echo.
echo ==========================================
echo ステップ3: 再ダウンロードリストの作成
echo ==========================================
python reprocess_failed.py ^
    --input "%OUTPUT_DIR%\error_analysis_report.json" ^
    --mode export ^
    --export-mode redownload ^
    --output "%OUTPUT_DIR%\redownload_race_ids.txt"

REM ============================================================================
REM ステップ4: 空ファイルとエラーファイルの削除（DRY RUN）
REM ============================================================================
echo.
echo ==========================================
echo ステップ4: 失敗ファイルの削除（DRY RUN）
echo ==========================================
python reprocess_failed.py ^
    --input "%OUTPUT_DIR%\error_analysis_report.json" ^
    --mode delete ^
    --category empty,error ^
    --html-dir "%HTML_BASE_DIR%"

echo.
echo ==========================================
echo ⚠️  重要: 上記は DRY RUN です
echo ==========================================
echo 実際に削除する場合は、以下のコマンドを実行してください:
echo.
echo python reprocess_failed.py ^
    --input "%OUTPUT_DIR%\error_analysis_report.json" ^
    --mode delete ^
    --category empty,error ^
    --html-dir "%HTML_BASE_DIR%" ^
    --no-dry-run
echo.

REM ============================================================================
REM ステップ5: 個別ファイルのデバッグ例
REM ============================================================================
echo.
echo ==========================================
echo ステップ5: 個別ファイルのデバッグ（例）
echo ==========================================

REM 最初の疑わしいレースIDを抽出（あくまで例）
set SAMPLE_RACE_ID=202301010101

echo サンプルレースID: %SAMPLE_RACE_ID%

REM HTML検証
echo.
echo --- HTML検証 ---
python html_validator.py %SAMPLE_RACE_ID% ^
    --type race ^
    --html-dir "%HTML_BASE_DIR%" ^
    --preview 20 ^
    --output "%OUTPUT_DIR%\validation_%SAMPLE_RACE_ID%.json"

REM デバッグパース
echo.
echo --- デバッグパース ---
python debug_parser.py "%HTML_BASE_DIR%\race\%SAMPLE_RACE_ID%.bin" ^
    --type race ^
    --race-id %SAMPLE_RACE_ID% ^
    --verbose ^
    --output "%OUTPUT_DIR%\debug_parse_%SAMPLE_RACE_ID%.json"

REM ============================================================================
REM 完了
REM ============================================================================
echo.
echo ==========================================
echo ✅ ワークフロー完了
echo ==========================================
echo 出力ディレクトリ: %OUTPUT_DIR%
echo.
echo 生成されたファイル:
dir /B "%OUTPUT_DIR%"
echo.
echo 次のステップ:
echo 1. exclude_race_ids.txt を確認し、パース対象から除外
echo 2. redownload_race_ids.txt のレースを再スクレイピング
echo 3. 必要に応じて空ファイルを削除（--no-dry-run を追加）
echo.
pause
