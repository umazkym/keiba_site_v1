# 自動処理と公開ルートの一覧

`npm run repository:map`で現行コードから再生成します。手書きの役割は[機能ガイド](system-guide.md)、移動の記録は[archive](../../archive/README.md)を参照してください。

## 機能別の入口

| 機能 | 主な入口 | 副作用・保存先 |
| --- | --- | --- |
| レース閲覧・AI偏差値・比較材料 | [frontend/app/page.tsx](../../frontend/app/page.tsx)<br>[frontend/app/races/[date]/[venue]/[race]/page.tsx](../../frontend/app/races/[date]/[venue]/[race]/page.tsx)<br>[frontend/lib/api.ts](../../frontend/lib/api.ts)<br>[backend/main.py](../../backend/main.py)<br>[backend/api/v1/endpoints/races.py](../../backend/api/v1/endpoints/races.py)<br>[backend/crud/race_crud.py](../../backend/crud/race_crud.py) | 公開APIは保存済みの予測を表示。アクセスごとに予測を再計算しない |
| 出馬表収集・過去成績取得・予測計算・結果更新 | [backend/run_pipeline.py](../../backend/run_pipeline.py)<br>[backend/scripts/scraper.py](../../backend/scripts/scraper.py)<br>[backend/scripts/parser.py](../../backend/scripts/parser.py)<br>[backend/scripts/predictor.py](../../backend/scripts/predictor.py)<br>[backend/scripts/database_loader.py](../../backend/scripts/database_loader.py)<br>[backend/db_handler.py](../../backend/db_handler.py) | 外部サイトを取得し本番DBへ保存。手動実行でも更新が発生する |
| 重賞・コース・統計記事の生成と公開 | [backend/scripts/agents/news_topic_planner.py](../../backend/scripts/agents/news_topic_planner.py)<br>[backend/scripts/agents/editorial_evergreen_planner.py](../../backend/scripts/agents/editorial_evergreen_planner.py)<br>[backend/scripts/agents/data_scientist.py](../../backend/scripts/agents/data_scientist.py)<br>[frontend/scripts/agents/test_pipeline.ts](../../frontend/scripts/agents/test_pipeline.ts)<br>[frontend/scripts/agents/agent_publisher.ts](../../frontend/scripts/agents/agent_publisher.ts)<br>[frontend/content/reference/grade-race-entities.json](../../frontend/content/reference/grade-race-entities.json) | 通常パイプラインはTavily/Gemini利用・記事保存・GitHub更新・デプロイ連携。キー試験はモデル一覧読取のみ |
| X・Threadsへの定時投稿と的中速報 | [backend/scripts/sns_poster.py](../../backend/scripts/sns_poster.py) | DB台帳で重複を確認し外部投稿。的中速報は結果取得も実施 |
| YouTube横長・Short生成と他SNSへの動画配信 | [backend/scripts/youtube_video_pipeline.py](../../backend/scripts/youtube_video_pipeline.py)<br>[backend/scripts/social_video_distribution.py](../../backend/scripts/social_video_distribution.py)<br>[backend/scripts/social_video/renderer.py](../../backend/scripts/social_video/renderer.py)<br>[backend/scripts/social_video/registry.py](../../backend/scripts/social_video/registry.py)<br>[backend/scripts/social_video/youtube_client.py](../../backend/scripts/social_video/youtube_client.py)<br>[backend/scripts/social_video/workflow_dates.py](../../backend/scripts/social_video/workflow_dates.py)<br>[backend/scripts/social_video/assets/manifest.json](../../backend/scripts/social_video/assets/manifest.json) | FFmpeg描画・YouTube投稿・公開状態同期。6媒体への追加配信は媒体別モードと認証に依存 |
| 競走馬・騎手・調教師・コースの統計と検索 | [backend/api/v1/endpoints/data.py](../../backend/api/v1/endpoints/data.py)<br>[backend/crud/growth_crud.py](../../backend/crud/growth_crud.py)<br>[frontend/app/search/page.tsx](../../frontend/app/search/page.tsx)<br>[frontend/app/compare/page.tsx](../../frontend/app/compare/page.tsx)<br>[frontend/app/my-data/page.tsx](../../frontend/app/my-data/page.tsx)<br>[frontend/lib/my-data.ts](../../frontend/lib/my-data.ts) | 検索・比較はAPI読取。お気に入り・閲覧履歴はブラウザ内に保存 |
| 統計詳細ページの検索公開数を制御 | [backend/scripts/agents/data_page_publication.py](../../backend/scripts/agents/data_page_publication.py)<br>[backend/scripts/agents/cloud_run_capacity.py](../../backend/scripts/agents/cloud_run_capacity.py)<br>[frontend/app/sitemap-data.xml/route.ts](../../frontend/app/sitemap-data.xml/route.ts) | 品質・検索需要・容量判定に応じDBの公開台帳を更新。通常表示の停止装置ではない |
| データ品質とデータページ回遊の監査 | [backend/scripts/agents/data_value_quality_audit.py](../../backend/scripts/agents/data_value_quality_audit.py)<br>[backend/scripts/agents/data_value_funnel_report.py](../../backend/scripts/agents/data_value_funnel_report.py) | DB/GA4読取とレポート生成 |
| 検索順位監視・改稿候補・手動の限定改稿 | [backend/scripts/agents/grade_race_search_monitor.py](../../backend/scripts/agents/grade_race_search_monitor.py)<br>[backend/scripts/agents/gsc_seo_analyzer.py](../../backend/scripts/agents/gsc_seo_analyzer.py)<br>[frontend/scripts/agents/gsc_seo_rewrite.ts](../../frontend/scripts/agents/gsc_seo_rewrite.ts) | 通常はGSC等の読取。指定した手動改稿では記事更新・公開連携が発生 |
| 広告・アフィリエイト・アクセス計測・週次収益分析 | [frontend/components/AffiliateSlot.tsx](../../frontend/components/AffiliateSlot.tsx)<br>[frontend/lib/ad-config.ts](../../frontend/lib/ad-config.ts)<br>[frontend/scripts/validate-monetization-release.js](../../frontend/scripts/validate-monetization-release.js)<br>[backend/api/v1/endpoints/affiliate.py](../../backend/api/v1/endpoints/affiliate.py)<br>[backend/scripts/agents/monetization_history.py](../../backend/scripts/agents/monetization_history.py)<br>[backend/scripts/agents/ad_safety_daily.py](../../backend/scripts/agents/ad_safety_daily.py)<br>[backend/scripts/agents/revenue_notifications.py](../../backend/scripts/agents/revenue_notifications.py)<br>[backend/scripts/agents/revenue_digest.py](../../backend/scripts/agents/revenue_digest.py)<br>[scripts/notifications/publish_revenue_notice.cjs](../../scripts/notifications/publish_revenue_notice.cjs) | サイトで広告・PR導線とGA4/Clarity計測。週次分析と日次監視を行い、公開環境では金額を含まない簡易通知だけを保存・Issue投稿。詳細成果物の保存は非公開環境に限定 |
| Cloud Run配布・転送量監視・キャッシュ復旧 | [frontend/Dockerfile](../../frontend/Dockerfile)<br>[backend/Dockerfile.api](../../backend/Dockerfile.api)<br>[frontend/middleware.ts](../../frontend/middleware.ts)<br>[backend/scripts/agents/cloud_run_capacity.py](../../backend/scripts/agents/cloud_run_capacity.py) | デプロイ・Cloudflare設定・キャッシュを変更する運用処理。入力と各ゲートで制御 |
| IAP限定DB接続とスキーマ保守 | [.github/actions/setup-iap-db/action.yml](../../.github/actions/setup-iap-db/action.yml)<br>[backend/database/database.py](../../backend/database/database.py)<br>[backend/database/models.py](../../backend/database/models.py)<br>[backend/scripts/migrate_data_page_publications.py](../../backend/scripts/migrate_data_page_publications.py) | dry-runは確認、適用はDDL。本番DBはGCE内部IP/IAPを維持 |
| 構成検査・手動分析・SOP検証 | [scripts/maintenance/check_repository.cjs](../../scripts/maintenance/check_repository.cjs)<br>[scripts/agent_sops/validate_sops.cjs](../../scripts/agent_sops/validate_sops.cjs)<br>[scripts/maintenance/export_source.py](../../scripts/maintenance/export_source.py)<br>[scripts/analysis/master_analyzer.py](../../scripts/analysis/master_analyzer.py)<br>[scripts/analysis/run_analysis_examples.py](../../scripts/analysis/run_analysis_examples.py)<br>[backend/scripts/analysis/generate_race_graphs.py](../../backend/scripts/analysis/generate_race_graphs.py) | 構成検査はローカル読取のみ。手動分析は別途DBや追加描画依存が必要 |

