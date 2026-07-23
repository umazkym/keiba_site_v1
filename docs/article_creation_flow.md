# UMA-FREE Article Creation Flow

## 目的

この記事作成フローは、AdSense収益最大化に向けてSEO流入を増やしながら、競馬データメディアとしての信頼性を落とさないための運用仕様である。

前提は次の3点。

- 検索流入を増やす。ただし検索順位だけを目的にした量産記事にはしない。
- 数値の根拠は自前DB、予測データ、明示されたEvidence Packに限定する。
- LLMは文章化と編集に使い、競馬データの創作や補完には使わない。

Google Search Centralは、検索順位獲得だけを目的にした自動化コンテンツではなく、読者に役立つ独自情報、分析、満足できる体験を重視するよう案内している。UMA-FREEではこの方針を、独自DBに基づく競馬データ記事として実装する。

## 基本方針

### 1. DB根拠を最優先にする

記事本文に出せる勝率、複勝率、単勝回収率、騎乗回数、サンプル数、AI偏差値、枠順別成績、脚質別成績、斤量別成績は、Evidence Packに入っている値だけにする。

LLMに以下を許可しない。

- 入力にない枠順表や脚質表を作る
- 見栄えのよい数字を補完する
- 過去3年などの期間を推測する
- 回収率や勝率を本文内で新規計算する
- 外部検索結果をもとに競馬成績データを作る

### 2. 外部リサーチは補助に限定する

Tavily APIなどの外部リサーチは、G1/G2プレビュー、初心者向け制度解説、競馬場改修、出走予定や公式発表など、外部文脈が必要な記事だけに使う。

外部リサーチを使ってよいもの。

- レース名、開催日、開催場、発表済みの制度情報
- 競馬場公式、JRA公式、主催者発表などの事実確認
- 季節性や注目点の補足
- 競合記事との差分把握

外部リサーチを使ってはいけないもの。

- 勝率、回収率、複勝率などの記事中の主要数値
- netkeiba等の大量取得や規約上不安のあるデータ収集
- SNSや掲示板の噂を根拠にした評価
- 出典を確認できないオッズ、人気、馬体重、追い切り評価

Tavilyの検索結果はそのままWriterに渡さず、`research_sources` としてURL、出典名、取得日、使ってよい主張だけに整形する。

### 3. 内部RAGを先に作る

ベクトル検索や類似検索は、まず内部資産に対して使う。

- 公開済み記事
- `posted_history.json`
- DB由来Evidence Pack
- 用語集、初心者ガイド
- AGENTS.mdの品質基準
- 失敗下書きと差し戻し理由

目的は、重複防止、カニバリ回避、内部リンク候補、文体の統一、過去失敗の再発防止である。

外部Webページの常設ベクトル化は後回しにする。外部情報は鮮度が落ちやすく、出典管理も難しいため、原則として記事生成時の一時Evidenceとして扱う。

## 推奨アーキテクチャ

LangChainを使う場合でも、自由に動くAgentよりLangGraphの固定ワークフローを基本にする。記事作成は順序と検査が重要なため、状態遷移を明示したほうが安全である。

### ArticleFlowState

```ts
type ArticleFlowState = {
  run_id: string;
  target_keyword: string;
  theme_cluster: string;
  article_type: 'data' | 'grade_race_preview' | 'beginner' | 'guide' | 'rewrite';
  season_context: SeasonContext;
  search_intent: SearchIntent;
  revenue_intent: RevenueIntent;
  internal_context: InternalContext;
  research_sources: ResearchSource[];
  evidence_pack: EvidencePack;
  outline: ArticleOutline | null;
  draft_markdown: string | null;
  audit_results: AuditResult[];
  llm_budget: LlmBudget;
  tavily_budget: TavilyBudget;
  status: 'planned' | 'drafting' | 'needs_revision' | 'needs_human_review' | 'approved' | 'rejected';
};
```

## フロー全体

### 1. Demand Planner

LLMは使わない。Search Console、既存記事、季節性、今週の重賞、DBで集計可能なテーマから候補を作る。

評価軸。

