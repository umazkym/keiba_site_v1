# Codex - UMA-FREE 収益最大化&自動運用 保守ガイド

## 0. Agent SOP参照ルール

このリポジトリでは、反復作業や高リスク作業の手順知を `agent-sops/` に分離して管理します。`AGENTS.md` は常時守る基本方針、`agent-sops/` は必要時に読む標準作業手順、`docs/` は背景資料として扱います。

* **SOP索引の確認**: 実装・運用・記事生成・広告/アフィリエイト・本番DB・計測・コスト/性能に関わる依頼では、作業前に `agent-sops/INDEX.md` を確認し、該当する `.sop.md` を読んでから進めます。
* **必要なSOPだけ読む**: すべてのSOPを毎回読むのではなく、依頼内容に関係する1〜3本を選んで参照します。複数領域にまたがる場合は `agent-sops/task-intake-and-sop-routing.sop.md` を入口にします。
* **上位指示を優先**: SOPがユーザー指示、システム指示、または本ファイルの基本原則と矛盾する場合は、より上位の指示を優先し、SOP側に更新余地があることを報告します。
* **作業知の還元**: 作業中に再利用できる手順、再発しやすい失敗、検証方法の変更を見つけた場合は、既存SOPの更新または新規SOP候補として残します。
* **形式検証**: SOPを追加・更新した場合は、可能な範囲で `npm run agent-sops:validate` を実行して形式を確認します。

---

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

* **2026-07-23**:
  * **YouTube自動集客基盤v7と3日間非公開ゲートを実装**:
    翌日開催の全会場へ長尺1本ずつ、最優先レースへShort 1本を生成する構成へ統一し、19:17 JST生成、Short 20:10、最優先会場20:30、残り10分間隔の固定予約を設定した。競馬場slugをPython/Next.js共通JSONへ集約し、動画リンクを正規レース詳細URLとUTMへ修正。`race_view`にはYouTube流入属性を一度だけ付与し、Shortsのプロフィール流入も次のレース到達まで30分だけ保持する。仮想PVは追加していない。Shortsの無効なカスタムサムネイル設定を廃止し、最初のレース固有フレームを表紙化。横長サムネイルは2MB未満のJPEGへ変更した。`VideoPackage`と`video_publications`を追加し、動画ID保存後にサムネイル、処理確認、非公開レビュー/予約公開へ進む再開可能な状態管理を実装。DB全レースと予測を照合して欠損会場だけを止め、権利・表現・過去7日エラー時は非公開レビューへ戻し、既存予約も解除確認する。既定は`private_review`で、3開催日合格後に`scheduled_public`へ手動切替する。映像・画像・音声・文章の生成AI、新規有料サービス、公開API、広告配置、IAP接続方式は変更していない。
  * **GSC週次SEO監査と重賞投稿スケジュール保護を実装**:
    Search Consoleの確定済み直近28日と直前28日を毎週水曜09:15 JSTに比較し、公開中・自己canonicalの記事から表示100以上、平均順位4〜20位、順位帯CTR中央値に対する推定取りこぼしクリック上位10件をActions Summaryとartifactへ出す監査workflowを追加した。開催7日前から開催後3日の重賞は季節需要へ分離し、08:00、11:45、16:45 JSTのカレンダー主導生成と年度付き新規URLを維持する。手動改稿はGSC候補の正確なslug1件だけを対象に、title、description、keywords、導入文、H2文言へ限定し、数値、表、本文、リンク、canonical、公開日、entity、更新段階、広告・レースブリッジの差分を拒否する。改稿クエリはEvidenceへ渡さず、同一slugへ28日クールダウンを適用する。重賞予約変数を`ARTICLE_PIPELINE_RESERVE_RACE_UPDATE_SLOT`へ統一し、緊急重賞3件が通常の最大3枠をすべて使える挙動を固定した。広告配置、Offerwall、公開API、DB、計測イベントは変更していない。
  * **GSC接続の外部設定と費用条件を記録**:
    `keiba-api-project`でSearch Console APIが有効であること、GitHub Actions用サービスアカウントを`sc-domain:uma-free.com`へ「制限付き」で追加したこと、Repository Variable `GSC_SITE_URL=sc-domain:uma-free.com`を登録したことを実画面で確認した。Search Console APIは無料で利用上限のみがあり、外部設定自体にも継続料金はない。GitHub Actionsはリポジトリの公開状態・契約プランに応じた標準runnerの無料条件とartifact保存枠に従う。詳細と再点検条件は`docs/gsc_weekly_seo_operations.md`に残し、403、認証エラー、変数欠損の実証がない限り再設定や権限昇格を行わない。
  * **記事自動生成CIの複数列Evidence回帰を修復**:
    Writer向けサニタイズが`label/value`形式だけを残し、騎手リーディングやData Scientistの複数列`key_metrics`を空にしていたため、列名とスカラー値を保持しつつ、外部出典行、URL、媒体名、制作メタだけを除去する構成へ修正した。`jockey_profile`と`jockey_data`で`evidence_rows > 0`、外部情報だけのデータ記事は拒否となる回帰テストを追加。川田将雅騎手の記事は2026年6月26日時点の検証済み成績だけで同じcanonicalのまま改稿し、未根拠のオッズ、得意条件、厩舎相性、歩様、強い購入誘導を削除した。13 workflowの`checkout`、`setup-node`、`setup-python`をNode 24対応のv7へ更新し、プロジェクトのNode.js 20とPython 3.11は維持した。広告配置、Offerwall、記事レースブリッジ実験、Geminiモデル構成は変更していない。
  * **楽天競馬アフィリエイトの適格化実験を安全な待機状態で実装**:
    2026年6月10日〜7月22日のTrafficGateクリック502件・発生0件を基準に、楽天競馬の表示対象をホーム地方開催一覧直後とNARのAI偏差値表直後へ限定する`qualified_nar`モードを追加した。新規登録向けの成果条件に合わせた見出し・補足・CTAへ変更し、カード全体リンクを廃止して44px以上の明示CTAだけを操作対象にした。適格化モードでは共通ヘッダー、JRA、日別ページ下部を非表示にする。配置別TrafficGate URL用の環境値を追加し、未設定・不正時は検証済み現URLへ戻す。GA4の表示・クリック双方へ`provider`、`context`、`campaign_id`、`link_id`、`race_type`を揃え、`providers`は表示イベントの互換値として維持。実験`AFF-RAKUTEN-QUALIFIED-NAR-2026-08`を台帳へ登録したが、Offerwall・記事レースブリッジの先行判断、TrafficGate確認、D+28リマインド登録が未完のため、既定は`legacy`のままとし本番表示変更は開始しない。
  * **重賞記事から検証済み個別レースへ送客する収益保護ブリッジを実装**:
    記事からレースへの直接遷移2.18%、主要重賞記事の同一ページ離脱94.2〜98.7%を受け、広告枠・Offerwall・自動アンカーを変更せず、個別レース導線だけを再設計した。Python/TypeScript共通の重賞識別レジストリ、開催日と正規化名を一意照合する軽量プレビューAPI、実AI偏差値上位3頭を表示する`ArticleRaceBridge`、記事から最初の一致レースまでのsessionStorage計測を追加。`race_bridge_enabled`は既定falseで、Publisherがrace ID、年度、正確なURL、予測データを検証できた場合だけ有効化する。無効時はDOM・ローディング・予約余白を出さず、検証後の一時API障害では保存済みの正確なリンクだけを残す。既存223記事のオフラインdry-runは重賞候補69件すべて必須メタデータ不足で、自動補完・有効化は0件。新規重賞記事は`{entity-key}-{season-year}`で同一年度を段階更新し、重賞ハブは本文複製から年度別記事一覧へ変更した。分析・実験台帳・計測計画・記事フロー・デザイン規則・記事/広告SOPへ判断と復元手順を記録した。