## GitHub Actions

cronはUTCです。JSTは時刻に9時間を足し、曜日をまたぐ場合もあります。予定時刻と実際の開始は異なります。

| Workflow | 起動条件 | 排他グループ | ローカル実行入口 |
| --- | --- | --- | --- |
| [Database Schema Migration](../../.github/workflows/db-migrate.yml) | workflow_dispatch | database-schema-migration | [backend/scripts/migrate_data_page_publications.py](../../backend/scripts/migrate_data_page_publications.py) |
| [Deploy Frontend to Cloud Run](../../.github/workflows/deploy-frontend-cloud-run.yml) | push<br>workflow_dispatch<br>workflow_call | deploy-frontend-cloud-run | Workflow内の処理／再利用Workflow |
| [Gemini API Key Read-only Smoke Test](../../.github/workflows/gemini-api-key-smoke.yml) | workflow_dispatch | gemini-api-key-smoke | [backend/scripts/check_models.py](../../backend/scripts/check_models.py) |
| [UMA-FREE Ad Safety Daily Evidence](../../.github/workflows/keiba-ad-safety-daily.yml) | cron: `0 1 * * *`<br>workflow_dispatch | uma-ad-safety-daily | [backend/scripts/agents/ad_safety_daily.py](../../backend/scripts/agents/ad_safety_daily.py)<br>[backend/scripts/agents/revenue_notifications.py](../../backend/scripts/agents/revenue_notifications.py) |
| [Keiba Article Auto Pipeline](../../.github/workflows/keiba-article-pipeline.yml) | cron: `0 23 * * *`<br>cron: `45 2 * * *`<br>cron: `45 7 * * *`<br>workflow_dispatch | keiba-article-auto-pipeline | [backend/scripts/agents/data_scientist.py](../../backend/scripts/agents/data_scientist.py)<br>[backend/scripts/agents/editorial_evergreen_planner.py](../../backend/scripts/agents/editorial_evergreen_planner.py)<br>[backend/scripts/agents/grade_race_registry_audit.py](../../backend/scripts/agents/grade_race_registry_audit.py)<br>[backend/scripts/agents/grade_race_search_monitor.py](../../backend/scripts/agents/grade_race_search_monitor.py)<br>[backend/scripts/agents/grade_race_search_repair_planner.py](../../backend/scripts/agents/grade_race_search_repair_planner.py)<br>[backend/scripts/agents/news_topic_planner.py](../../backend/scripts/agents/news_topic_planner.py) |
| [Keiba Data Fetch (Afternoon)](../../.github/workflows/keiba-data-fetch-afternoon.yml) | cron: `30 4 * * *`<br>workflow_dispatch | 設定なし（個別の台帳・処理制御を確認） | [backend/run_pipeline.py](../../backend/run_pipeline.py)<br>[backend/scripts/social_video/workflow_dates.py](../../backend/scripts/social_video/workflow_dates.py) |
| [Keiba Data Fetch (Friday Weekend)](../../.github/workflows/keiba-data-fetch-friday-weekend.yml) | cron: `0 3 * * 5`<br>cron: `0 6 * * 5`<br>workflow_dispatch | 設定なし（個別の台帳・処理制御を確認） | [backend/run_pipeline.py](../../backend/run_pipeline.py)<br>[backend/scripts/social_video/workflow_dates.py](../../backend/scripts/social_video/workflow_dates.py) |
| [Keiba Data Fetch (Morning Today)](../../.github/workflows/keiba-data-fetch-morning-today.yml) | cron: `30 21 * * *`<br>workflow_dispatch | 設定なし（個別の台帳・処理制御を確認） | [backend/run_pipeline.py](../../backend/run_pipeline.py)<br>[backend/scripts/social_video/workflow_dates.py](../../backend/scripts/social_video/workflow_dates.py) |
| [Keiba Data Fetch (Morning)](../../.github/workflows/keiba-data-fetch-morning.yml) | workflow_dispatch | 設定なし（個別の台帳・処理制御を確認） | [backend/run_pipeline.py](../../backend/run_pipeline.py) |
| [Keiba Data Fetch (Retry Today)](../../.github/workflows/keiba-data-fetch-retry-today.yml) | cron: `0 1 * * *`<br>workflow_dispatch | 設定なし（個別の台帳・処理制御を確認） | [backend/run_pipeline.py](../../backend/run_pipeline.py)<br>[backend/scripts/social_video/workflow_dates.py](../../backend/scripts/social_video/workflow_dates.py) |
| [Keiba Data Page Publication](../../.github/workflows/keiba-data-page-publication.yml) | cron: `45 0 * * *`<br>workflow_dispatch | keiba-data-page-publication | [backend/scripts/agents/cloud_run_capacity.py](../../backend/scripts/agents/cloud_run_capacity.py)<br>[backend/scripts/agents/data_page_publication.py](../../backend/scripts/agents/data_page_publication.py)<br>[backend/scripts/migrate_data_page_publications.py](../../backend/scripts/migrate_data_page_publications.py) |
| [Keiba Data Value Operations](../../.github/workflows/keiba-data-value-operations.yml) | cron: `45 22 * * *`<br>cron: `45 0 * * 3`<br>workflow_dispatch | keiba-data-value-operations | [backend/scripts/agents/data_value_funnel_report.py](../../backend/scripts/agents/data_value_funnel_report.py)<br>[backend/scripts/agents/data_value_quality_audit.py](../../backend/scripts/agents/data_value_quality_audit.py) |
| [Keiba DB Egress Guard](../../.github/workflows/keiba-db-egress-guard.yml) | cron: `17 * * * *`<br>workflow_dispatch | keiba-db-egress-guard | [backend/scripts/agents/cloud_run_capacity.py](../../backend/scripts/agents/cloud_run_capacity.py) |
| [Keiba Grade Race Search Monitor](../../.github/workflows/keiba-grade-race-search-monitor.yml) | cron: `15 0 * * *`<br>workflow_dispatch | keiba-grade-race-search-monitor | [backend/scripts/agents/grade_race_search_monitor.py](../../backend/scripts/agents/grade_race_search_monitor.py) |
| [Keiba GSC Weekly SEO Audit](../../.github/workflows/keiba-gsc-seo.yml) | cron: `15 0 * * 3`<br>workflow_dispatch | keiba-article-auto-pipeline | [backend/scripts/agents/data_value_funnel_report.py](../../backend/scripts/agents/data_value_funnel_report.py)<br>[backend/scripts/agents/gsc_seo_analyzer.py](../../backend/scripts/agents/gsc_seo_analyzer.py)<br>[backend/scripts/agents/monetization_weekly_report.py](../../backend/scripts/agents/monetization_weekly_report.py)<br>[backend/scripts/export_clarity_insights.py](../../backend/scripts/export_clarity_insights.py) |
| [Keiba Monetization History and Weekly Cycle](../../.github/workflows/keiba-monetization-cycle.yml) | cron: `30 0 * * 3`<br>cron: `30 0 * * 4`<br>cron: `30 0 * * 5`<br>workflow_dispatch | keiba-monetization-readonly-cycle | [backend/scripts/agents/cloud_run_capacity.py](../../backend/scripts/agents/cloud_run_capacity.py)<br>[backend/scripts/agents/grade_race_registry_audit.py](../../backend/scripts/agents/grade_race_registry_audit.py)<br>[backend/scripts/agents/monetization_history.py](../../backend/scripts/agents/monetization_history.py)<br>[backend/scripts/agents/monetization_workbook_ci.py](../../backend/scripts/agents/monetization_workbook_ci.py)<br>[backend/scripts/agents/revenue_notifications.py](../../backend/scripts/agents/revenue_notifications.py)<br>[backend/scripts/export_clarity_insights.py](../../backend/scripts/export_clarity_insights.py) |
| [Keiba Pipeline Runner (Results)](../../.github/workflows/keiba-pipeline-runner.yml) | cron: `0 20 * * *`<br>workflow_dispatch | 設定なし（個別の台帳・処理制御を確認） | [backend/run_pipeline.py](../../backend/run_pipeline.py)<br>[backend/scripts/social_video/workflow_dates.py](../../backend/scripts/social_video/workflow_dates.py) |
| [Keiba SNS Afternoon Post](../../.github/workflows/keiba-sns-afternoon-post.yml) | cron: `0 3 * * *`<br>workflow_dispatch | 設定なし（個別の台帳・処理制御を確認） | [backend/scripts/sns_poster.py](../../backend/scripts/sns_poster.py) |
| [Keiba SNS Evening Post](../../.github/workflows/keiba-sns-evening-post.yml) | cron: `0 11 * * *`<br>workflow_dispatch | 設定なし（個別の台帳・処理制御を確認） | [backend/scripts/sns_poster.py](../../backend/scripts/sns_poster.py) |
| [Keiba SNS Hit Immediate Post](../../.github/workflows/keiba-sns-hit-immediate.yml) | cron: `0 10 * * 0,6`<br>workflow_dispatch | 設定なし（個別の台帳・処理制御を確認） | [backend/run_pipeline.py](../../backend/run_pipeline.py)<br>[backend/scripts/sns_poster.py](../../backend/scripts/sns_poster.py) |
| [Keiba SNS Morning Post](../../.github/workflows/keiba-sns-morning-post.yml) | cron: `0 22 * * *`<br>workflow_dispatch | 設定なし（個別の台帳・処理制御を確認） | [backend/scripts/sns_poster.py](../../backend/scripts/sns_poster.py) |
| [Keiba SNS Pre-Race Post](../../.github/workflows/keiba-sns-pre-race.yml) | cron: `0 5 * * 0,6`<br>workflow_dispatch | 設定なし（個別の台帳・処理制御を確認） | [backend/scripts/sns_poster.py](../../backend/scripts/sns_poster.py) |
| [Keiba YouTube Video Pipeline](../../.github/workflows/keiba-youtube-video-pipeline.yml) | workflow_run: Keiba Data Fetch (Afternoon)<br>cron: `20 9 * * *`<br>workflow_dispatch | keiba-youtube-video-daily | [backend/scripts/social_video/validate_assets.py](../../backend/scripts/social_video/validate_assets.py)<br>[backend/scripts/social_video/workflow_dates.py](../../backend/scripts/social_video/workflow_dates.py)<br>[backend/scripts/social_video_distribution.py](../../backend/scripts/social_video_distribution.py)<br>[backend/scripts/youtube_video_pipeline.py](../../backend/scripts/youtube_video_pipeline.py) |
| [Purge Race Cache](../../.github/workflows/purge-race-cache.yml) | workflow_dispatch | purge-race-cache | Workflow内の処理／再利用Workflow |
| [Repository Structure Check](../../.github/workflows/repository-check.yml) | push<br>pull_request<br>workflow_dispatch | repository-check-${{ github.ref }} | [scripts/agent_sops/validate_sops.cjs](../../scripts/agent_sops/validate_sops.cjs) |