- 検索需要: 表示回数、CTR、掲載順位、近い検索語
- 収益導線: レースページ、AI予想、記事内CTAへの近さ
- 季節性: G1週、重賞前、開催場、夏競馬、年末G1など
- 独自性: UMA-FREEのDBで根拠を出せるか
- カニバリリスク: 既存記事と検索意図が重なりすぎないか
- 更新価値: 既存記事を育てるべきか、新規記事にすべきか

### 2. Internal Retrieval

内部記事と履歴から類似テーマを検索する。

最初は軽量なBM25/キーワード検索でもよい。次段階でベクトル検索を追加する。

返す情報。

- 類似記事上位5件
- 既存target_keyword
- 使える内部リンク候補
- 避けるべき重複見出し
- 過去の差し戻し理由

### 3. Evidence Builder

LLMは使わない。DB、予測データ、既存の分析スクリプトからEvidence Packを作る。

Evidence Packには次を含める。

- `evidence_id`
- 期間
- 条件
- サンプル数
- 指標名
- 値
- 単位
- 取得元
- 注意書き

記事に出してよい数値は、このEvidence Packに入った値だけにする。

### 4. External Research Gate

Tavilyなどの外部リサーチを使うか判定する。

使う条件。

- `grade_race_preview`
- `beginner`
- `guide`
- 競馬場改修、制度変更、開催変更など、外部公式情報が必要な場合

使わない条件。

- 騎手データ
- 枠順データ
- 人気傾向
- 脚質傾向
- DBだけで完結するコース分析

Tavilyの利用上限。

- 通常データ記事: 0 credit
- 重賞プレビュー: 2から4 credits
- 初心者/制度記事: 2から6 credits
- 1日上限: 20 credits
- 1週間上限: 120 credits

### 5. Research Filter

Tavily結果を機械的に整形する。本文には外部URLを直接埋め込まず、`research_sources` に保存する。

残す情報。

- source_url
- source_name
- fetched_at
- source_type: official / media / reference / other
- allowed_claims
- rejected_reason

JRA公式、競馬場公式、主催者発表を優先する。個人ブログ、掲示板、SNS、転載サイトは原則採用しない。

### 6. Outline Builder

ここでLLMを1回使う。出力はMarkdown本文ではなく、JSONの骨子に限定する。

必須出力。

- title案
- description案
- H2/H3構成
- 各セクションの主張
- 使用するevidence_id
- テーブル設計
- 内部リンク計画
- CTA計画
- 更新ステージ

LLMには、根拠IDのない数値主張を禁止する。

### 7. Outline Validator

LLMは使わない。骨子を検査する。

落とす条件。

- evidence_idのない数値主張
- Evidence Packにない表
- 既存記事と検索意図がほぼ同じ
- titleが曖昧
- descriptionが検索結果で未完文
- 季節性と記事タイプが噛み合っていない

### 8. Writer

LLMを1回使う。Writerには承認済み骨子、Evidence Pack、Research Filter済みの外部文脈だけ渡す。

生成要件。

- 本文3,000文字以上
- 1文目で核心データを示す
- データ表を1つ以上入れる
- 数値の期間、条件、母数を書く
- 「このコースの買い目ポイント」で締める
- `/races/today` または `reference_data.race_url` に自然に誘導する
- 絵文字、過剰な断定、AIらしい定型句を使わない

### 9. Deterministic Fact Checker

LLMは使わない。本文から数値を抽出してEvidence Packと照合する。

検査対象。

- 勝率
- 複勝率
- 回収率
- 騎乗回数
- 出走数
- サンプル数
- AI偏差値
- 枠番別成績
- 脚質別成績
- 斤量別成績

Evidence Packにない数値が出た場合は差し戻す。特に、連番で整いすぎた表や、入力にない列を含む表は人間確認に回す。

### 10. SEO and AdSense Quality Gate

LLMは使わない。

検査項目。

- title: 30から50文字
- description: 120から160文字
- 本文: 3,000文字以上
- `target_keyword` あり
- `theme_cluster` あり
- `category` あり
- data tableあり
- `/races/today` かレースURLあり
- 買い目ポイントあり
- 外部リンクなし
- 古いドメインなし
- 過度な絵文字なし
- NGワードなし
- 検索語の不自然な詰め込みなし
- 手動関連記事なし