* **2026-07-22**:
  * **広告収益保護の実験運用基盤とレース画面軽量化を実装**:
    `docs/monetization_experiments.md` を正式台帳として追加し、Offerwall実験を `ADS-OFFERWALL-2026-06` として遡及登録。2026-07-29 09:00 JSTの終了判断、2026-07-30 09:00 JSTのGA4・CWV準備判定、記事CTAの14日固定観測を確認する2026-08-04 09:00 JSTのリマインドを登録し、リマインド未登録時は開始不可、サンプル不足時は7日延長、終了時は勝者または元設定を同時反映する手順を広告SOPへ固定した。GA4はhead内でConsent Mode、gtag.js、configをClient Componentより先に初期化し、準備前イベントの一度だけ送信するキュー、`web_vital`、`adsense_offerwall_view`、`ad_experiment_exposure`を追加。レース切替は仮想PVを送らず`race_view`へ統一した。RechartsをCSSグラフへ、Tippy/Popper群を共有のアクセシブル補足UIへ置換し、分析の遅延ロード、IntersectionObserverによるセクション判定、広告オーバーレイ監視の一元化を実施。レースルートのFirst Load JSは144KBとなり180KB以下を達成した。記事・画像サイトマップをSearch Consoleへ送信し成功、canonical限定、旧URLの一段301、重複タイトル、馬場状態記事を改善。再監査で記事サイトマップ155件中54件が自己canonicalながら`noindex`だったため、重複元をcanonical集約したまま集約ページをindex可能へ修正した。375/390/768/1024/1440px、18頭表示、横スクロールなし、補足UIのEsc操作、ブラウザエラーなしを確認し、`npx tsc --noEmit`、`npm run build`、`npm run design:audit`、リンク・記事品質・SOP検証が成功。
  * **記事生成LLMをGemini 3.6世代の4段階構成へ更新**:
    WriterとEditorは `gemini-3.6-flash`、`gemini-3.5-flash`、`gemini-3.5-flash-lite`、`gemini-3.1-flash-lite` の品質順でフォールバックし、呼び出し回数の多いStrategyと複数観点レビューはRPD 500のLite系を優先する。モデル別のRPM、TPM、RPDを共通定義へ集約し、GitHub Actionsの日次合計上限を1,040へ同期。指定値に従い `gemini-3.1-flash-lite` のTPMは250として扱う。`npx tsc --noEmit` と `npm run article:test-independence` が成功。
