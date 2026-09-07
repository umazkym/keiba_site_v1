# 資料の読み方

最初に[機能ガイド](operations/system-guide.md)、次に[自動処理・公開ルート一覧](operations/automation-map.md)を読むと、サイト・DB・記事・SNS・YouTubeのつながりを把握できます。資料は用途別ディレクトリへ集約し、コード・SOPからの参照も更新しています。[配置案内](operations/directory-layout.md)に保存先の基準を記載しています。

## 現行仕様と日常運用

| 分野 | 読む資料 |
| --- | --- |
| システム全体・API・DB・計算 | [system-documentation/](system-documentation/)の01〜16章。実装との不一致は実コードを優先 |
| 記事 | [生成フロー](content/article_creation_flow.md)、[参照データ要約](content/reference_data_summary.md) |
| YouTube・SNS動画 | [動画パイプライン](video/youtube_video_pipeline.md)、[多媒体配信](video/social_video_distribution.md) |
| 検索・データ品質 | [GSC週次運用](content/gsc_weekly_seo_operations.md)、[データ価値運用](data/data_value_operations.md) |
| 広告・計測 | [計測設計](analytics/analytics_measurement_plan.md)、[設定](monetization/monetization_measurement_setup.md)、[固定運用手順](monetization/fixed_rollout_20260807_runbook.md) |
| 収益分析 | [履歴v2運用](monetization/monetization_history_v2_operation.md)、[実験台帳](monetization/monetization_experiments.md)、[作業カレンダー](monetization/monetization_task_calendar_2026.md) |
| コスト | [月次の費用確認](infrastructure/cloud_cost_monitoring_operations.md)、[今回の調査・改善](operations/repository-review-2026-09-07.md) |
| マイデータ | [機能・制御の仕様](data/my_data_plus_gate_spec.md) |
| エージェント | [skills.md](development/skills.md)、[gemini.md](development/gemini.md)、[SOP索引](../agent-sops/INDEX.md) |

## 当時の検討・調査・実装記録

以下は記録時点の判断です。「未対応」「停止中」「公開0件」等を現在の状態と断定せず、最新Workflow・Summary・実装と照合してください。

| 分野 | 記録 |
| --- | --- |
| 構成移行 | [Cloud Run移行](infrastructure/cloud_run_cloudflare_migration_20260804.md)、[データ基盤導入](data/free_data_platform_implementation_20260730.md) |
| 広告・収益 | [AdSense分析](monetization/adsense_analysis_report.md)、[8/3収益分析](monetization/monetization_analysis_20260803.md)、[7/22引継ぎ](monetization/monetization_analysis_handover_20260722.md)、[計測照合](analytics/affiliate_measurement_reconciliation_20260803.md) |
| UI・行動分析 | [6/20 Clarity監査](analytics/clarity_optimization_audit_20260620.md)、[6/21完全性確認](analytics/clarity_completeness_review_20260621.md)、[スクロール修正](development/hydration_and_ad_scroll_fix_walkthrough.md)、[表示試作](revenue-max-ui-samples/) |
| 動画 | [YouTube成長監査](video/youtube_growth_audit_20260730.md) |
| 変更履歴 | [過去の作業記録](archive_agents_history.md)、[旧診断と資料のアーカイブ](../archive/README.md) |

新しい機能の入口は[features.json](operations/features.json)へ登録し、`npm run repository:map`で一覧を更新します。新しい履歴を`AGENTS.md`へ長文で積み重ねず、日常の判断規則と記録を分けてください。