この3,000文字基準はGoogleに好まれる文字数という意味ではない。読者が判断できるだけの根拠、注意点、当日の確認順序を書くための内部品質基準である。

### 11. Editor

LLMを0から1回使う。全文リライトではなく、検査エラーの修正パッチに限定する。

修正対象。

- description不足
- titleの行動語不足
- 断定の弱め方
- サンプル数が少ない箇所の注意書き
- CTAの自然化
- 見出しの重複感
- 文体の機械感

数値の追加は許可しない。

### 12. Final Review

重賞、AI予想、回収率が強く出る記事は人間確認に回す。

人間確認が必要な条件。

- G1/G2記事
- 外部リサーチを使った記事
- Evidence Packにない数値が一度でも検出された記事
- 回収率100%以上を強く扱う記事
- 断定表現の自動修正が入った記事
- 既存上位記事と検索意図が近い記事

### 13. Publish

承認済み記事だけを公開キューへ送る。公開後にリンク検査、履歴更新、サイトマップ反映を行う。

ローカル実行ではGit操作を行わない。GitHub Actions上の公開処理だけがcommit/pushを担当する。

### 14. Post Publish Monitor

公開後7日、14日、28日で確認する。

見る指標。

- Search Consoleの表示回数
- CTR
- 平均掲載順位
- 記事から `/races/today` への遷移
- 記事からレース詳細への遷移
- AdSenseのページRPM
- エンゲージメント時間
- 直帰に近い離脱

検索表示はあるがCTRが弱い場合はtitle/descriptionを改善する。CTRはあるが回遊が弱い場合は導入文とCTAを改善する。回遊はあるがRPMが弱い場合は広告配置と関連記事導線を見直す。

## 季節性に合わせた記事戦略

### 1月から2月

- フェブラリーS、冬場ダート、短距離ダート
- 初心者向けの馬券基礎、年間競馬カレンダー
- 中山、京都、小倉のコース分析

### 3月から4月

- 高松宮記念、大阪杯、桜花賞、皐月賞、天皇賞春
- クラシック関連のG1プレビューを優先
- 3歳戦の見方、距離延長、馬場変化の記事

### 5月から6月

- NHKマイル、ヴィクトリアM、オークス、日本ダービー、安田記念、宝塚記念
- 東京芝、阪神/京都芝のコース分析
- G1記事は1週間前、枠順確定後、前日、当日朝の更新型にする

### 7月から8月

- 夏競馬、ローカル開催、新馬戦、2歳戦
- 函館、札幌、新潟、小倉のコース分析
- 荒れやすい条件、人気別傾向、馬場状態記事を増やす

### 9月から10月

- スプリンターズS、秋華賞、菊花賞、天皇賞秋
- 秋G1の直前プレビュー
- 夏から秋への馬場変化、休み明け、距離適性

### 11月から12月

- エリザベス女王杯、マイルCS、ジャパンC、チャンピオンズC、阪神JF、朝日杯FS、有馬記念、ホープフルS
- 年末G1の更新型記事
- 年間回顧、来年に向けたコース別傾向

## LLM予算

現行運用ではGemini記事生成の自己制限を1日10リクエストとして扱う。無料枠の理論上限ではなく、品質と安定性を優先した内部上限である。

### 通常データ記事

- Outline Builder: 1回
- Writer: 1回
- Editor: 0から1回
- 予備: 1回
- 合計: 2から4回

### 重賞プレビュー

- Outline Builder: 1回
- Writer: 1回
- Editor: 1回
- 予備: 1回
- 合計: 3から4回

### 初心者/ガイド記事

- Outline Builder: 1回
- Writer: 1回
- Editor: 1回
- 予備: 1回
- 合計: 3から4回

### 既存記事リライト

- WriterまたはEditor: 1回
- 必要時の再校正: 1回
- 合計: 1から2回

## 1日の運用例

### 平日

- DBデータ記事2本
- Tavilyなし
- LLM 4から6回
- 余り枠は既存記事リライトに使う

### 重賞前

- G1/G2記事1本
- Tavily 2から4 credits
- LLM 3から4回
- 残り枠で通常データ記事1本または既存記事リライト

### G1当日朝