* **2026-07-21**:
  * **4分析グラフィックの復帰と記事流入から当日レースへの導線強化**:
    AI偏差値、対戦成績、展開・脚質、枠順傾向をミニグラフで示す共有コンポーネントを追加し、ホームのヒーローと全記事のタイトル・リード直後へ統合。記事では4つの分析価値を説明した後に「今日の全レース分析を見る」CTAを1つだけ配置し、`/races/today`、`prefetch={false}`、既存の`article_race_click`計測を維持した。ホームの日付生成がJST日付をUTCへ再変換して前日URLを作る場合があったため、`Intl.DateTimeFormat(...).formatToParts`で年月日を直接構成し、更新表示、開催一覧、CTAを当日URLへ統一。390pxでは2列、1440pxでは4列表示と横スクロールなしを実ブラウザで確認し、`npx tsc --noEmit`、`npm run design:audit`、221記事のリンク検証、`npm run build`が成功。
* **2026-07-21**:
  * **記事独立性ゲートとコンパクトな4視点導線を実装**:
    外部媒体のタイトル・URL・要約・推奨・コメントをWriter入力から除外し、`WriterEvidence`を公式確認事項とUMA-FREE掲載データだけに限定。`news_context`は公開不可とし、レース更新、コース、騎手、入門へ分類するゲートをPlanner、Writer、Editor、SEO Checker、Publisherへ追加した。公開中220記事を全件監査し、媒体・制作メタ依存の記事を再編集、競馬外比喩記事と野畑凌騎手記事を全面改稿、根拠不明の数表3記事を確定結果中心に再構成し、Shepherd's Choice記事は地方競馬結果回顧へ301統合した。記事冒頭は説明文のない「タイトル＋4列ミニグラフ」の単一リンクへ圧縮し、ホーム用の情報量は維持。独立性テスト、記事監査、リンク、SOP、型、ビルド、主要画面幅のブラウザ確認を品質ゲートとする。
  * **レース内4視点ナビを記事グラフィックと統一**:
    レース日・レース詳細で共通利用するモバイル下部ナビとPCジャンプナビを、AI偏差値、対戦比較、展開・脚質、枠順傾向の4項目へ統一。記事冒頭と同じアイコン、役割色、ミニグラフを共有部品から描画し、従来の黒い5分割メニューと重複定義を廃止した。選択中はBlueの罫線、淡い背景、太字、`aria-current`で示し、44px以上の操作領域、safe-area、`prefers-reduced-motion`対応を維持する。
* **2026-07-20**:
  * **デザイン規律の共通化と主要3画面のUI/UX刷新**:
    外部のデザイン知見をUMA-FREE向けに再構成し、`DESIGN.md`をデザイン判断の基準として追加。色、タイポグラフィ、余白、角丸、モーション、アクセシビリティ、画面別の情報優先順位を明文化した。共通ヘッダーにはスキップリンク、現在地表示、モバイルメニューのフォーカス復帰とEscape操作を追加し、ホームは「AI偏差値→対戦・展開→枠順確認」の理解順へ整理。レース画面はジャンプナビ、重賞一覧、下部ナビ、予想表を省スペースかつ44pxタッチ領域で統一し、記事画面はメタ情報、見出し、リード、アイキャッチ、本文の順に再構成した。広告・アフィリエイトの配置、PR表記、計測、ISR、動的リンクの`prefetch={false}`は維持。`design:audit`を追加し、過剰な角丸・グラデーション・ホバー移動・`transition-all`・点滅アニメーションの再混入を自動検出する。390/375/768/1024/1440pxの実ブラウザ確認で横スクロールなし、18頭表示、長い馬名、欠損値、重賞5件、記事の読み幅を確認し、`npm run build`、`npx tsc --noEmit`、`npm run design:audit`、`npm run article:validate-links`、`npm run agent-sops:validate`が成功。
  * **当日レース更新中の一時欠損を解消**:
    予測再生成ジョブが対象日すべての既存予測を先に削除・コミットし、再収集が終わるまで公開APIが404になる問題を修正。既存予測を維持したまま、新しい予測が完成したレースだけを削除・追加の同一トランザクションで置き換える構成へ変更し、取得・挿入失敗時は前回の正常データを残す。地方競馬と祝日開催を取りこぼさないよう当日朝のデータ取得を毎日実行へ変更。原子的置換、挿入失敗時のロールバック、レース一覧取得失敗時の旧データ維持を回帰テストで確認し、関連7テストとPython構文検証が成功。
  * **YouTube動画v6・素材権利ゲート・実動画尺の安定化**:
    競馬写真＋スポーツ誌紙面の動画デザインへ更新し、中央10場・地方14場のコース図、横縦の共通写真、公式ロゴ、18頭表示、Shorts安全領域、コンタクトシートを実装。写真は約24MBのPNGから約3.3MBの高品質JPEGへ圧縮し、Cloud Run用Dockerコンテキストから動画資産を除外した。DOVA-SYNDROMEのBGM原本は再配布を避けて非公開Cloud Storageへ分離し、GitHub Actions用サービスアカウントだけに読み取り権限を付与。`credits.json`の`credit`・`license`欠損をエラーにする権利ゲートを追加した。FFmpegのクロスフェード連結でShortsが約5.6秒へ短縮される問題は、入力タイムベースを統一して約16.0秒へ復旧し、動画尺・H.264・AAC 48kHzを回帰テストで固定した。
