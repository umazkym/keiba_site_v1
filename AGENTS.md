# Codex - UMA-FREE 収益最大化&自動運用 保守ガイド

## 1. あなたの役割と基本原則
あなたは、FastAPI(Python)とNext.js(TypeScript)で構築された競馬データ分析サイト「keiba_site_v1(UMA-FREE)」の専属AIエキスパートです。現在のサイトはGoogle AdSense審査に合格し、収益化に成功しています。あなたの主な任務は、現在の収益化ステージを維持・拡大し、システムの安定自動運用と収益最大化のための保守・改善を行うことです。

### 基本原則
* **自然な品質の維持(最重要)**: AI自動生成を想起させる画一的なUIや文言、過度な絵文字の使用を徹底的に避けます。競馬ファンに響く自然で信頼感のあるサイト品質を維持します。
* **文体ガードの徹底**: 「投資」「必勝」「絶対」「圧倒的」「最強」「消去対象」など、広告審査や読者の信頼性を損なう強すぎる表現・煽り表現は一切禁止します。オッズ妙味、購入候補、判断材料、評価を下げたい条件など、自然な競馬メディアの表現を徹底します。
* **完全性と正確性**: 提示するコードは常に完全な形で提供し、`...`などでの省略は一切禁止します。インポート文やサンプルデータを含め、修正なしでコピペで動くコードを提供します。
* **日本語での対話**: すべての回答、説明、コメント、コード内コメントは日本語で生成します。

---

## 2. プロジェクト構成と開発環境

### 技術スタックとインフラ
| コンポーネント | 技術スタック / プラットフォーム | 補足情報 |
| :--- | :--- | :--- |
| **バックエンド** | Python, FastAPI, SQLAlchemy, Uvicorn | Cloud Runにてホスト。楽天APIはIP制限ではなくドメイン（Allowed Origins）認証へ移行済み。 |
| **フロントエンド** | TypeScript, Next.js 14 (App Router), React, Tailwind CSS | Vercelにてホスト。 |
| **データベース** | GCE VM (keiba-db) | 外部IPv4なし。内部IP `10.138.0.2` のPostgreSQLへCloud RunはDirect VPC egress、GitHub Actions/保守作業はIAP TCPトンネル経由で接続。 |

### ローカル開発環境の起動
* **バックエンド起動**: `PS C:\Users\zk-ht\Keiba\keiba_site_v1\backend> uvicorn main:app --reload`
* **フロントエンド起動**: `PS C:\Users\zk-ht\Keiba\keiba_site_v1\frontend> npm run dev`

### 本番DB接続・保守時の注意
* **DB本体は移動していない**: 本番PostgreSQLは従来通りGCE VM `keiba-db` 上で稼働。変更されたのは外部公開IPを廃止し、接続経路を内部/IAP経由へ切り替えた点のみ。
* **Cloud RunからのDB接続**: Cloud Run `keiba-site-v1` は `run.googleapis.com/network-interfaces` と `run.googleapis.com/vpc-access-egress=private-ranges-only` を利用し、VPC内部IP `10.138.0.2:5432` へ接続する。楽天APIなど外部通信は通常の外向き経路を維持。
* **GitHub ActionsからのDB接続**: `.github/actions/setup-iap-db/action.yml` でGoogle OIDC認証後、IAP TCPトンネルを `127.0.0.1:15432` に張り、既存の `DATABASE_URL` を実行時だけlocalhostへ差し替える。Actions側のスクリプトは従来通り `DATABASE_URL` を参照する。
* **手元やCloud ShellからDBへ入る場合**: 旧外部IP `34.182.6.97` へ直接接続してはいけない。必要時は次のようにIAPトンネルを張ってから `127.0.0.1:15432` へ接続する。
  `gcloud compute start-iap-tunnel keiba-db 5432 --project=keiba-api-project --zone=us-west1-b --local-host-port=127.0.0.1:15432`
* **ファイアウォール前提**: `allow-postgres`、`default-allow-ssh`、`default-allow-rdp` は無効化済み。DB/SSH保守は `allow-iap-postgres-keiba-db`（IAP→5432）と `allow-iap-ssh-keiba-db`（IAP→22）のみを利用する。外部IPv4や0.0.0.0/0のDB公開を復活させない。

---

## 3. 運用ルールと禁止事項

### 許可されるタスク
* 既存コードのリファクタリング、バグ修正、安定運用のためのパフォーマンス改善
* 新規コンポーネントやAPIエンドポイントの作成
* Google AdSense/アフィリエイトポリシーに準拠するためのコンテンツ改善
* UI/UX向上のためのフロントエンド修正
* マークダウン記事の作成・編集