- 新規記事を増やさず、既存G1記事を更新する
- 枠順、馬場、AI偏差値、買い目ポイントを更新
- LLM 1から2回

## Tavily利用ポリシー

Tavilyは「外部文脈確認ツール」であり、競馬成績データの生成元ではない。

### 許可ドメイン候補

- jra.go.jp
- jra.jp
- uma-free.com
- 競馬場公式サイト
- 主催者公式サイト
- 信頼できるニュース媒体

### 拒否条件

- SNS投稿だけが根拠
- 掲示板
- 出典不明のまとめ
- スクレイピング負荷が高いページ
- ログインや会員登録が必要なページ
- 転載か一次情報か判断できないページ

## ニュース起点の自動生成フロー

ニュース起点の記事生成は、`backend/scripts/agents/news_topic_planner.py` が担当する。これはLangGraph風の固定ワークフローとして実装し、自由に動くAgentではなく、以下のノード順でStateを変換する。

```text
BuildQueries
  → FetchTavily
  → FilterSources
  → ClusterTopics
  → BuildWriteOrders
  → PersistOrders
```

### 役割

外部検索は検索需要の発見にだけ使い、記事本文の根拠にはしない。直近21日以内から開催後3日以内の重賞を優先して候補を作り、レース、競馬場、騎手、公式制度、承認済み入門テーマへ分類する。該当レースをDBで照合できる場合は、AI予想、コース統計、馬番有利度、AI展望テキストをWriteOrderへ合流する。Writerへ渡す根拠は、公式発表から独立確認した事実とUMA-FREE保有データだけに限定する。

### 検索流入最大化ロジック

- 直近重賞カレンダーから、宝塚記念、函館SS、有馬記念に加え、帝王賞、さきたま杯、関東オークス、JBC、東京大賞典など地方・交流重賞も優先クエリに入れる
- Tavily結果を `枠順`、`出走馬`、`馬場`、`追い切り`、`前走後評価`、`騎手変更`、`開催情報`、`AI予想` の検索意図に分類する
- target_keyword は `宝塚記念2026 AI予想`、`宝塚記念2026 枠順 確認ポイント`、`帝王賞2026 追い切り 確認ポイント` のように、AI予想記事と直前確認記事の検索意図を分ける
- 同じ検索意図の中でも、`追い切り` を `最終追い切り`、`坂路追い`、`調教評価` のように細分化し、記事の切り口を `search_angle_label` として保存する
- 季節外れのレースは原則として採用しない。例: 6月実行時の皐月賞ニュースは、直近開催の流入が見込めないためスコアを落とし、採用対象から外す
- 既存記事や未消費WriteOrderと同じ `target_keyword` は必ず避ける。同一レースの記事は既定で1実行1本までに抑え、枠順・追い切り・馬場などの切り口は同一記事を育てる前提で扱う。必要な場合のみ `KEIBA_NEWS_MAX_TOPICS_PER_RACE_PER_RUN` で上限を調整する
- 直近の `news_topic_history.json` は2日分だけ同一topic_key・同一URLの再利用を避けるために使い、長期のレース単位クールダウンには使わない
- `article:pipeline` 側ではレース更新枠を1本予約し、直近重賞の記事が常設記事だけに押し出されないようにする

### 採用するトピック

- JRA、NAR、競馬場公式で確認できる事実、またはUMA-FREE保有データを持つ話題
- 直近の重賞、G1/G2/G3、枠順確定、出走予定、出走馬、馬場、追い切り、前走後評価、騎手変更、開催情報
- `/races/today` や重賞記事、コース分析記事へ自然に回遊できる話題
- 既存記事、`posted_history.json`、未消費WriteOrder、`news_topic_history.json` と重複しない話題

### 採用しないトピック

- SNSや掲示板だけが根拠の話題
- 外部記事の本文を言い換えるだけになる話題
- 外部媒体だけが根拠の話題、第三者の推奨馬・買い目・コメントが主題になる話題
- 競馬と直接関係しないスポーツ・芸能等からの類推
- オッズ、予想印、勝率、回収率など、UMA-FREEのDBで検証できない数値が主役になる話題
- 炎上、処分、故障など、事実確認や表現リスクが高く、馬券検討の確認順に落としにくい話題