* **2026-07-05**:
  * **重賞カレンダー主導の記事生成スケジュール化**:
    重賞名検索の流入を優先するため、`news_topic_planner.py` を重賞カレンダー締切ベースへ拡張。中央重賞は金曜11:45 JST以降の枠順確定後候補と16:45 JST以降の結果回顧更新、地方重賞は2日前直前記事のみを生成対象にした。優先順位はG1、Jpn1、G2、Jpn2、G3、Jpn3、その他重賞の順に明示し、2日前を過ぎた未生成重賞は `missed_preview` として補完する。WriteOrderには競馬場・距離・コースを含むSEOキーワード、`update_stage`、`deadline_status`、結果確定フラグを持たせ、既存重賞記事は同URL更新で育てる。Actionsへ11:45/16:45 JST実行を追加し、旧GradeRaceWriterは既定OFF。`py_compile`、`test_news_topic_planner.py`、`npx tsc --noEmit`、`npm run article:validate-links`、`npm run article:audit-quality`、`npm run build` 成功。品質監査のcritical/warningは既存記事由来の残課題として継続。
  * **北九州記念の専用記事追加と重賞エンティティ補完**:
    北九州記念は `news_topic_planner.py` の日程補完では候補化されていたが、公開済み記事ディレクトリでは6月29日以降の記事がなく、北九州記念専用記事が存在しなかった。さらに、重賞エンティティのalias、PublisherのraceNameMap、記事アーカイブseedに北九州記念が未登録で、生成・公開後も重賞アーカイブへ接続しにくい状態だった。`2026-07-05-kitakyushu-kinen-2026-field-analysis.md` を追加し、北九州記念を `kitakyushu-kinen` として planner、grade_race_writer、publisher、記事アーカイブへ登録。7月5日のrace-day補完でWriteOrder対象に残る回帰テストも追加した。`py_compile`、`test_news_topic_planner.py`、`npx tsc --noEmit`、`npm run article:validate-links`、`npm run article:audit-quality`、`npm run build` 成功。品質監査のcritical/warningは既存記事由来の残課題として継続。
* **2026-06-29**:
  * **物販アフィリエイト停止と楽天競馬導線の控えめ化**:
    Amazon・楽天市場の物販アフィリエイト3キャンペーンを一時停止し、記事末尾とトップの物販専用枠を撤去。楽天競馬枠は塗りつぶしボタンから薄いローズの案内枠と白背景リンクへ変更し、地方レースでは予想表の前ではなく予想表確認後に表示する構成へ移動。PCサイドバーの楽天競馬重複枠も外し、レース確認の邪魔になりにくい導線に整理した。さらに投票系リンクが1件だけの場合は枠全体をクリック可能にし、ボタンだけを狙わなくても自然に遷移できるようにした。
* **2026-06-28**:
  * **楽天競馬ヘッダー導線の追加**:
    楽天競馬アフィリエイトのクリック数に対して登録が伸びていない状況を受け、全ページ共通ヘッダーへ控えめな「PR 地方競馬の投票は楽天競馬で」リンクを追加。色は楽天競馬ロゴに近い `rose-600` / `rose-50` 系へ寄せ、ヘッダークリックは `affiliate_click` の `site_header` としてGA4/Clarityへ送信する。広告審査・読者信頼を損なわないよう、`PR` 表記、`rel="sponsored nofollow noopener noreferrer"`、20歳以上対象のtitle文言を維持する。
  * **Vercel Fast Origin Transfer無料枠対策の追加削減**:
    Vercel HobbyのFast Origin Transfer 10GB到達通知を受け、トップページとレース詳細ページの転送量を再監査。トップページは全レース・全馬の予測データをClient Componentへ複数回渡していたため、開催場要約、注目馬3枠、重賞上位馬だけを抽出する `home-page-summary.ts` を追加し、`HomeTodayVenues`、`SpecialPickCard`、`WeeklyGradeRaces` は要約propsで描画する形へ変更した。トップの当日API取得は5分ではなく30分再検証を明示し、`index.html` は約1.17MBから約105KB、`index.rsc` は約1.02MBから約49KBへ削減。レース詳細ページは選択レース中心の初期データだけを渡し、通常レース詳細URLの大量ISR生成を抑えるため、サイトマップ掲載は日付ページと重賞詳細中心へ絞った。`npx tsc --noEmit`、`npm run build` 成功。
  * **記事公開ゲートの「無条件」補正追加**:
    添付ログで、承認済み記事の公開直前に `article:validate-links` が「無条件」を強すぎる表現として検出し、同時公開予定の記事をロールバックしていたことを確認。SEO Checkerの禁止語とEditorの自動補正へ「無条件」の置換を追加した。トップの近日重賞欄は時間差でAPI表示が復旧する運用前提のため、静的な先日程フォールバックは使わず、従来通りDB/API由来の直近重賞だけを表示する。