### 禁止事項 (厳守)
* **Git操作の禁止**: `git commit`、`git push`、`git deploy` 等のコマンドはAI側からは一切実行しません。コードの変更提示のみを行い、コミット・デプロイはユーザーが手動で行います。
* **高負荷なスクレイピングの禁止**: 外部サイトへの大量アクセスや高負荷なスクレイピングは避けます。外部リサーチはTavily API等を適切に制御して利用します。
* **未検証コードの提示禁止**: 型安全性を無視したコードや、不完全なロジックの提示は禁止します。

---

## 4. 収益最大化・広告運用の判断基準

### 手動広告と自動広告の使い分け
手動配置広告と自動広告の純粋な効果検証に基づき、現在は手動広告既定ON（`NEXT_PUBLIC_MANUAL_ADS_MODE=enabled`）の運用を行っています。AdSense管理画面側の自動広告と組み合わせ、以下の配置ルールを厳守します。
* **記事ページの広告配置**: 読者の読了・回遊体験を阻害しないよう、記事本文の直後（関連記事の上）にアフィリエイト枠（`AffiliateSlot`）を配置し、視認性と行動喚起率を向上させています。記事タイトル直後や目次直後、コアデータ周辺への過密配置は避めます。
* **レースページの広告配置**: レースデータ確認中のユーザーの邪魔にならない位置（予想表確認後の自然な区切り、データ解説パネル直後など）に集約し、stickyレース選択直下や予想表の内部には配置しません。
* **誤クリック・CLS対策**: 広告空振り時に本文が押し上がるレイアウトシフト（CLS）を防ぐため、広告枠は空振り時も高さを確保し、本文や操作UIの急な移動を避けます。
* **2026-06-12**:
  * **モバイル・レイアウト余白・パディングの削減**: モバイル表示時のマージンやパディングを徹底的に見直し、縦方向の圧縮と画面占有率の削減を達成。日付ナビゲーション、前回レース復帰、レース一覧、重賞などのセクション間余白を `mb-2` から `mb-1.5` や `mb-1` へ削減。カード類のパディングも削減した。
  * **RaceTabs.tsx 構文エラー修復と競合解消**: `venueTabClass` の再定義による構文競合を解消し、不要な重複コードを削除。壊れていた map の閉じタグと TabPanel タグを適切に修復しビルドエラーを回避。
  * **記事生成品質ゲート強化**: `agent_editor.ts` のGemini Editorレスポンスを堅牢なJSON抽出へ変更し、JSONパース失敗やAI Editor非承認時にSEO機械チェックだけで公開承認しないよう修正。Gemma複数観点レビューは構造化メモへ圧縮して最終Editorへ渡し、ノイズ混入を抑制。
  * **検索カニバリ抑制 & 地方重賞対応**: `news_topic_planner.py` に `KEIBA_NEWS_MAX_TOPICS_PER_RACE_PER_RUN` を追加し、既定で1実行1レース1本に制限。帝王賞、さきたま杯、関東オークス、JBC、東京大賞典など地方・交流重賞も季節カレンダーとTavilyクエリの対象へ追加。
  * **記事表現ガード追加**: Writer/Editor/SEO Checkerで「軸の筆頭」「消し」「精度の高い予想」「AI偏差値70以上」「絶好枠」などの強い表現を抑制。予測データが空の場合はAI偏差値の具体値・しきい値・予想印を生成しないルールを明文化。
  * **Gemini 503対策**: Writer/Editorの高性能・中性能モデルで一時混雑系エラー（503/high demand等）が出た場合、既定1回だけ短時間待機して同じモデルを再試行。クォータ上限時は再試行せず次モデルへフォールバック。zon）**: 名馬ぬいぐるみ、競馬系Tシャツ、馬蹄グッズの3種類を登録。楽天市場リンクはCloud Runバックエンド（`/api/v1/affiliate/rakuten/resolve`）を経由して、楽天APIの`affiliateUrl`を非同期で自動解決します。Amazonは短縮リンクをテキストリンクとして控えめに表示し、ユーザーの選択の迷いを排除します。
* **リワード広告（一時停止中）**: 在庫・配信設定の不安定さによる機会損失を防ぐため、現在はデフォルトで一時停止（ソフトフォールバック）としています。GAM Rewarded Adの在庫が安定するまでは、通常のレースページ内広告で回収する構成を維持します。

---

## 5. 自動記事生成システム仕様(Tavily連携)
毎朝08:00 JSTにGitHub Actions経由で自動実行される記事生成パイプラインは、以下の検索流入最大化ロジックで制御されています。
* **レースカレンダー連動**: 直近21日以内から開催後3日以内の重賞（例: 宝塚記念、函館SSなど）を優先し、季節外れのレースは除外します。
* **検索意図の分類とキーワード変換**: Tavilyによる検索結果を「枠順」「出走馬」「馬場」「追い切り」「AI予想」等の検索意図に分類し、自然検索向けのターゲットキーワード（例: 「宝塚記念2026 枠順 AI予想」）へ変換して記事を構成します。
* **重複生成・カニバリ防止**: 7日間で同一レース2本まで、1回の実行では同一レース1本までに制限し、同一keywordの重複を防止します。
* **Editorによる文字数自動補正**: 本文が3,000文字未満のドラフトの場合、架空のデータを足さずに、「直前に見る材料」「人気馬を疑う条件」などの自然な競馬の補足セクションを自動で挿入し、コンテンツの厚みとSEO品質を担保します。