### WriteOrderの扱い

Plannerは `theme_cluster` を競馬固有の以下の型で出力する。

- `race_update`: レース名と公式情報またはUMA-FREEデータを持つ更新記事
- `course_venue`: 公式コース情報とコースデータを扱う記事
- `jockey_profile`: 公式プロフィールと騎手データを扱う記事
- `beginner_guide`: 公式制度または承認済みテーマを扱う入門記事

`reference_data.writer_evidence` には、`official`の`facts`、`uma_free`の`metrics`、確認日時`as_of`だけを入れる。外部媒体のSourceCard、タイトル、URL、要約、検索クエリは企画発見ログにだけ保持し、Writer向けJSONから除去する。勝率、回収率、AI偏差値などの数値はUMA-FREE保有データに存在するときだけ使う。

`reference_data` には `search_intent`、`search_intent_label`、`search_angle_label`、`calendar_race`、`days_to_race`、`topic_bridge` も保存する。該当レースをDBで照合できた場合は、`matched_race`、`predictions`、`course_stats`、`horse_number_advantages`、`ai_analysis_text` も保存する。後続のWriter/Editorは記事テーマそのものから書き始め、企画発見経路を読者向けに説明しない。

### 自動公開の考え方

ニュースPlannerは `data/write_orders/` に指示書を作成するだけで、公開判断は既存の `article:pipeline`、`agent_editor.ts`、`agent_publisher.ts` に委ねる。人間確認ノードは置かず、既存の完全自動公開フローと同じ経路で処理する。

## ベクトル検索ポリシー

最初に内部記事とEvidence Packを対象にする。

### Index対象

- slug
- title
- description
- target_keyword
- theme_cluster
- category
- H2見出し
- 本文要約
- Evidence Pack要約
- 公開日
- 更新ステージ

### Retrieval用途

- カニバリ検出
- 関連記事候補
- 記事構成の重複防止
- 過去記事のリライト候補抽出
- 季節記事の再利用

### 注意点

外部Webを常設Indexに混ぜると、古い情報や出典不明情報が残りやすい。外部情報は記事生成ごとの一時Contextとして扱う。

## 実装フェーズ

### Phase 1: 現行TSパイプラインの強化

- Writerプロンプトを3,000文字以上、Evidence厳守、外部リサーチ分離に更新
- SEO checkerの本文基準を3,000文字に更新
- Gemmaで検索意図ブリーフと複数観点レビューを追加し、上位モデルの回数を温存しながら添削回数を増やす
- 記事品質監査スクリプトを追加
- 現行GitHub Actionsの1日10リクエスト制限は維持

### Phase 2: 内部RAG

- 公開済み記事とposted_historyから類似検索Indexを作る
- target_keyword重複とカニバリを事前検出する
- 内部リンク候補を自動生成する

### Phase 3: Tavily導入

- `TAVILY_API_KEY` がある場合だけ外部リサーチを有効化
- 記事タイプごとにcredits上限を設定
- 公式/信頼ドメインだけを採用
- 外部由来情報は`research_sources`に保存し、本文の主要数値には使わない

### Phase 4: LangGraph化

- StateGraphで各ノードを分離する
- 各ノードの入出力をJSONで保存する
- 途中失敗時に再開できるようにする
- 人間確認ノードを追加する

## 公開可否の最終基準

記事は以下を満たした場合だけ公開する。

- 読者の検索意図に対し、独自データまたは独自視点がある
- 本文中の主要数値がEvidence Packで検証できる
- 外部リサーチを使った場合、出典が記録されている
- 3,000文字以上で、水増しではなく判断材料が増えている
- title/descriptionが検索結果で自然に読める
- 常設記事には`/races/today`への自然な導線がある。重賞記事は検証済みの個別レース導線だけを表示し、データ未準備時は導線DOMや予約余白がなくても公開できる
- 過度な断定、収益保証、煽りがない
- 既存記事と検索意図が重なりすぎていない
- AdSense審査に不利な薄い自動生成記事に見えない

## 重賞記事の年度URLと個別レース導線