* **2026-06-27**:
  * **記事生成の重賞偏重緩和と常設コラム枠の追加**:
    ルート直下の `中央競馬重賞一覧.txt`、`地方競馬重賞一覧.txt` を `news_topic_planner.py` で読み込み、既存内蔵・リモート日程より手元の2026年重賞日程を優先して `RaceDemand` へマージするよう変更。直近重賞の優先度は維持しつつ、`editorial_evergreen_planner.py` を追加し、`中央競馬ジョッキーリーディング.txt`、`地方競馬ジョッキーリーディング.txt`、`中央競馬ｺｰｽ一覧.txt`、`地方競馬ｺｰｽ一覧.txt` から、騎手分析、競馬場単位のコース分析、入門ガイドをローテーションでWriteOrder化する構成にした。コース記事は距離別に分割せず、競馬場ごとに各距離を表で束ねる。
    GitHub Actionsの記事生成フローへ常設コラム生成ステップを追加し、最終パイプラインでは最大3記事処理時にニュース枠と常設コラム枠を予約できるよう変更。Writer、Editor、Publisher、ArticleFlowには `course_venue`、`jockey_profile`、`beginner_guide` のカテゴリ、締め見出し、外部調査クエリを追加した。入門ガイドは20トピックへ拡張し、WriteOrder入力文に `期待値`、`勝負気配` などの文体ガード対象語が混入しない回帰テストも追加。さらに `docs/reference_data_summary.md` のMarkdown表を常設コラムplannerが直接パースし、騎手リーディングと中央・地方コース要点を既存 `.txt` データへマージする構成にした。ルート直下の6つの `.txt` は将来削除される補助スナップショット前提とし、今後の追加・修正では `docs/reference_data_summary.md` を主データソースとして扱う。騎手分析候補は上位30名で打ち切らず、既存・pending・postedで除外後に31位以降へ進めるよう修正。`py_compile`、`backend.tests.test_news_topic_planner`、`backend.tests.test_editorial_evergreen_planner`、`npx tsc --noEmit`、`npm run build` 成功。
* **2026-06-26**:
  * **Vercel Hobby使用量超過対策・レースページの実ISR化**:
    Vercel Usageで直近30日のFluid Active CPUが8時間16秒/4時間、Fast Origin Transferが15.38GB/10GB、Function Invocationsが576,500回まで増えていたため、レース日付・詳細ページを監査した。コードコメント上はISR導入済みだったが、`next build`では両ルートが`ƒ Dynamic`、本番も毎回`X-Vercel-Cache: MISS`となっていた。動的化の原因だった日付ページmetadataの`searchParams`依存を除去し、動的パラメータを初回アクセス時に生成するオンデマンドISRへ変更。直近日付は5分、過去日は1時間で再検証し、ローカル本番環境で日付・詳細とも`MISS → HIT → HIT`、過去日は`s-maxage=3600`を確認した。
    予測APIの一時的な5xx・通信失敗は404へ変換せず例外として扱い、ISR再生成失敗時に最後の正常キャッシュを維持できるよう変更。データ投入前の前日～2日後は200の更新待ち状態を維持し、ブラウザから再取得できる構成とした。`/races/today`は静的ビルド時の日付ではなく、Middlewareでアクセス時点のJST日付へ307転送する。
    全ページ共通ヘッダーやレース関連記事・重賞・的中ランキング等の`next/link`による自動プリフェッチが、ユーザー操作前に動的レースFunctionを起動する可能性があるため、レース導線と動的な記事一覧導線で`prefetch={false}`を設定。クリック後の遷移、GA4計測、AdSense配置、アフィリエイト導線は維持した。記事Markdownはデプロイ内で一度だけ解析するメモ化を追加し、レースページへ渡す記事情報を表示に必要な5項目へ縮小。PC・390pxモバイルで横スクロールなし、AdSenseスクリプト・広告枠、楽天競馬PR表記と`sponsored nofollow noopener noreferrer`の維持を確認。`npx tsc --noEmit`、`npm run build`成功。
* **2026-06-22**:
  * **中央競馬ページへの楽天競馬導線追加**:
    土日のアクセスが中央競馬ページへ集中すると、地方競馬限定だった楽天競馬アフィリエイトの表示機会が減る構成を見直した。中央競馬向けに `rakuten-keiba-jra-audience` キャンペーンを追加し、「地方競馬も確認する方へ」「楽天競馬の案内を見る」と、中央競馬の投票先であるように誤認させない文言へ分離。中央競馬のレース詳細では、AI偏差値表直後にあった手動InFeed広告を楽天競馬枠へ置き換え、広告枠数を増やさずモバイルでも確認しやすい位置へ配置した。PCサイドバーの重複表示は地方競馬だけに限定した。`npx tsc --noEmit`、`npm run build`成功を確認。
