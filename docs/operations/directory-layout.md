# ディレクトリ案内

機能を調べるときは[機能ガイド](system-guide.md)、実行入口を探すときは[自動処理一覧](automation-map.md)を参照してください。移動した現役ファイル・参考資料・作業フォルダは[配置変更台帳](layout-moves.json)、退役ファイルは[アーカイブ台帳](../../archive/manifest.json)に記録しています。

## ルートに置くもの

| 場所 | 保存するもの |
| --- | --- |
| `frontend/` | Webページ、公開画像、記事本文、記事Writer・Editor・Publisher |
| `backend/` | API、DBモデル、計算、収集、SNS・YouTubeの業務処理 |
| `scripts/` | 手動分析、ソース出力、構成検査、SOP検証、レポート補助 |
| `.github/` | GitHub ActionsとIAP接続アクション |
| `docs/` | 分野別の仕様・運用資料・調査記録 |
| `agent-sops/` | 保守作業の標準手順 |
| `archive/` | 現行実行から外した旧コード・素材・過去の作業記録 |
| `data/reference/` | 手元だけにある競馬TXT資料6件。記事企画の補助入力 |
| `data/`のその他、`logs/`、`sns_images_dist/`、`youtube_video_dist/` | 現行処理が使用するキャッシュ・台帳・ログ・配信用生成物。出力パスを維持 |
| `.local/` | 今後の手動分析結果、出力先未指定のClarity取得結果、ソース出力。Git管理外 |
| `.tmp/`、`.runtime/` | 今回の検証補助とローカルPython環境。Git管理外 |

ルートのREADME、AGENTS、DESIGN、NAMING_GUIDELINES、package設定、pytest設定、環境設定はプロジェクト共通設定です。`.git`とエディタ・エージェント設定フォルダもそれぞれのツールが決めた場所を使います。

## 資料の保存先

| ディレクトリ | 内容 |
| --- | --- |
| `docs/operations/` | 全体の機能・配置・自動実行台帳、リポジトリ調査 |
| `docs/system-documentation/` | システム概要、API、DB、フロント、計算などの総合仕様 |
| `docs/content/` | 記事生成、競馬参考資料の要約、GSC週次運用 |
| `docs/analytics/` | GA4・Clarityの計測設計と監査 |
| `docs/monetization/` | 広告・収益の運用、実験・集計・過去の分析 |
| `docs/infrastructure/` | コスト監視とCloud Run・Cloudflare移行記録 |
| `docs/data/` | データ基盤とマイデータ機能 |
| `docs/video/` | YouTube・SNS動画配信仕様と監査 |
| `docs/development/` | 開発支援ツールと過去のUI修正記録 |
| `docs/revenue-max-ui-samples/` | 資料から参照する広告UI試作 |

日付入りの監査・移行記録は当時の記録です。現行の仕様と区別して読んでください。`docs/archive_agents_history.md`はAGENTSから参照する固定の履歴置き場として維持します。

## 手動ツール

コマンド例はリポジトリルートで実行します。DBを使うものはIAP経由の接続設定と対象期間を確認してから実行します。

| コマンド・場所 | 役割と副作用 |
| --- | --- |
| `python scripts/maintenance/export_source.py` | `.local/exports/all_source_code.txt`へ出力。DB接続なし |
| `scripts/analysis/master_analyzer.py` | 手動DB分析。`DATABASE_URL`が必要。`.local/analysis/`へ出力 |
| `scripts/analysis/run_analysis_examples.py` | 上記分析の実行例。2024年の期間・サンプルIDを含むため、そのまま通常検査に使わない |
| `backend/scripts/analysis/generate_race_graphs.py` | 記事用グラフを`frontend/public/images/articles/`へ出力 |
| `backend/scripts/analysis/generate_website_analysis_data.py` | ローカルAPIからデータ取得。`--output`で指定したJSONへ保存 |
| `backend/scripts/maintenance/generate_predictions.py` | `--date`指定日の予測をDBへ保存 |
| `backend/scripts/maintenance/recalculate_advantages.py` | 既存の有利不利集計を削除し、全期間から再計算してDBへ保存 |
| `backend/scripts/maintenance/db_health_checker.py` | DBの期間別データ件数を読む |

分析・グラフ用はバックエンド基本依存に加えて`matplotlib`、`seaborn`が必要です。日本語グラフには`japanize-matplotlib`または利用可能な日本語フォントを使います。

新しい作業ダンプをルートへ置かず、`.local/`にまとめてください。既存スクリプトや外部ツールで`outputs/`などを出力先に明示した場合、その場所は再作成されます。保存した過去の結果は`archive/local/workspace-2026-09-07/`にあります。