## Next.jsの公開ルートとAPI

ファイルルートの一覧です。実際の公開可否・リダイレクト・noindexは各ページと公開台帳に依存します。

| ルート | ソース |
| --- | --- |
| `/about-ai` | [frontend/app/about-ai/page.tsx](../../frontend/app/about-ai/page.tsx) |
| `/about` | [frontend/app/about/page.tsx](../../frontend/app/about/page.tsx) |
| `/advertising` | [frontend/app/advertising/page.tsx](../../frontend/app/advertising/page.tsx) |
| `/api/health` | [frontend/app/api/health/route.ts](../../frontend/app/api/health/route.ts) |
| `/articles/[slug]` | [frontend/app/articles/[slug]/page.tsx](../../frontend/app/articles/[slug]/page.tsx) |
| `/articles/category/[category]` | [frontend/app/articles/category/[category]/page.tsx](../../frontend/app/articles/category/[category]/page.tsx) |
| `/articles/courses/[venue]/[course]` | [frontend/app/articles/courses/[venue]/[course]/page.tsx](../../frontend/app/articles/courses/[venue]/[course]/page.tsx) |
| `/articles/grade-races/[slug]` | [frontend/app/articles/grade-races/[slug]/page.tsx](../../frontend/app/articles/grade-races/[slug]/page.tsx) |
| `/articles/jockeys/[slug]` | [frontend/app/articles/jockeys/[slug]/page.tsx](../../frontend/app/articles/jockeys/[slug]/page.tsx) |
| `/articles` | [frontend/app/articles/page.tsx](../../frontend/app/articles/page.tsx) |
| `/articles/races/[slug]` | [frontend/app/articles/races/[slug]/page.tsx](../../frontend/app/articles/races/[slug]/page.tsx) |
| `/compare` | [frontend/app/compare/page.tsx](../../frontend/app/compare/page.tsx) |
| `/contact` | [frontend/app/contact/page.tsx](../../frontend/app/contact/page.tsx) |
| `/courses/[venue]/[course]` | [frontend/app/courses/[venue]/[course]/page.tsx](../../frontend/app/courses/[venue]/[course]/page.tsx) |
| `/courses` | [frontend/app/courses/page.tsx](../../frontend/app/courses/page.tsx) |
| `/faq` | [frontend/app/faq/page.tsx](../../frontend/app/faq/page.tsx) |
| `/grade-races/[slug]` | [frontend/app/grade-races/[slug]/page.tsx](../../frontend/app/grade-races/[slug]/page.tsx) |
| `/grade-races` | [frontend/app/grade-races/page.tsx](../../frontend/app/grade-races/page.tsx) |
| `/horses/[id]` | [frontend/app/horses/[id]/page.tsx](../../frontend/app/horses/[id]/page.tsx) |
| `/horses` | [frontend/app/horses/page.tsx](../../frontend/app/horses/page.tsx) |
| `/jockeys/[slug]` | [frontend/app/jockeys/[slug]/page.tsx](../../frontend/app/jockeys/[slug]/page.tsx) |
| `/jockeys` | [frontend/app/jockeys/page.tsx](../../frontend/app/jockeys/page.tsx) |
| `/keiba-data/horse-weight` | [frontend/app/keiba-data/horse-weight/page.tsx](../../frontend/app/keiba-data/horse-weight/page.tsx) |
| `/keiba-data` | [frontend/app/keiba-data/page.tsx](../../frontend/app/keiba-data/page.tsx) |
| `/keiba-data/site-selection` | [frontend/app/keiba-data/site-selection/page.tsx](../../frontend/app/keiba-data/site-selection/page.tsx) |
| `/keiba-data/track-condition` | [frontend/app/keiba-data/track-condition/page.tsx](../../frontend/app/keiba-data/track-condition/page.tsx) |
| `/my-data` | [frontend/app/my-data/page.tsx](../../frontend/app/my-data/page.tsx) |
| `/og/[slug]` | [frontend/app/og/[slug]/route.ts](../../frontend/app/og/[slug]/route.ts) |
| `/` | [frontend/app/page.tsx](../../frontend/app/page.tsx) |
| `/privacy` | [frontend/app/privacy/page.tsx](../../frontend/app/privacy/page.tsx) |
| `/races/[date]/[venue]/[race]` | [frontend/app/races/[date]/[venue]/[race]/page.tsx](../../frontend/app/races/[date]/[venue]/[race]/page.tsx) |
| `/races/[date]` | [frontend/app/races/[date]/page.tsx](../../frontend/app/races/[date]/page.tsx) |
| `/races/today` | [frontend/app/races/today/page.tsx](../../frontend/app/races/today/page.tsx) |
| `/results/accuracy` | [frontend/app/results/accuracy/page.tsx](../../frontend/app/results/accuracy/page.tsx) |
| `/search` | [frontend/app/search/page.tsx](../../frontend/app/search/page.tsx) |
| `/sitemap-articles.xml` | [frontend/app/sitemap-articles.xml/route.ts](../../frontend/app/sitemap-articles.xml/route.ts) |
| `/sitemap-data.xml` | [frontend/app/sitemap-data.xml/route.ts](../../frontend/app/sitemap-data.xml/route.ts) |
| `/sitemap-images.xml` | [frontend/app/sitemap-images.xml/route.ts](../../frontend/app/sitemap-images.xml/route.ts) |
| `/sitemap` | [frontend/app/sitemap/page.tsx](../../frontend/app/sitemap/page.tsx) |
| `/terms` | [frontend/app/terms/page.tsx](../../frontend/app/terms/page.tsx) |
| `/trainers/[id]` | [frontend/app/trainers/[id]/page.tsx](../../frontend/app/trainers/[id]/page.tsx) |
| `/trainers` | [frontend/app/trainers/page.tsx](../../frontend/app/trainers/page.tsx) |