* **2026-06-20**:
  * **Clarity監査の完全性再確認とホーム収益導線計測の補完（2026-06-21 01:35 JST）**:
    前回のData Export API監査は集計範囲の初回調査であり、録画、ヒートマップ、JavaScriptエラー本文、GA4/AdSense/アフィリエイト突合が未完了であることを明文化した。UTC日次枠の残り2回を使う`pulse`プロファイルを追加し、最新24時間を再取得。164セッション、ボット79、ページ/セッション4.06、デッドクリック15.85%、クイックバック32.32%、JavaScriptエラー1.83%で、デッドクリックは72時間値15.88%から横ばい。東京11RのPCは10セッション中50%にデッドクリックが残っていたが、修正前後が混在するため効果判定は保留とした。
    公開サイトではClarityタグ`x3vmax3h3t`、収集POST、当日一覧CTA、ホームカードのホバー削除、`affiliate_click`イベントと関連タグの本番発火を確認した。ホームからレースへ進む入口を`home_race_entry_click`として`hero_cta / grade_fallback / venue_card`別にGA4とClarityへ送信し、公開サイトで`home_entry_method=hero_cta`と`home_race_entry_click`の本番発火まで確認。`ad_impression_custom`もClarity録画へ連携する処理を追加したが、広告が`filled`の時だけ発火するため、空振りした自動検証環境では実発火未確認。標準ページ計測と重複する`view_home`等のカスタムイベントは削除した。`npx tsc --noEmit`、`npm run build`、Python構文検証が成功。残課題と完了条件は`docs/clarity_completeness_review_20260621.md`へ整理した。
  * **Clarity API監査・誤操作削減・収益導線の録画連携**:
    Microsoft Clarity Data Export APIから直近72時間を、URL、端末、流入元、地域、キャンペーンの8クエリで取得する`backend/scripts/export_clarity_insights.py`を追加。APIトークンを成果物へ含めず、JSON、CSV、Markdownを`analysis_results/clarity/20260620T105522Z`へ出力した。人による359セッションに対してボット108件、モバイル73.0%、PC25.6%、デッドクリック15.88%、クイックバック25.63%、JavaScriptエラー2.51%を確認。PCのデッドクリックは27.17%で、東京11RではPCの45.45%に発生していた。
    現在表示中のレース番号とPC同日レース一覧が押せる見た目のまま無反応になる構造を、`aria-current="page"`付きの非操作要素へ変更。ホームの非リンク機能カードからホバー移動を外し、「今日のレース分析」CTAは特定1Rではなく当日一覧へ着地させた。Clarityにはページ領域、レース閲覧・移動、予想表表示、記事読了、記事からレースへの移動、アフィリエイト表示・クリック、リワード関連のカスタムイベントを追加し、収益につながる操作の録画を絞り込めるようにした。`npx tsc --noEmit`、`npm run build`、Clarity取得スクリプトの`py_compile`が成功。詳細は`docs/clarity_optimization_audit_20260620.md`に整理した。
  * **GCP課金監査とAPI通信・DB取得・自動デプロイの低コスト化**:
    GCP構成と直近29日のCloud Runメトリクスを確認し、DB VM `keiba-db` は無料枠対象の `us-west1-b / e2-micro / pd-standard 30GB`、外部IPv4なし、Cloud NAT・VPCコネクタなし、Cloud Runは最小インスタンス指定なし・request-based課金・最大3インスタンスで、固定費を抑えた構成であることを確認した。Cloud Runは132,804リクエスト、CPU約20,573 vCPU秒、メモリ約9,483 GiB秒で無料枠内。一方、当日レースAPIの実測レスポンスは約391KBでgzip未使用だったため、`GZipMiddleware`を追加し、1KB以上の応答を圧縮レベル6で配信する構成へ変更。実データ相当では約79.7KB、約79.6%削減できることを確認した。
    `get_predictions_by_date` は `predictions` と `results` を同時に `joinedload` して直積的に行数が増える構成だったため、`selectinload`へ変更し、レスポンス構造を維持したままDB内部通信量とメモリ使用量を抑える形へ変更。gzip適用、小レスポンス非圧縮、予測・結果・馬番傾向の返却互換性を検証する `backend/tests/test_api_cost_optimizations.py` を追加し、同テスト2件、既存記事生成テスト8件、`py_compile`が成功した。
    Cloud BuildのGitHubトリガーは、Dockerfileとビルドコンテキストがともに`backend`配下のみであることを確認し、`includedFiles: backend/**`を設定。フロントエンド、記事、ドキュメントだけのpushでは不要なCloud Runビルドを起動せず、バックエンド変更時は従来通り自動ビルド・デプロイする。Artifact Registryには14日超のイメージ削除・最新10件保持のクリーンアップポリシーが設定済みで、追加の手動削除は行わない。
  * **トップの重賞枠をレースページと統一**:
    トップページだけ近日重賞APIの結果を当日分へ絞り込み、重賞がない日は独自の空表示へ差し替えていた構成を廃止。レース日別ページと同じ `WeeklyGradeRaces` を、同じ「近日の重賞レース」タイトル・今日から14日間の中央/地方重賞・G1/Jpn1級の注目カード・その他重賞の区分表示でそのまま利用する形へ統一した。API取得失敗時のみ「近日の重賞情報を確認中です」と表示する。
  * **一般ニュースの季節外れ日付を遮断**:
    6月19日の記事生成で、重賞名を持たない `news_context` が重賞カレンダーの期間判定対象外となり、2月14日の京都競馬場（2回5日目）の馬場情報を現在のニュースとして公開した問題を修正。一般ニュースのタイトル・本文から `YYYY年M月D日`、`M月D日`、ISO日付を抽出し、Tavily検索のlookback期間または直近開催期間から外れた明示日付しかないソースを候補から除外する。SEO Checkerにも `scheduled_race_date` を持たない `news_context` の日付鮮度チェックを追加し、公開日から7日以上離れた開催日だけを扱う記事を拒否する。誤公開された京都馬場記事は `draft: true` へ戻した。