---

## 6. UI/UX・技術品質基準チェックリスト
* [ ] **TypeScript / ビルド**: 型エラーがなく、`npm run build`が正常に成功すること。
* [ ] **装飾の抑制**: サイトの信頼性を損なう過度な絵文字、派手なアニメーションは使用しないこと。
* [ ] **文末・見出しの多様化**: 機械的な語尾の連続（「〜です。」の連続など）を避け、見出しも画一的な「3つのポイント」構文に偏らないようにすること。
* [ ] **モバイルUX**: タッチ操作や表の横スクロールが広告（アンカー広告等）によって阻害されていないこと。
* [ ] **PR表記の徹底**: アフィリエイトリンクには `rel="sponsored nofollow noopener noreferrer"` と「PR」表記を必ず付与すること。

---

## 7. 運用保守・データ復旧の重要コアログ
過去に発生した重大なバグとその修正対応の記録です。今後のシステム保守において、同様の事象の再発防止やデバッグ時の参照文脈として残しています。
* **地方競馬データ文字化け修復(2026-06-05)**: 出馬表HTML取得時に一部のUTF-8ページを一律EUC-JPとしてデコードしていたことで、馬名等が文字化けする事象が発生。レスポンスのcharset宣言やURL系統からエンコードを自動判定する処理（`scraper.py`）へ修正し、既存データは専用スクリプト（`repair_mojibake_race_day.py`）で本番DBを完全修復済み。
* **キャッシュTTLの調整**: 当日・昨日・明日のレースAPI取得キャッシュを1時間から5分へ短縮し、データ修復や再生成が公開ページへ迅速に反映されるよう改善。
* **SNS自動投稿の重複・エラーハンドリング(2026-06-04)**: 朝のSNS投稿において、X APIがCloudflareのチャレンジ等により一時的に403エラーを返した際、ジョブが完全に失敗する問題を修正。最大3回のリトライを追加し、Threadsのみ成功した場合も二重投稿にならないよう投稿レコードのハッシュ管理と一意制約チェックを強化。
* **構造化データのSSR化**: Client Component内でJSON-LDを出力していた問題を修正し、Server Component側（`StructuredData.tsx`）で`BreadcrumbSchema`や`FAQSchema`をSSRとして出力する形に統一。Googleのリッチリザルト検出精度を向上。

---

## 8. 過去の実行ログ（圧縮版）
今後の開発・保守において、過去の経緯を追うための要約ログです。新規タスク完了時も、このセクションへ適宜追記を行っていきます。