重賞記事は検索意図ごとにURLを増やさず、共有レジストリ`frontend/content/reference/grade-race-entities.json`の`entity_key`と開催年を使い、`/articles/{entity-key}-{season-year}`で管理する。同一重賞・同一年度の更新段階は`field_building → race_week → final_48h → draw_confirmed → post_race`の順とし、後退させない。Publisherは`entity_type + entity_key + season_year`を同一記事の識別キーにし、同じH2見出しを更新、既存の固有セクションは保持する。

個別記事は自己canonicalを維持する。`/articles/grade-races/{entity-key}`は最新記事本文を複製せず、年度別記事を案内する重賞ハブとする。既存URLの移行はSearch Console過去28日のクリック0かつ表示100未満の単独記事だけを候補にし、クリック1以上または表示100以上は28日間保護する。複数記事の統合は品質監査後に行い、年度付きURLへ一段の301で転送する。

`race_bridge_enabled`は常に`false`から始め、Publisherだけが次の全条件を検証して`true`にできる。

1. 開催日と正規化したレース名がDB上の1レースへ一意に一致する
2. 正確な個別レースURLを生成できる
3. 公開可能な予測データが1頭以上ある
4. 軽量プレビューAPIが正常応答し、race IDとURLが記事メタデータに一致する
5. 記事年度と開催年が一致する

さらに、D+1とD+14の9:00 JSTリマインド登録後に`ARTICLE_RACE_BRIDGE_EXPERIMENT_ACTIVE=true`と`ARTICLE_RACE_BRIDGE_REMINDER_ID`がPublisher環境へ設定されていることを開始条件とする。どちらかが欠ける場合は、レースデータが揃っていても`false`を維持する。

Writerは重賞記事本文に`/races/today`や個別レースCTAを書かない。Publisherの検証に失敗した場合は記事本文を公開できるが、ブリッジは無効のままにし、外枠、ローディング、予約スペースを描画しない。ブラウザ側でタイトルからレースを推測したり、別レースや`/races/today`へフォールバックしたりしない。検証済み記事で一時的なAPI障害が起きた場合だけ、保存済みのレース名、日付、競馬場、正確なURLを使う静的リンクを残し、予測欄は表示しない。

## GSC週次監査と限定改稿

`.github/workflows/keiba-gsc-seo.yml`は毎週水曜09:15 JSTに、Search Consoleの確定済み直近28日と直前28日を読み取り専用で比較する。対象は公開中・indexable・自己canonicalの`/articles/`だけとし、表示100以上かつ平均順位4〜20位の記事を順位帯別CTR中央値と比較する。推定取りこぼしクリック順の上位10件、季節重賞、同一クエリで各20表示以上の複数canonicalを、Actions SummaryとJSON artifactへ出力する。GSC API、権限、データ不足による失敗はこの監査workflow内だけで終了し、通常記事生成には影響させない。

開催7日前から開催後3日までの重賞記事は通常のGSC改稿候補から除外し、既存の`update_stage`処理へ委ねる。重賞の08:00、11:45、16:45 JST実行と年度付き新規URLを優先し、GSCデータの有無をWriteOrder生成条件にしない。過年度記事を当年度版へ書き換えず、同じ重賞・同じ年度の記事だけを段階更新する。

GSC改稿はartifact確認後、`workflow_dispatch`へ正確な`article_slug`を1件指定した場合だけ実行する。検索クエリは検索意図の参考に限り、WriterEvidenceや本文の事実根拠へ渡さない。変更可能範囲はtitle、description、keywords、導入文、既存H2文言だけで、数値集合、表、H2配下本文、リンク、canonical、公開日、entity、`update_stage`、広告・レースブリッジ情報の差分を公開前に拒否する。Publisherは対象の既存Markdownだけを上書きし、`last_updated`と改稿履歴を更新する。同一slugは28日間再改稿しない。

## 参照

- Google Search Central: Creating helpful, reliable, people-first content
- Google Search Central: SEO Starter Guide
- Google Search Central: Guidance on using generative AI content
- Google AI for Developers: Gemini API pricing
- Google AI for Developers: Gemini API rate limits
- Tavily: Pricing and API Credits
- LangChain Docs: LangGraph workflows and agents
- `docs/gsc_weekly_seo_operations.md`