* **2026-06-19**:
  * **記事画像軽量化・広告CLS・hydrationエラー対策**:
    共通アイキャッチ4枚（`data-analysis-eyecatch.png`、`beginner.png`、`jockey.png`、`jyusyo-eyecatch.png`）を同じ1024px PNGのままパレット最適化し、合計約3.1MBから約124KBへ削減。参照URLを変えず、記事・関連記事・ホームの既存表示を維持した。AdSense枠はGoogleが空振り時に祖先要素へ `min-height: 0 !important` を付与する挙動を確認したため、通常フローの独立スペーサーと絶対配置の広告DOMを分離し、デスクトップ280px・モバイル250px、インフィード220pxを予約する構造へ変更。未配信広告の `aria-hidden` を外し、非表示時は `visibility` とポインター制御でフォーカス可能な広告要素との競合を避けた。ページレベルAdSenseスクリプトはhydration後に動的読込し、ヘッダーの日付と的中ランキング期間、関連日付導線をSSRとブラウザで決定的な値へ変更。`npx tsc --noEmit`、`npm run article:validate-links`、`npm run build`成功。ローカル本番ビルドをホーム・記事・レース詳細、PC・モバイル幅で確認し、React #422/#425は再現せず、広告空振り後も予約高が維持されることを確認した。
  * **開催前の回顧記事防止と直近重賞の候補補完**:
    6月21日開催予定の一條記念みちのく大賞典が、6月19日時点で `search_intent=result_review`、`race_phase=post_race` の回顧記事として公開された問題を修正。開催前に検索結果から「結果」「優勝」等を検出した場合は前年以前の材料とみなし、当年の結果回顧ではなく `past_trends` へ変換する。Tavilyに適切な記事が見つからなくても、公式重賞日程から開催直前の未作成レース候補を補完し、府中牝馬SやしらさぎSなどが検索結果の偶然で候補から消えない構成へ変更。下書き記事は重複判定から除外し、誤公開された一條記念みちのく大賞典記事は `draft: true` へ戻した。ArticleFlowでは開催日から算出した段階とWriteOrderの `race_phase` を照合し、Writer後のfrontmatterが `search_intent`、`race_phase`、`scheduled_race_date` を改変した場合もcriticalで拒否。SEO Checkerにも未来開催日の結果回顧を公開不可とする機械ゲートを追加した。
  * **ホーム当日開催の空表示を自動復旧**:
    当日データ投入前に生成されたホームのISRキャッシュが「本日のレースデータはありません」を保持し、Cloud Run API側では開催データが反映済みでも最初の閲覧者へ古い空状態を返す問題を修正。通常時は従来の30分ISRを維持し、サーバー描画時の中央・地方開催がともに空の場合だけ、ブラウザ側から当日APIをキャッシュなしで再取得する `HomeTodayVenues` を追加した。初回取得でも空の場合は1分後に一度だけ再確認し、未反映時の文言も「データはありません」ではなく更新中であることが分かる表現へ変更。地方開催が取得できた時点で競馬場カードと楽天競馬導線を復旧する。
  * **収益ファネル計測の本番反映とGA4管理画面設定**:
    6月18日に実装した収益ファネル計測を本番へ反映。初回Vercelビルドは、記事ページから参照する新規ファイル `frontend/components/ArticleEngagementTracker.tsx` がGit管理対象に含まれておらず、`Module not found: Can't resolve '@/components/ArticleEngagementTracker'` で失敗した。ユーザーが同ファイル、`docs/analytics_measurement_plan.md`、`backend/tests/test_news_topic_planner.py`を追加し、コミット`2bae3eb`（`収益ファネル計測と記事導線を改善`）を`main`へpushした後、Vercelビルド・デプロイが正常完了した。
    GA4では`affiliate_click`と`article_race_click`をキーイベントとして登録。`affiliate_click`は本番ストリーム`uma-free`でデータ検出済み。`article_race_click`もキーイベント登録済みで、記事内の`/races/...`導線クリックから送信する構成になっている。通常レポートへの反映には時間差があるため、未検出表示の場合はTag AssistantまたはDebugViewで記事からレースページへ移動し、イベント発火を確認する。
    イベントスコープのカスタムディメンションとして、`provider`（アフィリエイト提供元）、`context`（アフィリエイト配置）、`navigation_method`（レース移動方法）、`race_type`（レース種別）、`venue_name`（競馬場）、`article_category`（記事カテゴリ）、`article_slug`（記事スラッグ）、`link_placement`（記事リンク位置）を登録。高カーディナリティ化しやすい`race_id`と`link_path`はカスタムディメンションにしていない。
    Tag Assistantで`https://uma-free.com`へ接続し、Googleタグ`G-10PZFRV2BX`の検出、`affiliate_impression`、`ad_impression_custom`、ページビュー等の送信を確認。Search ConsoleではモバイルCore Web VitalsのCLS・INPについて検証開始の操作を実施し、URLグループ単位の28日間評価を待つ状態とした。Analytics Admin APIやPageSpeed Insights APIを使うPowerShellコマンドは補助的な確認手段であり、今回は実行していない。
  * **広告アカウント通知と性能課題の整理**:
    Google Ad Managerネットワーク`23345285369`の「過去90日間インプレッションなし・今後90日で無効化予定」という通知は、現在一時停止中のGAM Rewarded Adに関するもの。収益稼働中のAdSense自動広告、手動広告、アンカー広告、オファーウォールとは別系統のため、現行運用では緊急対応不要。Rewarded Adを再開しない場合は無効化を許容し、再開する場合のみGAM側の配信設定と在庫を再検証する。
    Lighthouseモバイル診断はPerformance 65、Accessibility 93、Best Practices 100、SEO 100。ラボ値はFCP 3.8秒、LCP 6.9秒、TBT 120ms、CLS 0で、`/images/articles/data-analysis-eyecatch.png`が約808KBと大きく、画像最適化による削減余地が大きい。また広告コンテナ内のフォーカス可能要素と`aria-hidden`の組み合わせがアクセシビリティ監査で指摘された。Search Consoleの実ユーザーデータでは62 URLのグループがCLS 0.49、INP 1,023msで不良判定だが、これは過去28日間のローリングデータであり、修正反映後も即時には解消されない。画像軽量化、広告コンポーネントの`aria-hidden`見直し、LCP・INPの追加改善は未実装の次期対応項目として残す。