> [!NOTE]
> ログの量が多くなりすぎた場合は、トークン消費量を削減するため、古いログを [archive_agents_history.md](file:///c:/Users/zk-ht/Keiba/keiba_site_v1/docs/archive_agents_history.md) に移管・追記し、このファイル内のログを適宜整理（削除）してください。なお、アーカイブファイル側はAIが毎回参照する必要はありません。

* **2026-06-17**:
  * **中央・地方重賞の近日表示対応**:
    ホーム上部の重賞枠が中央競馬のみの取得条件になっていたため、`get_weekly_grade_races` を今日から14日以内の中央・地方重賞を返す構成へ変更。地方の `Jpn1/Jpn2/Jpn3` とレース名末尾の `重賞` 表記を検出し、通常レース名に含まれる「重賞級」などは拾わないようにした。`WeeklyGradeRaces` は「近日の重賞レース」として中央・地方を区分表示し、G1/Jpn1級は注目開催カードで表示。`py_compile`、`npx tsc --noEmit`、`npm run build` 成功を確認。
    デプロイ後、API側の重賞枠が空でもホームには当日の全レースデータが存在するケースがあったため、ホーム側で `predictions` から当日重賞を補完抽出する処理を追加。`赤レンガ記念〔H3〕(ウエストオーバー賞 重賞`、`トリトン争覇 重賞`、`園田FCスプリント 重賞` のような地方重賞表記を拾い、表示名から副題・グレード表記を整理するようにした。該当がない場合は「本日開催の重賞はありません」と表示し、今日のレース分析導線を出す構成へ変更。`npx tsc --noEmit`、`py_compile`、`npm run build` 成功を確認。
  * **記事生成パイプラインの公開ブロックと数値ハルシネーション対策**:
    `validate_article_links.js` で既存記事の「大きくな」系の不自然な置換残りが検出され、承認済み記事の公開前にワークフローが停止する問題を修正。`naturalize_existing_articles.js` に同系統の補正を追加し、既存記事11本へ適用して `article:validate-links` を通過させた。あわせて `keiba-article-pipeline.yml` のリンク検証をLLM生成前のプリフライトへ移動し、既存記事の問題でWriteOrder消費後に公開だけ止まる事故を防止。
    Writer/Editor/ArticleFlow側では、Evidence Packに存在しない勝率・複勝率・回収率などの%値をpost-writer段階でcritical扱いに格上げし、Editorの再試行時にも前回却下された未確認数値をプロンプトへ明示するよう修正。Writer/Editorプロンプトから例示用の具体%値や「買い足す」など強めの表現を減らし、未確認数値は数値なしの確認手順へ言い換える方針に統一。`npx tsc --noEmit`、`npm run article:validate-links`、`npm run article:audit-quality`、`npm run build` 成功を確認。
    追加ログ確認で、`ARTICLE_MIN_BODY_CHARS=3000` 指定中でも `race_update` 系が2000字で承認される抜け道が判明したため、`agent_writer.ts` と `seo_checker.ts` の記事タイプ別文字数下限を環境変数未満に下げないよう修正。さらにEditorが見出し1行を長い本文セクションへ置換して文字数を稼ぐ経路をブロックし、文字数不足は安全な補足処理へ寄せる構成にした。`npx tsc --noEmit`、`npm run article:validate-links`、`npm run article:audit-quality`、`npm run build` 成功を確認。
    さきたま杯記事で枠順未発表にもかかわらず「枠順確定」前提の記事が生成された問題を修正。`news_topic_planner.py` で「枠順」一般語と「枠順発表済み」を分離し、発表予定・発表日は `draw_status=pre_draw`、確定・公開済みの明示がある場合のみ `confirmed` とした。`article_flow.ts`、`agent_writer.ts`、`agent_editor.ts`、`grade-race-update-plan.ts` にも同じガードを追加し、対象記事は「枠順発表前に見る確認順」へ修正。`python -m py_compile`、`npx tsc --noEmit`、`npm run article:validate-links`、`npm run article:audit-quality`、`npm run build` 成功を確認。
  * **GCP固定ネットワーク費（Networking）の完全削減と楽天APIドメイン認証移行**: 
    GCPの固定維持費（月額約 ¥6,000〜）を削減するため、Cloud RunのVPCコネクタ接続を解除し、GCP上のCloud NAT（`rakuten-cloudrun-nat`）、ルーター（`rakuten-nat-router`）、VPC Accessコネクタを削除。さらに、未使用となった旧固定IP（`35.252.200.91`）を解放してペナルティ課金を停止。本番DB（VM `keiba-db` / `34.182.6.97`）は `e2-micro` にてRUNNING（稼働中）を安全に維持。
    楽天アフィリエイトAPIの2026年新基盤移行に伴い、認証をIP制限から「ドメイン（Allowed Origins）制限」に変更。楽天Developersコンソール側でWeb Application型へ変更してAllowed Originsにサイトドメインを登録し、バックエンドコード（`affiliate.py`）にてリクエストヘッダーに `Origin` を付与するように修正。アフィリエイトURLの解決・報酬トラッキング（ID紐付け）やサイト表示への悪影響がないことをローカル疎通テストにて検証済み。
  * **DB外部IPv4廃止とIAP/内部IP接続への完全移行**:
    GCPの日額課金を1日20円以下へ近づけるため、DB VM `keiba-db` の外部IPv4課金要因を撤去。Cloud Run `keiba-site-v1` にDirect VPC egress（`private-ranges-only`）を設定し、`DATABASE_URL` の接続先を外部IP `34.182.6.97` から内部IP `10.138.0.2` へ切り替えた。`/api/v1/predictions/stats/accuracy?days=30` がHTTP 200を返すことを確認し、サイト/バックエンドAPIからDB参照が継続できる状態を検証済み。
    GitHub Actionsは `.github/actions/setup-iap-db/action.yml` を追加し、Workload Identity Federation（Pool `github-actions-pool` / Provider `github-actions-provider` / Service Account `github-actions-iap-db@keiba-api-project.iam.gserviceaccount.com`）でGoogle認証後、IAP TCPトンネルを `127.0.0.1:15432` に張る構成へ変更。データ取得、結果取得、記事生成、SNS投稿系workflowは、既存 `DATABASE_URL` secretを実行時にlocalhostへ差し替えるため、各スクリプトのDB参照方法は従来通り。
    `allow-postgres`（0.0.0.0/0→5432）、`default-allow-ssh`、`default-allow-rdp` は無効化。IAP用に `allow-iap-postgres-keiba-db`（35.235.240.0/20→5432）と `allow-iap-ssh-keiba-db`（35.235.240.0/20→22）を作成し、保守経路を維持。予約IP `keiba-db-ip` とVMの `external-nat` access configを削除し、`gcloud compute instances list` で `EXTERNAL_IP` が空であること、IAP DBトンネルが外部IP削除後も疎通することを確認済み。
    これによりDB本体・データは従来通りGCE VM `keiba-db` に残したまま、外部公開DBから内部/IAP接続へ移行。今後、ローカルやCloud ShellからDBへ入る場合は旧外部IPではなくIAPトンネルを利用すること。外部IPv4、Cloud NAT、Serverless VPC Access、Artifact RegistryのSKUは翌日以降のBillingで反映確認する。
* **2026-06-13**:
  * **ホーム/レース詳細UIの残差分修正**: localhost確認で残っていた薄青の空広告枠を解消するため、`.ad` / `.ad-large` / `.ad-wide` をプレースホルダー表示から中立ラッパーへ変更し、開発環境では広告親枠ごと非表示にする条件を追加。高配当的中ランキングは旧CSS依存をやめ、払戻金・式別・組番・レース情報が崩れないカード型リストへ再設計。レースページ下部のPR枠はコンパクト表示へ調整し、関連分析記事サムネイルも直接画像表示へ統一。`npx tsc --noEmit`、`npm run build`、`curl` による `localhost:3000` トップ/レース詳細と `localhost:8000` API疎通成功を確認。Browser確認はWindowsサンドボックス権限エラーで未実施。
  * **localhost表示崩れの復旧**: HTML回収後に `output.css` 側だけへ残っていたモバイルメニューCSSを `globals.css` へ復旧し、デスクトップでメニュー縦リストが常時展開される問題を修正。ローカル開発時はAdSense/インフィード/追従広告の大きなプレースホルダーを既定で非表示にし、必要時のみ `NEXT_PUBLIC_SHOW_DEV_AD_PLACEHOLDERS=enabled` で確認できる構成へ変更。ヘッダーロゴとホーム記事サムネはローカル確認時の `/_next/image` 接続断に巻き込まれにくいよう直接画像表示へ変更。`npx tsc --noEmit`、`npm run build`、バックエンドAPI疎通成功を確認。
  * **HTML回収差分の追補修正**: HTMLモック反映後の差分を再点検し、記事詳細の本文前AdSense枠を撤去して目次直後の広告過密を回避。`RaceTabs` の `useRewardedAd` 呼び出し順を早期return前へ移動し、地方競馬のみの日に上位タブ `defaultIndex` が存在しない番号になる不具合を修正。`PredictionTable` の予測対象外判定、`RaceAnalysis` の強表現サニタイズ、`RaceAnalysisComment` と説明ページの文体ガードも整理。`npx tsc --noEmit` と対象差分の `git diff --check` 成功を確認。
  * **レース詳細の表示順と楽天競馬導線の整理**: レース詳細の主要データ順を `AI偏差値 → 過去対決成績 → 展開/脚質予測 → このコースの枠順傾向 → AIレース展望` に統一。地方競馬ではAI偏差値直後に楽天競馬のオッズ確認導線を表示し、JRAでは誤解を招く投票導線を出さない構成を維持。PC目次とスマホ下部ナビも同じ順番へ変更し、モバイル追従広告はレースページ下部ナビに重ならないよう表示位置を調整。`tsc --noEmit` 成功を確認。
  * **収益優先のAdSense自動系復帰**: オファーウォールとリワード広告の違いを整理し、収益レポート上で好調だったAdSense自動広告・オファーウォール・アンカー広告の復帰を優先。GAM Rewarded Adは在庫不安定のため `fallback` 維持、`NEXT_PUBLIC_FULLSCREEN_AD_MODE=disabled` も維持したまま、`NEXT_PUBLIC_ADSENSE_AUTO_ADS_MODE` の既定値と `.env.example` を `enabled` に変更。手動広告ONとの併用で、良かった時の「手動配置 + AdSense自動系 + オファーウォール」構成へ戻す方針にした。`npx tsc --noEmit` 成功を確認。
  * **オファーウォール収益機会の復帰**: 6/13のAdSenseレポートで本日のオファーウォール収益が0円となり、短期収益の大きな穴になっていたため、全画面広告・GAM Rewarded Adの停止は維持したまま、AdSenseページレベル機能の読み込みだけを復帰。`NEXT_PUBLIC_ADSENSE_OFFERWALL_MODE=enabled` を追加し、`NEXT_PUBLIC_ADSENSE_AUTO_ADS_MODE=manual-only` でもオファーウォール用スクリプトを読み込める構成にした。あわせてレースページの予想表直後広告と詳細データ後InFeed、記事序盤広告の先読み幅を広げ、NAR詳細データ後はアフィリエイトでAdSenseを置き換えず併設する運用へ調整。`npx tsc --noEmit` 成功を確認。`npm run build` はローカル環境で長時間応答せずタイムアウトしたため、残った確認用ビルドプロセスを停止した。
  * **SNS Threads一時障害の失敗判定緩和**: 夜投稿GitHub ActionsでX投稿成功後、Threads APIの `is_transient=true` 付き500エラーによりジョブ全体が失敗していたため、Threads投稿に一時エラー分類とコンテナ作成時のリトライを追加。X投稿が成功済みの場合はThreadsの一時障害だけで `FAIL_ON_SNS_ERROR=true` のジョブを失敗させないようにし、認証エラーなど恒久的な問題は従来通り失敗扱いにした。`python -m py_compile backend\\scripts\\sns_poster.py` 成功を確認。
  * **広告表示機会の回復調整**: 6/12のAdSenseレポートでPV増加に対してPage RPMと広告表示回数/PVが低下していたため、全画面広告・Rewarded Ad停止は維持したまま、手動広告の遅延読み込み条件を枠ごとに調整できるよう修正。通常AdUnitは先読み幅をやや拡大し、InFeed枠は高効率枠として広めに先読み、レースページのモバイル追従広告は開始閾値を1400pxから800pxへ緩和。アフィリエイト表示時にもAdSenseのInFeed機会が消えないよう、レース下部に独立したInFeed枠を1枠復帰した。`npx tsc --noEmit` 成功を確認。`next build` はローカル環境で長時間応答せずタイムアウトしたため、別途Vercel/CI側で最終確認する。
  * **レースページのパンくず日本語化**: レース詳細URLの `tokyo` などのvenue slugが画面パンくずにローマ字表示される問題を修正。共通パンくずにレースURL専用の日本語ラベル生成と競馬場slug逆引きを追加し、日付ページ・詳細ページではSSR側の正式な日付/レース名を渡す形へ整理。楽天市場商品検索APIは `affiliateUrl`、`itemName`、`itemPrice`、`mediumImageUrls` を取得できる仕様で、既存の `/api/v1/affiliate/rakuten/resolve` と `AffiliateSlot` が画像・価格表示に利用可能であることを確認。`npx tsc --noEmit` 成功を確認。`npm run build` はローカル環境で長時間応答せずタイムアウトしたため、残った確認用ビルドプロセスを停止した。
  * **楽天商品画像とレース切り替えパンくずの再修正**: レース詳細ページでレースを切り替えた際、URLは変わっても画面パンくずが初回レース名のまま残る問題を修正。`RaceTabs` から選択中レースのパンくず情報をイベント通知し、`Breadcrumb` が即時反映する構成にした。楽天商品枠はAPI画像を `object-contain` で表示し、画像URLエラー時は商品カテゴリ表示へ自然にフォールバックするよう改善。`NEXT_PUBLIC_API_URL` 未設定時の本番フォールバックURLを追加し、楽天API解決の失敗リスクを低減。バックエンドは `smallImageUrls` も取得対象へ追加。`npx tsc --noEmit` と `python -m py_compile backend\\api\\v1\\endpoints\\affiliate.py` 成功を確認。`npm run build` はローカル環境で長時間応答せずタイムアウトしたため、残った確認用ビルドプロセスを停止した。
  * **スマホ過去対決成績のマトリクス化**: `MatchupTable.tsx` のモバイル表示を基準馬選択式カードからPC同等の全頭マトリクスへ変更。18頭立てでも横スクロールなしで収まるよう、スマホ専用の小型馬番バッジ、縦書き3文字馬名、21px行高の圧縮セルを追加した。馬名短縮は `Array.from(...).slice(0, 3)` で行い、`イクイノックス` は `イクイ` のように表示される。`npx tsc --noEmit` 成功を確認。`npm run build` はローカル環境で長時間応答せずタイムアウトしたため、残った確認用ビルドプロセスを停止した。ブラウザ確認はBrowser接続がWindowsサンドボックス権限エラーで起動できず未実施。
  * **本サイト全体のUI/UX統一仕上げ**: 添付スクリーンショットで残っていた記事一覧の長いリスト感、運営者情報・規約・広告・お問い合わせ・サイトマップなど固定ページの文書感、コース/騎手/重賞ハブの古い矩形カードを再点検し、共通の情報ページレイアウト、角丸カード、控えめな影、カテゴリ導線へ統一。記事一覧はPCでカード型索引、モバイルで横画像付きカードとして読みやすさを維持。`next/image` 依存の残りを直接画像表示へ寄せ、ローカル確認時の画像破損リスクを低減。`買い時`、`消し`、`穴馬の激走` など強めの表現を評価材料・相手候補など自然な競馬メディア表現へ置換。`npx tsc --noEmit` と `npm run build` 成功、frontend/backend の localhost 疎通と主要ページのHTTP 200を確認。
  * **トップヒーロー5要素の視認性修正**: トップページのヒーロー内にある `AI偏差値`、`対決成績`、`展開/脚質`、`枠順傾向`、`AI展望` の5要素が暗色半透明カードと白文字で視認性が低く、モバイルで横スクロール操作もしづらくなっていたため、白背景の小型カードへ変更。モバイルは2列グリッド、PCは5列グリッドにし、カード内テキスト・アイコン・ミニチャート・ヒーロー見出し/説明/CTAのサイズを全体的に圧縮。`npx tsc --noEmit` と `npm run build` 成功を確認。frontend devサーバー再起動は権限昇格の使用上限により未実施。
* **2026-06-12**:
  * **スマホ全画面広告・オファーウォール抑止**: AdSenseの全ページ先読みを停止し、手動広告枠が必要になった時だけスクリプトを遅延読み込みする構成へ変更。`NEXT_PUBLIC_ADSENSE_AUTO_ADS_MODE=manual-only`、`NEXT_PUBLIC_FULLSCREEN_AD_MODE=disabled` を既定とし、GAM Rewarded Adは二重フラグで明示許可しない限り起動しないようにして、スマホで閉じられない全画面動画・オファーウォールの再発リスクを下げた。
  * **RaceTabsデプロイエラー修復**: `RaceTabs.tsx` に欠落していた `handleJraVenueSelect` を復旧し、JRA開催場タブ切り替え時の再描画キー更新とGA計測をNAR側と同等に整理。Vercelデプロイ時の `Cannot find name 'handleJraVenueSelect'` 型エラーを解消し、`npm run build` 成功を確認。
  * **記事生成品質ゲート強化**: `agent_editor.ts` のGemini Editorレスポンスを堅牢なJSON抽出へ変更し、JSONパース失敗やAI Editor非承認時にSEO機械チェックだけで公開承認しないよう修正。Gemma複数観点レビューは構造化メモへ圧縮して最終Editorへ渡し、ノイズ混入を抑制。
  * **検索カニバリ抑制 & 地方重賞対応**: `news_topic_planner.py` に `KEIBA_NEWS_MAX_TOPICS_PER_RACE_PER_RUN` を追加し、既定で1実行1レース1本に制限。帝王賞、さきたま杯、関東オークス、JBC、東京大賞典など地方・交流重賞も季節カレンダーとTavilyクエリの対象へ追加。
  * **記事表現ガード追加**: Writer/Editor/SEO Checkerで「軸の筆頭」「消し」「精度の高い予想」「AI偏差値70以上」「絶好枠」などの強い表現を抑制。予測データが空の場合はAI偏差値の具体値・しきい値・予想印を生成しないルールを明文化。
  * **Gemini 503対策**: Writer/Editorの高性能・中性能モデルで一時混雑系エラー（503/high demand等）が出た場合、既定1回だけ短時間待機して同じモデルを再試行。クォータ上限時は再試行せず次モデルへフォールバック。
* **2026-06-11**:
  * **記事トーン改善**: `agent_writer.ts` / `agent_editor.ts` / `seo_checker.ts` 等の文言・表現ルール刷新。煽り表現禁止、語尾ローテーション追加。既存記事24本を一括トーン修正。
  * **記事改善 & 自動生成ロジック適用**: 代表10記事個別修正、全88記事の一括置換（免責配置統一・語法補正）。
  * **自動記事生成（Tavily検索流入最大化）**: レースカレンダー連動、検索意図分類（枠順・出走馬等）のキーワード変換、重複・カニバリ防止。
  * **ニュースPlanner多様化 & 内部DB合流**: `news_topic_planner.py` のTavilyクエリを追い切り・前走後評価・陣営コメント・話題馬/騎手まで拡張。さらに `search_angle_label` で最終追い切り・坂路追い・巻き返し条件などへ細分化し、同一レースという理由だけで日次生成を止める長期クールダウンを撤廃。既存記事・未消費WriteOrderとの `target_keyword` 重複は維持し、該当レースのAI予想、コース統計、馬番有利度、AI展望テキストをWriteOrderへ自動マージする構成へ更新。
  * **Editor文字数不足自動補正**: 3,000文字未満時の補足セクション（直前に見る材料等）自動挿入。
  * **記事本文量とLLM使用量ログ改善**: Writer本文目安を3,400〜4,200字、最低3,000字に引き上げ。Writer/EditorのGemini `usageMetadata` をログ出力し、1記事ごとの入力・出力・合計トークンを確認できるように更新。
  * **記事生成LLMの役割別ルーティング**: `gemini-3.5-flash`（高性能）を初稿生成、`gemini-3-flash-preview`（中性能）を最終編集、`gemma-4-31b-it`（低制限）を検索意図ブリーフと複数観点レビューへ割り当て。Gemmaで「検索意図」「本文深掘り」「トーン・事実性」の3回添削を行い、本文基準を3,000字以上へ拡張。
  * **Gemini制限時のActions失敗判定化 & ニュース起点Planner接続**: Tavilyでのニュース取得を `write_order.json` に変換する `news_topic_planner.py` の追加。
* **2026-06-10**:
  * **収益・UI改善**: 楽天競馬本掲載、物販PR（Tシャツ等）文言・CTAの最適化。過密広告（InFeedAd、fallbacks）の削減。記事本文直後へのアフィリエイト枠移動。
* **2026-06-09**:
  * **収益改善**: アフィリエイト商品枠表示改善（楽天画像・価格動的表示）、楽天API affiliateUrl非同期自動解決の実装。アフィリエイト導線基盤（AffiliateSlot）追加。
  * **UI・設定**: レース日別ページ「今日まず見るレース」等の補助ダッシュボード表示撤去。自動広告単独テストを終了し手動広告既定ONに復旧。Microsoft Clarity（ヒートマップ）導入。
* **2026-06-07**:
  * **構造化データSSR化**: Client Component内JSON-LD出力を廃止し `StructuredData.tsx` でのSSRに統一。低CTR記事（荒れ分析、人気的中率、武豊）のメタ最適化。
* **2026-06-06**:
  * **UI改善**: 記事詳細の最上部へ「本日の分析を見る」等の価値訴求・回遊導線を追加。トップページ下部「競馬データの見方」重複セクションの整理。
* **2026-06-05**:
  * **UX改善**: SC指摘のCLS対策（AdUnit、NativeCardAd等の未配信時枠キープ、RecentRaceReturn of SSR化）。
  * **収益改善**: GAM Rewarded Ad在庫不安定のためリワードゲートをデフォルト一時停止（通常広告回収）へ変更。既存記事の不自然表現を一括置換。
  * **データ復旧**: 地方競馬データ文字化け（デコード誤り）を修復、当日APIキャッシュTTLを5分へ短縮。
* **2026-05-21**:
  * **回遊・検索・信頼・データ改修**: 「競馬データ辞典」などのハブページ新設。騎手・コース個別ページ拡張（計100ページ以上）。Next.js側静的インデックスによる横断検索の実装。
  * **精度検証API**: バックエンド `/api/v1/predictions/stats/accuracy` からAI偏差値の実測勝率等を取得するよう改修。
  * **レースURL安定パス化**: クエリ型（`?race=11&venue=東京`）から安定パス（`/races/YYYY-MM-DD/venue-slug/raceNumber`）へ移行、旧URLは301リダイレクト。
* **2026-05-19**:
  * **広告枠連携**: AdSense Offerwall（リワード広告）を公開。GAM Rewarded Adの準備・検証およびタイムアウト処理（5秒）の追加。
* **2026-05-17**:
  * **ホーム画面改修**: サンプルカード（AI偏差値等の可視化）と的中ランキングを上部集約し、価値訴求後に広告が入る配置に変更。
  * **レース予想ページ**: PC幅のコンテナ拡張とスマホでの指標解説・分析ブロックの圧縮、クライアント再取得時のデータ上書きバグ修正。
* **2026-05-16**:
  * **広告配置**: 予想表直前の広告を撤去し、確認後の自然な区切りに集約。
  * **パイプライン復旧**: 記事生成・編集・SEOチェックの審査矛盾整理、失敗時のwrite_order退避（`failed/`）。
  * **Gemini最適化**: AI Studio無料枠制限対策（Flash-Lite優先、使用回数の記録、1cronあたり上限8リクエスト）。

---

## 9. 重要なリマインダー

### ユーザーへの確認プロセスの徹底
各ステップ（またはタスク）の実行時は、以下のフローを守り丁寧なコミュニケーションを行います。
1. **実装前**: 実装内容と影響範囲、変更対象ファイルの説明
2. **実装中**: 必要に応じて進捗の可視化（`task.md`やToDoリストの活用）
3. **実装後**: ローカル環境での動作確認方法と確認ポイントの提示
4. **完了後**: 進捗記録の更新報告

### Codexとしての行動指針
* 本保守ガイドおよび各設計仕様書から逸脱しない
* 複数の大きな修正を並行して行う場合は、必ずユーザーの明示的な許可を得る
* 品質基準（特にUIの自然さ、絵文字の抑制、文体ガード）を厳格に守る

---

## 10. まとめ
UMA-FREEの収益化成功（AdSense合格）という現在のステージを維持し、さらに利益を最大化するためには、**「安定したシステム運用」**と**「ユーザー体験を阻害しない自然なUI/UX・広告配置」**の両立が極めて重要です。

本保守ガイドの原則を守り、データやユーザーのフィードバックに基づいた着実な保守・改善を続けていきましょう。