## FastAPIの登録エンドポイント

ルータのprefixは`backend/main.py`を参照してください。下表は各ルータ内の相対パスです。

| ファイル | メソッドと相対パス |
| --- | --- |
| [backend/api/v1/endpoints/affiliate.py](../../backend/api/v1/endpoints/affiliate.py) | `GET /rakuten/resolve` |
| [backend/api/v1/endpoints/data.py](../../backend/api/v1/endpoints/data.py) | `GET /summary` |
| [backend/api/v1/endpoints/data.py](../../backend/api/v1/endpoints/data.py) | `GET /search` |
| [backend/api/v1/endpoints/data.py](../../backend/api/v1/endpoints/data.py) | `GET /directories/{entity_type}` |
| [backend/api/v1/endpoints/data.py](../../backend/api/v1/endpoints/data.py) | `GET /courses/{venue_slug}/{course_slug}` |
| [backend/api/v1/endpoints/data.py](../../backend/api/v1/endpoints/data.py) | `GET /horses/{entity_id}` |
| [backend/api/v1/endpoints/data.py](../../backend/api/v1/endpoints/data.py) | `GET /jockeys/{entity_id}` |
| [backend/api/v1/endpoints/data.py](../../backend/api/v1/endpoints/data.py) | `GET /trainers/{entity_id}` |
| [backend/api/v1/endpoints/data.py](../../backend/api/v1/endpoints/data.py) | `GET /race-series` |
| [backend/api/v1/endpoints/data.py](../../backend/api/v1/endpoints/data.py) | `GET /races/{race_id}/features` |
| [backend/api/v1/endpoints/data.py](../../backend/api/v1/endpoints/data.py) | `POST /data/compare/horses` |
| [backend/api/v1/endpoints/data.py](../../backend/api/v1/endpoints/data.py) | `POST /compare/horses` |
| [backend/api/v1/endpoints/data.py](../../backend/api/v1/endpoints/data.py) | `GET /sitemap` |
| [backend/api/v1/endpoints/data.py](../../backend/api/v1/endpoints/data.py) | `GET /sitemap-manifest` |
| [backend/api/v1/endpoints/data.py](../../backend/api/v1/endpoints/data.py) | `GET /sitemap-shards/{entity_type}/{shard}` |
| [backend/api/v1/endpoints/races.py](../../backend/api/v1/endpoints/races.py) | `GET /weekly-grade-races` |
| [backend/api/v1/endpoints/races.py](../../backend/api/v1/endpoints/races.py) | `GET /stats/accuracy` |
| [backend/api/v1/endpoints/races.py](../../backend/api/v1/endpoints/races.py) | `GET /article-preview/{target_date}` |
| [backend/api/v1/endpoints/races.py](../../backend/api/v1/endpoints/races.py) | `GET /detail/{target_date}/{venue_slug}/{race_number}` |
| [backend/api/v1/endpoints/races.py](../../backend/api/v1/endpoints/races.py) | `GET /{target_date}` |
| [backend/api/v1/endpoints/races.py](../../backend/api/v1/endpoints/races.py) | `GET /hits/top-payouts` |
| [backend/api/v1/endpoints/races.py](../../backend/api/v1/endpoints/races.py) | `GET /hits/high-payouts/{target_date}` |
| [backend/api/v1/endpoints/races.py](../../backend/api/v1/endpoints/races.py) | `GET /special-pick/{target_date}` |
| [backend/api/v1/endpoints/races.py](../../backend/api/v1/endpoints/races.py) | `GET /matchups/{race_id}` |
| [backend/api/v1/endpoints/races.py](../../backend/api/v1/endpoints/races.py) | `GET /sitemap/all-race-urls` |
| [backend/api/v1/endpoints/races.py](../../backend/api/v1/endpoints/races.py) | `GET /sitemap/heavy-stakes-urls` |