* **2026-06-18**:
  * **収益ファネル計測の正常化と検索カニバリ抑制**:
    GA4のページビューがAdSenseページビューを大きく上回っていた原因を調査し、`RaceTabs.tsx` が中央・地方タブと競馬場タブの切り替えを仮想`page_view`として送信していた処理を廃止。`race_group_select`、`race_venue_select`、`race_navigation`へ分離し、実ページ表示とレース画面内操作を区別できる構成へ変更した。予想表の表示時に送っていた旧`read_complete`は`prediction_table_view`へ改名し、記事本文末尾への到達を`article_read_complete`、記事からレースページへの遷移を`article_race_click`として新規計測。アフィリエイトクリックを含むGA4キーイベント候補と推奨ファネルを`docs/analytics_measurement_plan.md`へ整理した。
    リワード広告の意図的な停止中は詳細データ閲覧を`open_access`として扱い、利用不可・自動フォールバックの診断イベントを各レース単位で大量送信しないよう、日付・競馬場・理由単位へ抑制。検索表示が多くCTRの低かった馬場状態、馬体重、オッズ妙味の記事タイトル・descriptionを検索意図に合わせて更新し、宝塚記念の重複4記事には検索実績のある中心記事への`canonical_slug`を設定した。`npx tsc --noEmit`、`npm run article:validate-links`、`npm run build`成功。生成HTMLのcanonicalと配信チャンク内の新イベントも確認。Browser実確認はWindowsサンドボックスの起動権限エラーで未実施。
  * **重賞日程連動と記事テーマ偏重の修正**:
    `news_topic_planner.py` が主要G1中心の手書き日程と、先頭から「枠順」「追い切り」を並べたTavilyクエリに依存していたため、2026年の実開催日と記事内容がずれる問題を修正。JRA公式重賞一覧と地方重賞スケジュールを1実行あたり低頻度で取得し、公式日程を内蔵カレンダーより優先する構成へ変更した。2026年は、さきたま杯を6月24日、帝王賞を7月1日として扱い、府中牝馬S、しらさぎS、ラジオNIKKEI賞、函館記念なども対象へ追加。
    開催までの日数を `early_preview / field_building / race_week / final_48h / race_day / post_race` に分類し、早期はコース・過去傾向・出走構成、直前は馬場・陣営情報、終了後は結果回顧へ切り替えるロジックを追加。レース後に枠順・追い切り記事を生成せず、1回の生成で枠順・追い切り系は合計1本までに制限した。検索意図判定はTavilyクエリよりソースのタイトル・本文を重く評価し、公式日程に一致しないレース記事は既定で候補外とした。
    Writer/Editor/文字数補完も `search_intent` と `race_phase` を引き継ぎ、出走構成、コース条件、過去傾向、中央馬と地方馬の比較、前走、結果回顧など主題別に展開するよう変更。主題でない枠順・追い切りを定型H2として追加しないガードを導入した。`grade_race_writer.py` も予測未取得時は「AI予想」ではなく出走構成・コース分析を中心にする構成へ変更。誤った段階で公開されていた帝王賞の最終追い切り記事と、レース終了後に公開された宝塚記念の事前記事は `draft: true` へ戻し、`frontend/lib/articles.ts` で下書きを一覧・サイトマップ・個別ページから除外するようにした。
    `backend/tests/test_news_topic_planner.py` を追加し、日程、クエリ分散、検索意図、レース後ガードの4件を検証。`unittest`、`py_compile`、`npx tsc --noEmit`、`npm run article:validate-links`、`npm run build` 成功を確認。記事品質監査は既存100記事に由来するcritical 10件・warning 298件を報告したが、コマンド自体は完走した。
  * **重賞記事の対象期間を開催前7日・開催後3日に短縮**:
    SEO上の検索需要と記事内容の鮮度をそろえるため、`KEIBA_NEWS_RACE_WINDOW_BEFORE_DAYS` を21日から7日へ変更し、開催後は従来通り3日までとした。コード内フォールバック値、GitHub Actions、`.env.example` を同じ `7 / 3` に統一。開催後の検索クエリは `result_review` のみに限定し、過去傾向・枠順・追い切りなどの事前テーマを生成しない構成へ変更した。月またぎの日程取得処理は維持される。境界値（開催7日前・8日前・3日後・4日後）と結果回顧限定を含む回帰テスト5件、`py_compile` 成功を確認。
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
