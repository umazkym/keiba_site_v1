はい、承知いたしました。
ご指示いただいた「絵文字の多用を避ける」「AIらしさを排除する」という重要な指針を、プロジェクトの基本原則、品質基準、そしてAdSense再申請チェックリストに組み込み、文書全体を更新しました。

-----

# Codex - AdSense審査合格プロジェクト：実行ガイド

## 1\. あなたの役割と基本原則

あなたは、FastAPI(Python)とNext.js(TypeScript)で構築された競馬データ分析サイト「keiba\_site\_v1」を改善するための専属AIエキスパートです。あなたの主な任務は、**Google AdSense審査への合格**に向けた段階的な改善の実行です。

### 基本原則

  -   **段階的実行**: 仕様書（`ADSENSE_IMPROVEMENT_SPECIFICATION.md`）に基づき、1ステップずつ確実に実行
  -   **進捗の記録**: 各ステップ完了後、必ず仕様書に進捗を記録
  -   **完全性と正確性**: コードは常に完全な形で提供し、`...`などで省略することは禁止
  -   **日本語での対話**: すべての回答、説明、コメントは日本語で生成
  -   **深い推論**: 表層的な修正ではなく、根本的な品質向上に繋がる提案を実行
  -   **自然な品質 (重要)**: **AI自動生成を想起させる画一的なUIや文言、過度な絵文字の使用を徹底的に避け**、信頼感のある自然なサイト品質を目指す

-----

## 2\. プロジェクト構成

### 技術スタック

  -   **バックエンド**: Python, FastAPI, SQLAlchemy, Uvicorn
  -   **フロントエンド**: TypeScript, Next.js 14, React, Tailwind CSS
  -   **インフラ**: Render（Backend）, Vercel（Frontend）

### 開発環境

  -   **バックエンド起動**: `PS C:\Users\zk-ht\Keiba\keiba_site_v1\backend> uvicorn main:app --reload`
  -   **フロントエンド起動**: `PS C:\Users\zk-ht\Keiba\keiba_site_v1\frontend> npm run dev`

### 主要ドキュメント

  -   **改善仕様書**: `ADSENSE_IMPROVEMENT_SPECIFICATION.md`（マスター仕様書）
  -   **進捗記録**: 本ファイル（`.Codex/AGENTS.md`）のセクション8
  -   **プロジェクトルート**: `C:\Users\zk-ht\Keiba\keiba_site_v1\`

-----

## 3\. 実行ルール

### 許可されるタスク

  -   既存コードのリファクタリング、バグ修正、パフォーマンス改善
  -   新規コンポーネントやAPIエンドポイントの作成
  -   Google AdSenseポリシーに準拠するためのコンテンツ改善
  -   UI/UX向上のためのフロントエンド修正
  -   マークダウン記事の作成・編集

### 禁止事項

  -   **Git操作の禁止**: `git commit`, `git push`, `git deploy`等は実行しない
  -   **高負荷なスクレイピングの禁止**: 外部サイトへの大量アクセスは避ける
  -   **仕様書の逸脱**: 必ず仕様書に基づいて作業を進める

-----

## 4\. ステップバイステップ実行プロセス

### 実行フロー

```
1. ユーザーからの指示受付
   ↓
2. 該当ステップの仕様確認（ADSENSE_IMPROVEMENT_SPECIFICATION.md参照）
   ↓
3. 実装・修正の実行
   ↓
4. 動作確認・品質チェック
   ↓
5. 進捗記録の更新（本ファイルのセクション8に記録）
   ↓
6. 次ステップの提案
```

### ユーザーへの指示の受け方

ユーザーは以下のいずれかの形式で指示を出します：

#### パターンA: ステップ番号指定

```
「ステップ1-1を実行して」
「施策1-1を進めて」
```

→ 仕様書の該当ステップを実行

#### パターンB: フェーズ指定

```
「フェーズ1を開始して」
「最優先施策を全て実行して」
```

→ 該当フェーズの全ステップを順次実行

#### パターンC: 具体的タスク指定

```
「トップページにコンテンツを追加して」
「FAQページを作成して」
```

→ 仕様書から該当する施策を特定して実行

#### パターンD: 進捗確認

```
「進捗を教えて」
「どこまで完了した？」
```

→ セクション8の進捗記録を参照して報告

-----

## 5\. 各ステップの実行手順

### 5.1 実行前の確認

各ステップを実行する前に、必ず以下を確認：

1.  **仕様書の該当箇所を読む**
       - `ADSENSE_IMPROVEMENT_SPECIFICATION.md`の該当セクション
       - 目的、実装内容、期待効果を理解

2.  **依存関係の確認**
       - 前提となるステップが完了しているか
       - 必要なファイルが存在するか

3.  **実装方針の明示**
       - ユーザーに実装内容を簡潔に説明
       - 変更するファイルをリストアップ

### 5.2 実行中の作業

1.  **TodoWriteツールの活用**
       - 複数のサブタスクがある場合はTodoリストを作成
       - 進捗を可視化

2.  **コードの品質担保**
       - TypeScriptの型安全性を維持
       - Tailwind CSSでのスタイリング統一
       - アクセシビリティへの配慮

3.  **段階的な実装**
       - 一度に複数ファイルを変更する場合も、論理的な順序で実行
       - 各ファイルの変更理由を明確に説明

### 5.3 実行後の処理

1.  **動作確認の提案**
       - ローカル環境での確認方法を提示
       - 確認すべきポイントを明示

2.  **品質チェックリストの提示**
       - 仕様書のチェックリスト（セクション7）に基づく確認事項

3.  **進捗記録の更新**
       - 本ファイルのセクション8「進捗記録」に完了日時と結果を記録
       - 次のステップを提案

-----

## 6\. 進捗記録の管理方法

### 記録フォーマット

各ステップの完了時、以下の形式でセクション8に記録：

```markdown
#### ✅ [ステップ番号] [ステップ名]
- **完了日時**: YYYY-MM-DD HH:MM
- **実施内容**: [具体的な作業内容]
- **変更ファイル**: [変更したファイルのリスト]
- **確認事項**: [ユーザーが確認すべきポイント]
- **次のステップ**: [推奨される次のステップ]
```

### 未完了ステップの管理

```markdown
#### ⏳ [ステップ番号] [ステップ名]
- **ステータス**: 進行中 / 保留
- **開始日時**: YYYY-MM-DD HH:MM
- **残タスク**: [完了していない作業]
```

-----

## 7\. 品質基準とチェックリスト

### 7.1 コンテンツ品質基準

新規記事作成時は以下を必須とする：

  - [ ] **文字数**: 2,000文字以上
  - [ ] **独自性**: 独自データまたは独自視点を含む
  - [ ] **読みやすさ**: 見出し（H2, H3）、段落、箇条書きの適切な使用
  - [ ] **画像**: 最低3点以上の画像・図表
  - [ ] **内部リンク**: 関連記事へのリンク3箇所以上
  - [ ] **メタデータ**: title, description, keywords, eyecatch, category を含むフロントマター

### 7.2 技術品質基準

コード変更時は以下を確認：

  - [ ] **TypeScript**: 型エラーなし
  - [ ] **ESLint**: リントエラーなし
  - [ ] **ビルド**: `npm run build`が成功
  - [ ] **モバイル表示**: レスポンシブデザインの確認
  - [ ] **アクセシビリティ**: ARIA属性、alt属性の適切な使用

### 7.3 UI/UX品質基準 (最重要)

UI/UXの修正・実装時は、ユーザー体験とサイトの信頼性を最優先し、以下を遵守する：

  - [ ] **自然なデザイン**: AIによる自動生成を感じさせる画一的なレイアウトやコンポーネントを避ける
  - [ ] **適切な言葉遣い**: 機械的・定型的な文言ではなく、競馬ファンに響く自然な日本語表現を使用する
  - [ ] **装飾の抑制**: サイトの信頼性を損なう可能性のある**過度な絵文字**や、派手すぎるアニメーションは使用しない
  - [ ] **直感的な操作性**: ユーザーが迷わない、シンプルで直感的なインターフェースを提供する

### 7.4 SEO基準

ページ追加・修正時は以下を確認：

  - [ ] **Title**: 30～60文字、キーワード含む
  - [ ] **Description**: 120～160文字、魅力的な説明
  - [ ] **見出し構造**: H1→H2→H3の論理的な階層
  - [ ] **画像alt**: すべての画像にalt属性
  - [ ] **内部リンク**: 関連ページへの適切なリンク

-----

## 8\. 進捗記録（実行ログ）

### 📊 全体の進捗状況

**最終更新**: 2026-06-07

| フェーズ | ステータス | 完了数/総数 | 進捗率 |
|---------|----------|-----------|-------|
| フェーズ1（最優先） | 🔄 準備完了 | 0/5 | 0% |
| フェーズ2（高優先） | ⏸️ 未着手 | 0/4 | 0% |
| フェーズ3（中優先） | ⏸️ 未着手 | 0/3 | 0% |

**KPI進捗**:

  - 総ページ数: 30 → 目標60（現在: 30）
  - 記事数: 26 → 目標50（現在: 26）

-----

### フェーズ1: 即効性の高い改善（目標: 1～2週間）

#### 🔲 施策1-1: トップページのリッチコンテンツ化

  - **ステータス**: 未着手
  - **優先度**: ★★★★★
  - **工数**: 1日
  - **期限**: 即日
  - **実装内容**:
      - 「UMA-FREEとは」セクション追加（500～800文字）
      - 「今週のハイライト」セクション追加（300～500文字）
      - 「データで見る競馬の世界」セクション追加
  - **対象ファイル**: `frontend/app/page.tsx`

-----

#### 🔲 施策1-2A: 記事コンテンツの増強（第1弾: +5記事）

  - **ステータス**: 未着手
  - **優先度**: ★★★★★
  - **工数**: 2～3日
  - **期限**: 1週間以内
  - **実装内容**:
      - 初心者向けガイドシリーズ5記事の作成
        1. 「競馬の始め方完全ガイド」
        2. 「馬券の買い方・種類徹底解説」
        3. 「競馬場への行き方ガイド（主要10競馬場）」
        4. 「競馬用語500選（あいうえお順）」
        5. 「AI競馬予想の使い方マニュアル」
  - **対象ディレクトリ**: `frontend/content/articles/`

-----

#### 🔲 施策1-2B: 記事コンテンツの増強（第2弾: +5記事）

  - **ステータス**: 未着手
  - **優先度**: ★★★★★
  - **工数**: 2～3日
  - **期限**: 1週間以内
  - **実装内容**:
      - データ分析シリーズ5記事の作成
        1. 「2024年度 勝率ランキング：騎手・調教師・馬主トップ20」
        2. 「枠順データ完全分析：有利な枠はどこか？」
        3. 「馬場状態が与える影響：良・稍重・重・不良徹底比較」
        4. 「距離別適性データ：短距離・中距離・長距離の違い」
        5. 「血統データ分析：種牡馬別成績ランキング」
  - **対象ディレクトリ**: `frontend/content/articles/`

-----

#### 🔲 施策1-3: AI予測ページのコンテキスト強化

  - **ステータス**: 未着手
  - **優先度**: ★★★★☆
  - **工数**: 2日
  - **期限**: 3日以内
  - **実装内容**:
      - レース分析コメントの追加（各レース100～200文字）
      - データ解説パネルの追加（折りたたみ式）
      - 関連記事の動的表示機能
      - 過去の的中実績の表示
  - **対象ファイル**:
      - `frontend/app/races/[date]/page.tsx`
      - `frontend/components/RacePageClient.tsx`
      - `frontend/components/RaceAnalysisComment.tsx`（新規）
      - `frontend/components/DataExplanationPanel.tsx`（新規）

-----

#### 🔲 施策1-4: FAQページの新設

  - **ステータス**: 未着手
  - **優先度**: ★★★★☆
  - **工数**: 1日
  - **期限**: 3日以内
  - **実装内容**:
      - FAQページの作成（30問以上）
        - サービス全般: 10問
        - AI予測: 10問
        - 馬券購入: 10問
        - トラブルシューティング: 5問
      - FAQ Schema（構造化データ）の実装
  - **対象ファイル**:
      - `frontend/app/faq/page.tsx`（新規）

-----

#### 🔲 施策4-1: 運営者情報ページの詳細化

  - **ステータス**: 未着手
  - **優先度**: ★★★★☆
  - **工数**: 0.5日
  - **期限**: 2日以内
  - **実装内容**:
      - 運営者のバックグラウンド追加（300～500文字）
      - サイトの実績・統計情報の追加
      - メディア掲載実績（将来）
      - 連絡先の明確化
  - **対象ファイル**: `frontend/app/about/page.tsx`

-----

### フェーズ2: 構造的改善（目標: 2～4週間）

#### 🔲 施策2-1: サイト内導線の強化

  - **ステータス**: 未着手
  - **優先度**: ★★★★☆
  - **工数**: 2日
  - **期限**: フェーズ1完了後
  - **実装内容**:
      - 関連記事の自動表示機能
      - パンくずリストの実装
      - サイドバー/フッターナビゲーションの強化
      - CTA（行動喚起）の最適化
  - **対象ファイル**:
      - `frontend/app/layout.tsx`
      - `frontend/components/RelatedArticles.tsx`（新規）
      - `frontend/components/Breadcrumb.tsx`（新規）

-----

#### 🔲 施策1-2C: 記事コンテンツの増強（第3弾: +10記事以上）

  - **ステータス**: 未着手
  - **優先度**: ★★★★☆
  - **工数**: 5日
  - **期限**: フェーズ1完了後2週間以内
  - **実装内容**:
      - レース回顧・展望シリーズ10記事以上
        - 主要G1レースの詳細分析
        - 毎週のレース結果レポート
        - 注目レースの事前展望
  - **対象ディレクトリ**: `frontend/content/articles/`

-----

#### 🔲 施策3-1: 構造化データの充実

  - **ステータス**: 未着手
  - **優先度**: ★★★☆☆
  - **工数**: 1日
  - **期限**: フェーズ1完了後2週間以内
  - **実装内容**:
      - Article Schemaの実装（全記事）
      - FAQ Schemaの実装
      - BreadcrumbList Schemaの実装
      - SportsEvent Schemaの強化
  - **対象ファイル**:
      - 各ページコンポーネント
      - `frontend/lib/structuredData.ts`（新規）

-----

#### 🔲 施策3-2: XMLサイトマップの最適化

  - **ステータス**: 未着手
  - **優先度**: ★★★☆☆
  - **工数**: 0.5日
  - **期限**: フェーズ1完了後2週間以内
  - **実装内容**:
      - サイトマップの分割（メイン、記事、レース）
      - 優先度と更新頻度の最適化
      - 画像サイトマップの追加
  - **対象ファイル**:
      - `frontend/app/sitemap.ts`
      - `frontend/app/sitemap-images.ts`（新規）

-----

### フェーズ3: 継続的改善（目標: 2～4週間）

#### 🔲 施策2-2: ページ速度の最適化

  - **ステータス**: 未着手
  - **優先度**: ★★★☆☆
  - **工数**: 3日
  - **期限**: フェーズ2完了後
  - **実装内容**:
      - 画像の最適化（WebP変換、遅延読み込み）
      - JavaScriptの最適化（不要ライブラリ削除、Code Splitting）
      - キャッシング戦略の見直し
      - Core Web Vitalsの改善
  - **対象ファイル**:
      - `frontend/next.config.mjs`
      - 各コンポーネントファイル

-----

#### 🔲 施策2-3: モバイルUXの徹底検証と改善

  - **ステータス**: 未着手
  - **優先度**: ★★★☆☆
  - **工数**: 2日
  - **期限**: フェーズ2完了後
  - **実装内容**:
      - タッチ操作の最適化
      - モバイル固有のUI改善
      - フォームの最適化
      - モバイル表示速度の改善
  - **テスト方法**: 実機テスト（iOS Safari, Android Chrome）

-----

#### 🔲 施策4-2: お問い合わせ機能の強化

  - **ステータス**: 未着手
  - **優先度**: ★★☆☆☆
  - **工数**: 1日
  - **期限**: フェーズ2完了後
  - **実装内容**:
      - 問い合わせ種別の追加
      - FAQへのリンク追加
      - 返信ポリシーの明記
      - サンクスページの改善
  - **対象ファイル**: `frontend/app/contact/page.tsx`

-----

### 📝 完了したステップの記録

#### ✅ 記事生成改善: 実行パイプラインへの記事作成フロー接続
- **完了日時**: 2026-06-07 23:53
- **実施内容**: これまで設計書とGitHub Actions設定に留まっていた記事作成フローを、実際の `article:pipeline` に接続した。新規に `frontend/scripts/agents/article_flow.ts` を追加し、Demand Planner、Internal Retrieval、Evidence Builder、Research Decision、Fact Checker、Research Filter相当のノードをTypeScriptで実装した。`test_pipeline.ts` では、Geminiを呼ぶ前にPre-Draft Flowを実行し、`target_keyword`、`theme_cluster`、`reference_data`、データ記事のEvidence有無、重賞記事のrace_name/race_date/venueを検査するようにした。Writer直後にはPost-Writer Flowを実行し、入力Evidenceに基づく数値トークン確認、外部リンク禁止、単調増加しすぎる怪しい数値表の検出を行い、criticalが出た場合はEditorへ進めずwrite_orderをfailedへ移動するようにした。Tavilyはまだ必須化せず、G1/G2・初心者・ガイド記事で外部リサーチが有効な場合だけ使う前提のResearch Decisionとして扱い、未設定時はDB/Internal Evidenceのみで継続する警告にした。
- **変更ファイル**: `frontend/scripts/agents/article_flow.ts`, `frontend/scripts/agents/test_pipeline.ts`, `AGENTS.md`
- **確認事項**: `npm run article:validate-links` は86記事チェックで成功。`npm run article:audit-quality` は86記事に対して改善候補316件を検出し、標準どおり終了コード0で成功。`npm run build` は成功し、静的ページ数は155件。既存どおり `caniuse-lite` 更新推奨と、ローカルバックエンド未起動による `127.0.0.1:8000` 取得失敗ログが出たが終了コードは0。`git diff --check` は成功し、CRLF警告のみ。
- **次のステップ**: 実運用で次回のGitHub Actions記事生成ログに `[ArticleFlow] pre-draft APPROVED` と `[ArticleFlow] post-writer APPROVED` が出ることを確認する。次段階では、このTypeScript実装をLangGraphへ移植し、Outline Builder、Outline Validator、Human Review、Post Publish Monitorを個別ノードとして永続化する。

#### ✅ 記事生成改善: GitHub Actions毎朝1記事生成フロー化
- **完了日時**: 2026-06-07 23:08
- **実施内容**: GitHub Actionsの `Keiba Article Auto Pipeline` を、毎朝8:00 JSTに品質優先で1記事生成・公開する運用へ調整した。既存のscheduleは維持しつつ、通常実行時の `ARTICLE_PIPELINE_MAX_ARTICLES` を1本に変更。手動実行では `max_articles` 入力で1本または2本を選べるようにした。あわせて、冒頭に `DATABASE_URL` と `GEMINI_API_KEY` のSecrets事前チェックを追加し、未設定時に原因が分かる形で停止するようにした。前回追加した `article:audit-quality` をGitHub Actionsにも組み込み、毎朝の生成前に公開済み記事の品質棚卸しを実行する構成にした。監査は既存記事の改善候補を出す目的のため、標準では失敗終了しない。
- **変更ファイル**: `.github/workflows/keiba-article-pipeline.yml`, `AGENTS.md`
- **確認事項**: `npm run article:audit-quality` は実行成功し、84記事に対して改善候補313件を検出。`npm run article:validate-links` は84記事チェックで成功。`git diff --check` は成功し、CRLF警告のみ。Git操作は禁止事項に従い、commit/pushは未実行。
- **次のステップ**: GitHub側で `GEMINI_API_KEY` と `DATABASE_URL` のRepository Secretsを設定する。変更がGitHubに反映された後、`Actions > Keiba Article Auto Pipeline > Run workflow` で手動実行し、`max_articles=1` のまま1記事生成を確認する。成功すれば以後は毎朝8:00 JSTに自動実行される。

#### ✅ 記事生成改善: SEO流入最大化に向けた記事作成フロー構築
- **完了日時**: 2026-06-07 22:41
- **実施内容**: LangChain/LangGraph導入を見据えた記事作成フローを `docs/article_creation_flow.md` として新設。DB Evidence Packを主根拠にし、Tavilyなどの外部リサーチはG1/G2、初心者記事、制度・公式発表確認などの補助用途に限定する方針を明文化した。内部RAG/ベクトル検索は、外部Webではなく公開済み記事、posted_history、Evidence Pack、AGENTS.md、失敗下書きから始める設計にした。SEO流入増加を前提に、季節ごとの記事テーマ、更新型G1記事、LLM/Tavily予算、公開後モニタリング、People-first品質ゲート、人間確認条件を定義した。あわせてWriterプロンプトを本文2,100〜2,700字目安・最低2,000字、外部リサーチから数値を作らない方針へ更新し、SEO checkerと既存システム文書の本文基準を2,000字に統一した。公開済み記事の棚卸し用に `article:audit-quality` を追加し、本文量、メタ情報、買い目ポイント、レース導線、外部リンク、怪しい数値表の兆候を非LLMで確認できるようにした。
- **変更ファイル**: `docs/article_creation_flow.md`, `frontend/scripts/agents/agent_writer.ts`, `frontend/scripts/agents/seo_checker.ts`, `frontend/scripts/agents/article_quality_audit.js`, `frontend/package.json`, `docs/system-documentation/13_記事生成AIトーンマナー定義書.md`, `docs/system-documentation/14_自動記事生成システム全体仕様書.md`, `AGENTS.md`
- **確認事項**: `npm run article:validate-links` は84記事チェックで成功。`npm run article:audit-quality` は実行成功し、84記事に対して合計313件の改善候補を検出した。内訳はcritical 9件、warning 304件で、主な対象はdescription不足42件、本文2,000字未満63件、Markdown表なし46件、買い目ポイントなし66件、レース導線なし62件、怪しい数値表の兆候9件。監査スクリプトは既存記事の棚卸し用のため、標準では失敗終了しない。`npm run build` は成功し、静的ページ数は153件。既存どおり `caniuse-lite` 更新推奨と、ローカルバックエンド未起動による `127.0.0.1:8000` 取得失敗ログが出たが終了コードは0。
- **次のステップ**: Phase 1として `article:audit-quality --json` の結果をもとに、critical 9件、特に重賞プレビュー内の根拠が怪しい数値表を優先修正する。Phase 2で内部RAG/類似記事検索を実装し、target_keyword重複、カニバリ、内部リンク候補をWriteOrder作成前に判定する。Phase 3で `TAVILY_API_KEY` がある場合だけ外部リサーチを有効化し、G1/G2と初心者・制度記事に限定してResearch Filterを通す。Phase 4でLangGraph化し、Demand Planner、Evidence Builder、Outline Builder、Fact Checker、SEO Gate、Editor、Human Reviewを状態遷移として分離する。

#### ✅ 収益改善: 自動広告単独テスト用の手動広告一括OFF化
- **完了日時**: 2026-06-07 18:37
- **実施内容**: AdSense自動広告の効果を手動配置広告と混ぜずに検証できるよう、手動広告を一括で制御する `NEXT_PUBLIC_MANUAL_ADS_MODE` を追加。既定値は `disabled` とし、`AdUnit`、`InFeedAd`、`NativeCardAd`、`MultiplexAd`、`MobileStickyAd`、直接 `Adsense` 呼び出しを表示しない状態にした。AdSense自動広告スクリプトは `layout.tsx` に残しているため、AdSense管理画面側の自動広告だけが配信対象になる。モバイル下部の独自追従広告を止めることで、AdSense下部アンカー広告との二重表示を避け、自動広告テストの結果を読みやすくした。あわせて、`MobileStickyAd` 用に常時入っていたフッター下余白も、手動広告有効時だけ入るよう調整し、自動広告単独テスト時に不要な空白が残らないようにした。後日、手動広告を戻す場合は環境変数 `NEXT_PUBLIC_MANUAL_ADS_MODE=enabled` を設定すれば再有効化できる。
- **変更ファイル**: `frontend/lib/ad-config.ts`, `frontend/components/AdUnit.tsx`, `frontend/components/Adsense.tsx`, `frontend/components/InFeedAd.tsx`, `frontend/components/NativeCardAd.tsx`, `frontend/components/MultiplexAd.tsx`, `frontend/components/MobileStickyAd.tsx`, `frontend/components/TopHitsDisplay.tsx`, `frontend/components/Footer.tsx`, `frontend/components/GlobalAdManager.tsx`, `frontend/app/globals.css`, `AGENTS.md`
- **確認事項**: `npx tsc --noEmit` は権限付き実行で成功。`npm run build` は権限付き実行で成功し、静的ページ数は153件。既存どおり `caniuse-lite` 更新推奨と、ローカルバックエンド未起動による `127.0.0.1:8000` 取得失敗ログが出たが終了コードは0。`git diff --check` は成功し、LF/CRLF警告のみ。未追跡の `分析レポート/` は今回の作業対象外の既存分析資料として未変更。
- **次のステップ**: AdSense管理画面では、自動広告のみのテストとして、インテント重視OFF、全画面ON、サイドレールON、アンカー広告は下部ON、ページ内バナーON、Multiplex ON、関連検索OFFで開始する。除外ページ・除外エリアがテスト時に使えない前提のため、まずは7日以上、理想は土日2回を含む14日で、AdSenseの推定収益、Page RPM、Impression RPM、CTR、Active View、GA4のページ/セッション、レース詳細閲覧数、記事からレースへの遷移率、Search Console/Core Web VitalsのCLSを比較する。自動広告単独で伸びない場合は、手動広告を一括復帰するのではなく、レース予想表後、記事導入後、トップ価値訴求後など、過去に意図が明確だった枠だけ段階的に戻す。

#### 収益改善メモ: AdSense自動広告単独テストの判断整理
- **記録日**: 2026-06-07
- **目的**: 手動広告と自動広告が混在した状態では、AdSense自動広告の純粋な効果、過密表示によるUX影響、ページ種別ごとの収益性を切り分けにくい。そのため、コード上の手動配置広告を一旦すべてOFFにし、AdSense管理画面側の自動広告だけでテストする。これは最終形を自動広告だけに決めるためではなく、自動広告が得意な場所と不得意な場所を見極めるための基礎テストである。
- **現在のコード状態**: `frontend/lib/ad-config.ts` の `NEXT_PUBLIC_MANUAL_ADS_MODE` で手動広告を一括制御する。既定値は `disabled` のため、環境変数を設定しない限り `AdUnit`、`Adsense`、`InFeedAd`、`NativeCardAd`、`MultiplexAd`、`MobileStickyAd`、`TopHitsDisplay` 内のネイティブ広告穴埋めは表示されない。`frontend/app/layout.tsx` の AdSense自動広告スクリプトは残しているため、AdSense管理画面で自動広告をONにすれば自動広告は配信対象になる。後で手動広告を戻す場合は `NEXT_PUBLIC_MANUAL_ADS_MODE=enabled` を設定する。
- **AdSense管理画面の当初推奨設定**: インテント重視のフォーマットはOFF。オーバーレイフォーマットは、全画面広告ON、サイドレール広告ON、アンカー広告ONで、当初はアンカーを下部のみにする案を推奨していた。ページ内フォーマットは、バナー広告ON、Multiplex広告ON、関連検索OFFで開始する。関連検索は検索意図と広告導線が強く混ざりやすく、競馬データ確認中のユーザーを外へ逃がす可能性があるため、初回テストでは使わない。実際の本番適用値は下部の「2026-06-07 追加: 本番適用されたAdSense設定」を優先して参照する。
- **除外ページの考え方**: AdSenseテスト中に除外ページ・除外エリアを設定できない場合は、一旦その制約を受け入れてテストする。本適用時はAdSense管理画面側で `/privacy`、`/terms`、`/contact`、`/advertising`、`/about` を除外候補にする。`GlobalAdManager` の `noAdPages` は手動追従広告の制御には効くが、`layout.tsx` の共通AdSenseスクリプトによる自動広告までは止められないため、自動広告のページ除外は必ずAdSense管理画面で行う。
- **除外エリアの考え方**: 本適用時に除外エリアが使える場合、ヘッダー直下、記事タイトル・リード・目次・`ArticleSearchEntryPanel` 周辺、レースページのstickyレース選択、予想表直前・予想表途中、詳細分析ゲート周辺、横スクロールタブ周辺は除外候補にする。公式仕様上、除外エリアはページ内自動広告への制御であり、アンカー広告や全画面広告などのオーバーレイ広告を止める設定ではない。
- **ユーザー特性の前提**: 記事流入以外、特にレースページへ来るユーザーは「今日のレース、AI順位、予想表、買う/見送る材料」を目的に来るため、多少のUX低下には耐性がある。一方で、核心データの前や途中に広告が割り込むと、離脱が少なくてもレース切替数、詳細データ閲覧、記事からレースへの遷移、Active View、再訪率が落ちる可能性がある。広告が多くても離脱が少ないから収益最大とは限らない。
- **広告過多で収益が下がる理由**: Active Viewの低下、CTRの希薄化、誤タップや低品質クリックによる単価悪化、ページ速度悪化、CLS悪化、重要導線の阻害、レース詳細や記事回遊の減少により、Page RPMが下がる可能性がある。競馬ユーザーは目的意識が強いが、広告で判断材料の確認テンポを崩すと、同一セッション内の高価値ページ閲覧が減りやすい。
- **デスクトップのレイアウト評価**: `layout.tsx` の `main` は `max-w-7xl` の中央寄せで左右余白があり、デスクトップのサイドレール広告とは相性がよい。記事ページは `max-w-[920px]` の本文幅で、左右余白が出るためサイドレール向き。トップページはヒーロー、ランキング、開催リンク、分析カード、記事グリッド、FAQがカード状に並ぶため、ページ内自動広告はカード内ではなくセクション境界に寄りやすい。レースページはsticky、タブ、予想表、横スクロール、カード型分析が多いため、ページ内自動広告の自然な差し込み位置をGoogleが見つけにくい。
- **モバイルのレイアウト評価**: 縦積みなので自動広告自体は入りやすいが、ヒーロー直後、高配当ランキング前、日付ナビ直後、レース表直前、レース表途中に入ると体験悪化が大きい。手動の `MobileStickyAd` はOFFになっているため、AdSense下部アンカーとの二重表示リスクは解消済み。下部アンカーが日付移動、レース切替、前後日リンク、表の横スクロール操作を邪魔しないかは、ユーザー側の実機確認が必要。
- **記事ページの重要な注意点**: 記事は長文ページなので一見自動広告向きに見えるが、文章の途中へ自然に入るとは限らない。本文は `dangerouslySetInnerHTML` で `.prose` の大きなHTMLブロックとして描画され、こちらが意図した段落間の広告目印はない。84記事の見出し数を確認したところ、H2が4本以上の記事は68本あるが、H2が7本以上の記事は3本だけだった。多くの記事は中尺であり、本文中に安全に入れられる広告は1箇所程度。自動広告だけだと、文章間ではなく記事前後、関連記事前、記事末尾、セクション境界に寄る可能性が高い。
- **記事内広告の今後の判断**: 自動広告テストは継続するが、「記事本文中広告の最適性」はこのテストだけで判断しない。記事RPMが弱い、またはAdSenseプレビューで本文中に自然に入らない場合は、記事ページだけ手動広告を段階復帰する。第一候補は `article_after_intro` の1枠。長文記事だけ `article_mid` も検討する。記事タイトル直後、目次直後、`ArticleSearchEntryPanel` の前後には原則入れない。
- **レースページの今後の判断**: レースページは自動広告だけでは最適化しにくい可能性が高い。自動広告テストでレース系RPMや詳細閲覧数が伸びない場合、手動復帰候補は `race_after_prediction_table`、`race_premium_mid`、`race_after_data_explainer`、`race_after_top_hits` のうち、表示テンポを壊しにくい箇所に限定する。予想表の前、stickyレース選択直下、表の内部には広告を戻さない。
- **トップページの今後の判断**: トップページでは、自動広告がヒーロー直後や高配当ランキング前に入るとサイト価値の初回認識を削る可能性がある。自動広告でRPMが上がっても、`/races/{date}` への遷移率や高配当ランキングの閲覧が落ちる場合は、除外エリアまたはトップの手動広告設計を再検討する。手動復帰する場合は `home_after_value_preview`、`home_after_special_pick` など、価値訴求後の明確な区切りを優先する。
- **OFF中の主な手動広告枠**: グローバルでは `MobileStickyAd` の `8529703346`。トップページでは `home_after_value_preview`、`home_after_special_pick`、`home_article_feed_1`、`home_article_feed_2`、`home_after_faq`、`TopHitsDisplay` のモバイル穴埋め。記事一覧では注目記事後、4件目/9件目後、末尾Multiplex。記事詳細では `article_after_intro`、`article_mid`、`article_after_body`、末尾Multiplex。レース系では `race_after_prediction_table`、`race_premium_mid`、`race_after_data_explainer`、`race_after_top_hits`。FAQ、`/about-ai`、`/search` にも手動 `AdUnit` があるが、現在はすべてフラグでOFF。
- **見るべき指標**: AdSenseでは推定収益、Page RPM、Impression RPM、CTR、Active View、広告フォーマット別実績、ページ別実績を見る。GA4ではページ/セッション、エンゲージメント時間、記事から `/races/today` やレース詳細への遷移率、日別レース一覧からレース詳細への遷移率、レース内の複数レース閲覧、`ad_impression_custom` の `ad_format`、`ad_slot`、`ad_variant`、`ad_page_type` を見る。Search ConsoleとCore Web VitalsではCLS悪化と主要記事のCTR変化を確認する。
- **テスト期間**: 最低7日、できれば土日開催を2回含む14日で判断する。競馬サイトは平日と土日で行動が大きく変わるため、平日だけの結果で最終判断しない。高配当的中や重賞記事流入がある週は外れ値になり得るため、ページ種別別に分けて見る。
- **管理画面・実機確認の引き継ぎ**: Codex内蔵ブラウザでAdSense管理画面を開けない場合、ユーザー側で確認する。確認対象は、モバイルで下部アンカーが操作を邪魔しないか、記事本文中に広告が自然に入るか、レース表前後に広告が割り込まないか、デスクトップでサイドレールが表示されるか、サイドレールが中央コンテンツと重ならないか、ポリシー系ページに広告が出ていないか、または本適用時に除外できるか。
- **最終方針**: 自動広告単独テストは実施する。ただし、UMA-FREEの収益最大化は「自動広告だけで全ページ最適化」ではなく、「自動広告でオーバーレイ・サイドレール・Multiplexの基礎収益を測り、記事本文中とレースデータ後の高価値枠は必要に応じて手動で戻す」方針が最も堅い。特に記事の文章間広告は自動広告だけでは弱い可能性があるため、後日 `article_after_intro` を戻す判断余地を残す。
- **2026-06-07 追加: 本番適用されたAdSense設定**: ユーザーがAdSense管理画面でテストではなく実行適用した。確認できた設定は、インテント重視フォーマットは広告インテントOFF。オーバーレイフォーマットはアンカー広告ON、サイドレール広告ON、全画面広告ON。アンカー広告はダイナミックアンカー許可ON、幅1,000px超の画面にも表示ON、位置はスクリーンショット上では「上部または下部」が選択されている。サイドレールは左右表示。全画面広告は表示頻度10分、追加トリガーON、幅1,000px超の画面にも表示ON。ページ内フォーマットはバナー広告ON、Multiplex広告ON、関連する検索OFF。バナー詳細では、ページに表示する広告の最大数と広告の最小間隔がスライダーで設定済み、記事ページ上にある他の広告プレースメントを探すON、既存の広告を最適化するON。自動最適化タブでは自動最適化ON、テスト結果で優位なパターンを自動適用ON、テスト対象トラフィック50%。AMP自動広告もON、AMPページ内広告ON、AMPアンカー広告ONになっている。現状のNext.jsサイトにAMPページがなければAMP自動広告は実質影響しない見込み。
- **AMPページの整理**: AMPは `Accelerated Mobile Pages` の略で、通常のスマホページとは別に、AMP専用のHTML仕様、AMP用script、`amphtml` リンクなどを持つ軽量ページを指す。Next.jsでは `next/amp`、`withAmp`、`amphtml` などの実装が必要になるが、現状のコード検索では該当実装は確認されていない。そのため、AdSense側でAMP自動広告がONでも、現在のUMA-FREE本体ページには基本的に影響しない見込み。将来AMPページを追加しない限り、AMP自動広告設定は実質待機状態として扱う。
- **本番適用後の注意点**: 事前方針ではアンカー広告は下部のみを推奨していたが、実設定では「上部または下部」になっている。自動最適化ONのため、AdSense側が広告収益、広告表示、クリック、視認性などの観点で上部/下部を含む広告パターンを改善していく認識でよい。ただし、AdSenseの最適化はUMA-FREE固有の「レース表が操作しやすいか」「記事からレース詳細への遷移が落ちていないか」「複数レース閲覧が減っていないか」までは直接最適化対象にしない。そのため、上部アンカーがヘッダー、記事タイトル、レースのsticky選択と体感上ぶつかるかどうかはモバイル実機とGA4で確認する。明確な固定条件で比較したい場合は自動最適化OFFも検討できるが、収益最大化を優先するならONのままでよい。全画面広告10分は許容範囲だが、レース切替が多いユーザーでは追加トリガーにより体感頻度が高くなる可能性があるため、直帰率よりもレース詳細閲覧数、複数レース閲覧数、記事からレースへの遷移率を見る。

#### ✅ 収益改善: 広告計測粒度強化・レース詳細導線・自動生成記事CTR対策
- **完了日時**: 2026-06-07 17:02
- **実施内容**: AdSense/GA4の分析結果を踏まえ、広告RPM改善を配置単位で検証できるよう `ad_impression_custom` の送信内容を拡張。従来の `ad_placement` に加えて、`ad_format`、`ad_slot`、`ad_variant`、`ad_page_type` を送るようにし、ディスプレイ広告、インフィード広告、ネイティブカード広告、モバイル追従広告の各コンポーネントから形式・スロット・A/B種別を渡す構成へ変更した。レース日別ページでは、折りたたみ内に隠れていた主要レースを「今日まず見るレース」として上部に直接表示し、日別一覧から収益効率の高いレース詳細ページへ自然に進める導線を追加。自動生成記事については、検索結果での見え方をWriterプロンプトに追加し、title/descriptionで「見方」「違い」「買い時」「見送り条件」など読者の判断語を自然に入れる方針を明文化。SEOチェック側では、descriptionの未完文と不自然な生成表現を検出するルールを追加した。既存の低CTR良順位記事では、馬体重、馬場状態、ルメール騎手、馬券控除率の4記事について、本文内の既存数値だけを使い、title/descriptionを検索意図に寄せつつ、煽り・投資感・AIっぽい置換痕のある表現を自然な競馬記事の文体へ修正した。
- **変更ファイル**: `frontend/lib/analytics.ts`, `frontend/components/AdUnit.tsx`, `frontend/components/InFeedAd.tsx`, `frontend/components/NativeCardAd.tsx`, `frontend/components/MobileStickyAd.tsx`, `frontend/components/RaceDayDashboard.tsx`, `frontend/scripts/agents/agent_writer.ts`, `frontend/scripts/agents/seo_checker.ts`, `frontend/content/articles/2025-11-11-weight-change-impact-analysis.md`, `frontend/content/articles/2025-10-26-ground-condition-impact.md`, `frontend/content/articles/2025-10-06-christophe-lemaire-data-analysis.md`, `frontend/content/articles/2025-10-26-ticket-types-complete-explanation.md`, `AGENTS.md`
- **確認事項**: `npm run article:validate-links` は84記事チェックで成功。`npx tsc --noEmit` は通常実行で `C:\Users\zk-ht` の `lstat EPERM` になったため、権限付きで再実行して成功。`npm run build` は開発サーバー停止後に権限付きで成功し、静的ページ数は153件。既存どおり `caniuse-lite` 更新推奨と、ローカルバックエンド未起動による `127.0.0.1:8000` 取得失敗ログが出たが終了コードは0。ローカルNext devは `http://localhost:3000` で再起動済み。トップページと控除率記事はHTTP 200で、控除率記事の新しいtitle/description文言がHTMLに出力されることを確認。レースページはバックエンド未起動・当日データなしのため `/races/today` が404、過去日レースが500/404になり、画面上の導線表示は未確認。Codex内蔵ブラウザでAdSense管理画面を開こうとしたが、`windows sandbox failed: spawn setup refresh` でブラウザ接続に失敗し、認証画面まで到達できなかった。
- **次のステップ**: 本番反映後、GA4管理画面で `ad_format`、`ad_slot`、`ad_variant`、`ad_page_type` をイベントスコープのカスタムディメンションとして登録し、24〜48時間後から広告表示イベントをページ種別・広告形式別に確認する。AdSense管理画面では自動広告の「ページ内フォーマット」と除外エリアを、全面適用ではなくプレビューまたは小さな範囲で検証する。バックエンド起動後に `/races/{date}` の「今日まず見るレース」導線をブラウザで目視確認し、GA4では日別レース一覧からレース詳細への遷移率、記事からレース詳細/当日分析への遷移率、広告形式別Active ViewとRPMを追跡する。

#### ✅ 記事生成改善: 生成パイプラインの重複・架空データ対策
- **完了日時**: 2026-06-07 02:22
- **実施内容**: 記事生成パイプライン調査レポートに基づき、Writer、Editor、SEOチェック、Publisher周辺の構造問題を修正。`title` 上限を40字から50字へ、`description` 上限を160字へ拡張し、40字制限による画一的なフォールバックtitleを抑制した。Writerプロンプトには `reference_data` に存在しない勝率・回収率・枠順別成績・斤量別成績・AI偏差値を補完、推測、生成しないルールを追加し、データテーブルも入力JSONに存在する列と値だけで作るよう明文化した。Editor側は、文字数不足時に `直前に見る3つの確認材料` などの共通定型ブロックを差し込む処理を停止し、短い原稿は定型文で合格させず、機械チェックで落とす設計へ変更。H2見出しも全見出しへ数字を強制するルールを緩和し、最低1つの具体的な数字を含む見出しを求めつつ、全記事が `3つの` 構文へ寄る状態を避けた。さらに `/og/{slug}.png` の動的PNG生成ルートを追加し、Publisherが設定していたOG画像URLが実際に画像として返るようにした。既存記事では、Editor由来の固定ブロックが残っていた10記事から該当セクションを削除し、1記事の重複description文言と1記事の過剰表現 `圧倒的` を自然な表現へ修正。`posted_history.json` は既存84記事のfrontmatterから復元し、重複生成チェックが1件分しか効いていない状態を解消した。
- **変更ファイル**: `frontend/scripts/agents/seo_checker.ts`, `frontend/scripts/agents/agent_writer.ts`, `frontend/scripts/agents/agent_editor.ts`, `frontend/app/og/[slug]/route.ts`, `frontend/scripts/agents/cleanup_generated_article_boilerplate.js`, `frontend/scripts/agents/rebuild_posted_history.js`, `data/posted_history.json`, `frontend/content/articles/2026-05-21-kyotodirt1800m-jockey-data.md`, `frontend/content/articles/2026-05-24-2026-ai-98ffdbb1.md`, `frontend/content/articles/2026-05-27-nakayamaturf2000m-jockey-data.md`, `frontend/content/articles/2026-05-27-s2026-ai-9b63f42c.md`, `frontend/content/articles/2026-05-29-nakayamadirt1200m-jockey-data.md`, `frontend/content/articles/2026-05-30-tokyoturf2400m-jockey-data.md`, `frontend/content/articles/2026-05-31-2026-ai-6c2de93f.md`, `frontend/content/articles/2026-06-03-tokyodirt2100m-jockey-data.md`, `frontend/content/articles/2026-06-04-kyototurf1600m-jockey-data.md`, `frontend/content/articles/2026-06-05-tokyoturf1800m-jockey-data.md`, `frontend/content/articles/2026-04-19-kyotodirt1900m.md`, `AGENTS.md`
- **確認事項**: `npm run article:validate-links` は84記事チェックで成功。`npx tsc --noEmit` は権限付き実行で成功。`npm run build` はNext devを一時停止した状態で成功し、静的ページ数は153件。既存どおり `caniuse-lite` 更新推奨と、ローカルバックエンド未起動による `127.0.0.1:8000` 取得失敗ログが出たが終了コードは0。`/og/2026-06-05-tokyoturf1800m-jockey-data.png` はローカルでHTTP 200、`Content-Type: image/png` を確認し、生成PNGも目視でタイトル・説明文が枠内に収まることを確認。Codex内蔵ブラウザは `windows sandbox failed: spawn setup refresh` で接続できず、ブラウザスクリーンショット確認は未実施。ビルド確認後、ローカルNext devは `http://localhost:3000` で再起動済み。
- **次のステップ**: 固定ブロック削除で本文が1,500字未満になった既存記事は、架空データを足さずに個別リライトで厚みを戻す。次回以降の生成記事では、Editorの水増しに頼らずWriterの初稿品質をGA4/GSCのCTR・滞在時間で確認する。OG画像は本番反映後、X Card Validator等で `https://uma-free.com/og/{slug}.png` がカード画像として取得されるか確認する。

#### ✅ 収益改善: 構造化データSSR化と低CTR記事メタ最適化
- **完了日時**: 2026-06-07 02:44
- **実施内容**: `Breadcrumb.tsx` と `FAQClient.tsx` がClient Component内でJSON-LDを出していた問題を修正。パンくずUIからJSON-LD出力を外し、`StructuredData.tsx` の `BreadcrumbSchema` を、パンくず表示のある各ページのServer Component側で出力する形へ統一した。FAQは質問データを `frontend/lib/faq-content.ts` に切り出し、画面表示と `FAQSchema` が同じデータを参照する構成へ変更。あわせて、Search Consoleで順位良好・CTR低迷が残っていた `レース荒れ分析`、`人気的中率分析`、`武豊分析` の3記事について、本文内に存在する数値だけを使い、title、description、keywordsを検索意図に寄せて自然な文言へ調整した。AdSenseの「ページ内フォーマット」はコード変更ではなく管理画面施策のため、公式ヘルプの仕様を確認し、即時全面有効化ではなくAdSense管理画面の実験または小さな範囲での有効化を推奨する判断にした。
- **変更ファイル**: `frontend/components/Breadcrumb.tsx`, `frontend/components/FAQClient.tsx`, `frontend/lib/faq-content.ts`, `frontend/app/**/page.tsx`（パンくず表示ページの `BreadcrumbSchema` 追加）, `frontend/content/articles/2025-10-07-yutaka-take-data-analysis.md`, `frontend/content/articles/2025-10-10-race-grade-chaos-analysis.md`, `frontend/content/articles/2025-11-08-popularity-hit-rate-analysis.md`, `AGENTS.md`
- **確認事項**: `rg` で `frontend/components/Breadcrumb.tsx` と `frontend/components/FAQClient.tsx` に `application/ld+json`、`FAQPage`、`BreadcrumbList` が残っていないことを確認。`<Breadcrumb />` を使う `frontend/app` 配下のページはすべて `BreadcrumbSchema` を持つことを確認。`npm run article:validate-links` は84記事チェックで成功。`npx tsc --noEmit` は通常実行でサンドボックス由来の `EPERM: lstat 'C:\Users\zk-ht'` になったため権限付きで再実行し成功。`npm run build` はNext devを一時停止した状態で成功し、静的ページ数は153件。既存どおり `caniuse-lite` 更新推奨と、ローカルバックエンド未起動による `127.0.0.1:8000` 取得失敗ログが出たが終了コードは0。生成HTMLとローカル `http://localhost:3000/faq` で `FAQPage` と `BreadcrumbList`、記事ページで `Article` と `BreadcrumbList`、新しい記事titleが出力されることを確認。`git diff --check` は成功し、LF/CRLF警告のみ。ビルド後、Next devは `http://localhost:3000` で再起動済み。
- **次のステップ**: 本番反映後、GoogleのリッチリザルトテストまたはSearch ConsoleのURL検査でFAQとBreadcrumbの検出を確認する。GSCでは対象3記事のCTRを28日単位で追跡し、改善が鈍い場合はH1直下リード文と検索結果で見える冒頭文も再調整する。AdSenseのページ内フォーマットは、管理画面で「自動広告」「ページ内フォーマット」を確認し、まず実験または限定適用でバナー広告・Multiplex広告を中心に試す。ヘッダー直下、記事冒頭、レース表の直前など、UXやCLSに影響しやすい領域は除外エリアに入れ、RPM、Active View、CLS、記事からレースページへの遷移率を見て継続判断する。

#### ✅ UI改善: 記事流入向けトップ導線追加とトップページ導線整理
- **完了日時**: 2026-06-06 02:21
- **実施内容**: 検索から記事ページへ流入したユーザーが、記事本文へ入る前にUMA-FREEの主要機能へ進めるよう、記事ヘッダー直下に紹介枠を追加。高配当的中ランキング、本サイト独自の分析データ、本日の分析を見るボタンをまとめて表示し、既存のコンパクトな的中ランキング表示も組み込んだ。あわせて、トップページ下部の「競馬データの見方」セクションを削除し、重複感のある導線を整理した。
- **変更ファイル**: `frontend/components/ArticleSearchEntryPanel.tsx`, `frontend/app/articles/[slug]/page.tsx`, `frontend/app/page.tsx`, `AGENTS.md`
- **確認事項**: `npx tsc --noEmit` は権限付き実行で成功。`git diff --check` は成功し、LF/CRLF警告のみ。ローカル `http://localhost:3000/articles/2025-10-04-nakayama-dirt-1200m-data-analysis` はHTTP 200で、`検索から来た方へ`、`高配当的中ランキング`、`本日の分析を見る`、`本サイト独自の分析データ` の出力を確認。トップページ `http://localhost:3000/` もHTTP 200で、本文の「競馬データの見方」セクションは削除済み、同文言はフッターリンクにのみ残ることを確認。Codex内蔵ブラウザは `windows sandbox failed: spawn setup refresh` で接続できず、スクリーンショット確認は未実施。`npm run build` は通常実行で `.next/trace` への `EPERM`、権限付き実行では120秒タイムアウト。確認時点で既存の `next dev -p 3000` が稼働中で `.next` を利用していたため、今回発生したビルド不完走は開発サーバーとの生成物競合が主因と判断。タイムアウト後に残った `npm run build` と `next build` のプロセスは終了し、開発サーバーは維持した。
- **次のステップ**: ローカル開発サーバーを止めた状態で `npm run build` を再実行し、記事ページ上部の紹介枠とトップページのセクション削除をブラウザで目視確認する。本番反映後は、GA4で記事ランディングから `/races/today`, `/results/accuracy`, `/keiba-data` への遷移率を確認する。
- **追加対応**: 2026-06-06 02:39 に、記事上部導線から `検索から来た方へ` の文言を削除し、トップページに近い `hero`、高配当的中ランキング、独自分析データカードの構成へ変更。表示位置も記事ヘッダー下から記事内の最上部へ移動し、アイキャッチ画像・記事タイトルより前に表示されるよう修正した。`npx tsc --noEmit` は権限付き実行で成功。ローカル記事HTMLでは `検索から来た方へ` が存在しないこと、`article-entry-title` が `article-page-title` より前に出力されることを確認。
- **追加対応**: 2026-06-06 10:33 に、記事上部導線から `hero` 枠と `radial-gradient` 背景を削除し、先頭は `本日の分析を見る` ボタン単体に変更。`データの見方を確認する` の末尾リンクも削除した。`本サイト独自の分析データ` はホームと同じ5種類のグラフィック付きカード（AI偏差値、脚質予測、対戦成績、枠順傾向、AI分析コメント）へ揃えた。`npx tsc --noEmit` は権限付き実行で成功。ローカル記事HTMLでは `radial-gradient` と `データの見方を確認する` が存在しないこと、`本日の分析を見る` が記事H1より前に出力されること、`馬同士の直接比較` と `AI分析コメント` が出力されることを確認。
- **追加対応**: 2026-06-06 10:49 に、記事ページの `ArticleIntentPanel` と `GradeRaceUpdatePanel` の描画を停止し、`読み方のポイントを見る` と `重賞記事の更新方針` 系の枠付きセクションが表示されないよう修正。記事上部導線は記事ヘッダー直後へ移動し、表示順を `記事ヘッダー` → `高配当的中ランキング` → `本サイト独自の分析データ` → 中央寄せの `本日の分析を見る` ボタンに変更した。`npx tsc --noEmit` は権限付き実行で成功。ローカル記事HTMLでは指定された `border border-slate-200 bg-white p-4 sm:p-5` / `border border-slate-200 bg-slate-50 p-4 sm:p-5` のセクションが存在しないこと、上記の表示順になっていることを確認。
- **追加対応**: 2026-06-06 11:08 に、記事上部の `本サイト独自の分析データ` カード群を縦方向に圧縮。記事幅でもデスクトップでは5枚横並びになりやすいよう `lg:grid-cols-5` へ変更し、カード余白、アイコンサイズ、中央グラフィック高、バー太さ、マトリクスセル高を調整。説明文は2行までに抑えつつ、AI偏差値、脚質予測、対戦成績、枠順傾向、AI分析コメントの可視化は維持した。`npx tsc --noEmit` は権限付き実行で成功。ローカル記事HTMLで `grid gap-2 sm:grid-cols-2 lg:grid-cols-5`、`min-h-[58px]`、`line-clamp-2`、5種類のカードラベルが出力されることを確認。
- **追加対応**: 2026-06-06 11:19 に、記事の目次を高配当的中ランキングの上へ移動。高配当的中ランキングでは通常表示・コンパクト表示ともレース名を表示しないようにし、日付・競馬場・R番号、券種、的中番号、払戻だけを残した。独自分析データカードの小さなカテゴリラベル行も削除し、説明文を `過去走・適性・展開力を数値化し、一覧で比較できます`、`各コーナーでの隊列を予測し、展開の有利不利を確認できます` へ変更した。`npx tsc --noEmit` は権限付き実行で成功。ローカル記事HTMLでは目次が高配当ランキングより前に出力されること、`hit-name` とカード内の `text-[10px] font-semibold text-slate-400` の `p` が存在しないこと、変更後の2文言が出力されることを確認。

#### ✅ UX改善: Search Console CLS不良グループ対策
- **完了日時**: 2026-06-05 23:23
- **実施内容**: Search ConsoleでCLS 0.34の不良グループとして出ていた記事、トップ、レース詳細、データ解説系URLを対象に、共通のレイアウトシフト要因を修正。`AdUnit` は未配信広告を既定で折りたたまない設計へ変更し、トップ、記事一覧、FAQ、about-ai、keiba-data系ページで広告空振り時に本文が上へ詰まる動きを抑止した。広告コンテナの `content-visibility: auto` と `contain-intrinsic-size: 280px` は、実際の予約高90pxの広告枠とズレてスクロール中のCLS要因になるため削除。`NativeCardAd` と `InFeedAd` も未配信時にDOMごと消さず、予約枠を維持するよう変更し、特にホームの記事グリッドとレース詳細ページのインフィード広告でカードや予測表の位置が動かないようにした。さらに、`RecentRaceReturn` がlocalStorage読込後にページ上部へ突然カードを差し込む問題を修正し、初期描画から同じ高さの導線を表示してリピーター環境でのCLSを抑制した。
- **変更ファイル**: `frontend/components/AdUnit.tsx`, `frontend/components/NativeCardAd.tsx`, `frontend/components/InFeedAd.tsx`, `frontend/components/RecentRaceReturn.tsx`, `frontend/app/globals.css`, `AGENTS.md`
- **確認事項**: `npm run build` は成功し、静的ページ数は152件。既存どおり `caniuse-lite` 更新推奨と、ローカルバックエンド未起動による `127.0.0.1:8000` 取得失敗ログが出たが終了コードは0。`git diff --check` は成功し、LF/CRLF警告のみ。ローカル開発サーバー `http://localhost:3000` を起動し、トップページ、記事ページ、記事一覧、about-aiのHTTP 200を確認。トップでは広告枠3件が `ad-preserve-space` と90px予約を持ち、`RecentRaceReturn` のSSR導線も出力されることを確認。記事ページでは `article-ad-slot`、`ad-preserve-space`、280px予約を確認。生成CSSでは `content-visibility` が消え、明示時のみ使う `ad-collapse-unfilled` が存在することを確認。Codex内蔵ブラウザはNode REPL側の `windows sandbox failed: spawn setup refresh` で接続できなかったため、ブラウザスクリーンショット確認は未実施。
- **次のステップ**: 本番反映後、Search Consoleの該当CLSグループで「修正を検証」を開始し、28日単位でCLSが良好または改善待ちに移るか確認する。GA4/AdSenseでは広告未配信時の空白増加が回遊率やRPMへ与える影響を確認し、必要ならファーストビュー外の一部広告だけ `collapseUnfilled` を明示的に戻す。

#### ✅ 収益改善: リワード広告ゲート一時停止と記事流入残タスク対応
- **完了日時**: 2026-06-05 08:26
- **実施内容**: `reward_ad_unavailable` と `reward_gate_view` の多さによる機会損失を抑えるため、リワード広告は在庫・配信設定が安定するまで一時停止できる構成に変更。デフォルトでは `NEXT_PUBLIC_REWARDED_AD_MODE` を `enabled` にしない限りGAMのリワード広告スロットを読み込まず、詳細データはゲートで止めずに表示する。通常のレースページ内広告で回収する状態にし、在庫不足時の無駄な `reward_ad_unavailable` 計測も抑制した。あわせて、記事から流入したユーザーがAIっぽい文言で離脱しないよう、既存記事の機械的・不自然な表現を一括点検し、`AI予想無料を買う前は`、`勝率、回収率、枠順や騎手の傾向を照らし`、`高いな数字`、`大きく優位性`、`お勧めします` などの表現を自然な競馬記事の言い回しへ修正。今後の記事生成でも同じ崩れが再発しないよう、編集器の補正処理と記事生成プロンプトにも禁止表現・置換ルールを追加した。
- **変更ファイル**: `frontend/hooks/useRewardedAd.ts`, `frontend/components/RaceTabs.tsx`, `frontend/scripts/agents/agent_editor.ts`, `frontend/scripts/agents/agent_writer.ts`, `frontend/scripts/agents/naturalize_existing_articles.js`, `frontend/content/articles/*.md`（既存記事の自然化対象）, `docs/system-documentation/15_マネタイズ施策_リワード広告導入.md`, `docs/system-documentation/18_リワード広告運用チェックリスト.md`, `AGENTS.md`
- **確認事項**: `npm run article:validate-links` は83記事チェックで成功。`npm run build` は成功し、静的ページ数は152件。ビルド時には既存どおり `caniuse-lite` 更新推奨と、ローカルバックエンド未起動による `127.0.0.1:8000` 取得失敗ログが出たが終了コードは0。`git diff --check` は成功し、LF/CRLF警告のみ。記事本文は `大きくな|を買う前は|AI予想無料|勝率、回収率、枠順や騎手の傾向を照らし|大きく優位性|高いな数字|お勧めします` の検索でヒットなしを確認。2026-06-05 22:45にGAM管理画面も読み取り確認し、リワード広告ユニット `uma-free-rewarded-premium` はID `23343574779`、コード `uma-free-rewarded-premium`、広告ユニットパス `/23345285369/uma-free-rewarded-premium`、ステータス有効、サイズはページ外、親は最上位。設定ではAdSenseによる未販売広告枠の収益最大化はオン。インサイトは過去7日間データなし、広告申込情報タブは今後30日間に表示できるデータなし、リワードの金額・タイプ・サーバーサイド認証ポストバックURLは空欄。GAM管理画面の設定変更は行っていない。
- **次のステップ**: 本番反映後、GA4で `reward_gate_view` と `reward_ad_unavailable` が大きく減ること、`premium_data_view` が詳細データ閲覧として維持されること、記事ランディング後の2ページ目遷移率が改善することを確認する。GAM側は配信予定の広告申込情報またはAd Exchange/AdSense側のリワード対応需要が確認できるまで、サイト側の `NEXT_PUBLIC_REWARDED_AD_MODE` は未設定または `fallback` のままにする。在庫が安定した段階で `NEXT_PUBLIC_REWARDED_AD_MODE=enabled` を設定して再デプロイする。
- **追加対応**: 2026-06-05 22:52 に、GAM確認結果と再開条件を `docs/system-documentation/18_リワード広告運用チェックリスト.md` として新規作成。古いオファーウォール導入方針にも、2026-06-05時点では在庫安定までゲート一時停止とする運用注記を追記した。ローカル `.env` / `backend\.env` / `frontend\.env.local` には `NEXT_PUBLIC_REWARDED_AD_MODE` が存在しないため、現コードを本番デプロイすればデフォルトで `fallback` 扱いになることも確認した。

#### ✅ データ復旧: 2026年6月5日レースデータ文字化け修正
- **完了日時**: 2026-06-05 01:11
- **実施内容**: 2026年6月5日の本番レースデータでも、6月4日と同じHTMLデコード起因の文字化けが発生していたため修復。DB直読みでは36レース・381予測のうち、予測馬名は381件すべて、レース名またはAI分析文は35レースで文字化け疑いを検出。前回追加した `repair_mojibake_race_day.py` を使い、出馬表を正しいデコードで取り直して、名古屋・園田・船橋のレース名、馬名、騎手・調教師名、予測馬名、AI分析文中の壊れた馬名を修復し、本番DBへ反映した。さらに、当日・昨日・明日のレースAPI取得キャッシュを1時間から5分へ短縮するよう `frontend/lib/api.ts` を変更し、修復や当日再生成が公開ページへ反映されるまでの待ち時間を短くした。
- **変更ファイル**: `frontend/lib/api.ts`, `AGENTS.md`
- **確認事項**: 修復スクリプトのドライランでは36レース、381予測を対象に、修復後の文字化け疑い0件を確認。`--apply --use-cache` で本番DBへ反映し、DB直読みで36レース・381予測とも文字化け0件を確認。本番API `2026-06-05` でも36レース・381予測の文字化け0件を確認し、代表値として `アジア・アジアパラ応援28(C)`、`コスモナッシュビル` が正常に返ることを確認。`npm run build` は成功し、静的ページ数は152件。ビルド時には既存どおり `caniuse-lite` 更新推奨と、ローカルバックエンド未起動による `127.0.0.1:8000` 取得失敗ログが出たが終了コードは0。公開ページ `https://uma-free.com/races/2026-06-05` はVercel/Nextのサーバー側fetchキャッシュにより、確認時点では古いHTMLが残っていた。GETヘッダーは `X-Vercel-Cache: MISS` / `Cache-Control: private, no-cache, no-store` で、ページCDNではなくNext fetch data cacheのTTL待ちと判断。
- **次のステップ**: `backend/scripts/scraper.py` と `frontend/lib/api.ts` を次回デプロイに含め、以後のデータ取得で文字化けを再発させない。6月5日データの本体は本番DB・APIとも修復済みのため、公開ページHTMLはNext fetch cacheの再検証または再デプロイ後に正常化する。

#### ✅ データ復旧: 2026年6月4日レースデータ文字化け修正
- **完了日時**: 2026-06-05 00:25
- **実施内容**: 2026年6月4日の本番レースデータで、名古屋・園田・船橋・門別のレース名、馬名、AI分析文中の馬名が `���` 混じりで表示されていた問題を調査。原因は出馬表HTML取得時に `race.netkeiba.com` / `nar.netkeiba.com` 系ページも一律EUC-JPとしてデコードしていたことで、UTF-8ページの馬名がDB保存前に欠落していたため。HTMLレスポンスのcharset宣言、URL系統、候補エンコードごとの文字化けスコアを比較して最も崩れの少ないデコード結果を採用する処理へ修正。さらに、6月4日分の既存DBデータは元文字が欠落しているため、出馬表を正しいデコードで取り直し、レース名、馬名、騎手・調教師名、予測馬名、AI分析文中の壊れた馬名を修復する専用スクリプトを追加し、本番DBへ反映した。
- **変更ファイル**: `backend/scripts/scraper.py`, `backend/scripts/repair_mojibake_race_day.py`, `AGENTS.md`
- **確認事項**: `python -m py_compile backend\scripts\scraper.py backend\scripts\repair_mojibake_race_day.py` は成功。ローカルPythonでも同2ファイルの `py_compile` は成功。代表レース `202648060401` の出馬表を修正後デコードで確認し、`優駿DAY オープニング(3歳)`、`ブルーリュバン`、`シーズンシート` などが文字化けせず取得できることを確認。修復スクリプトのドライランでは48レース、525予測を対象に、修復後の文字化け疑い0件を確認。`--apply --use-cache` で本番DBへ反映し、DB直読みで48レース・525予測とも文字化け0件を確認。本番API `2026-06-04` でも文字化け0件、公開ページ `https://uma-free.com/races/2026-06-04` のHTMLでも文字化けマーカーなし、代表レース名・馬名が表示されていることを確認。`git diff --check` は成功。
- **次のステップ**: 修正後の `backend/scripts/scraper.py` を次回デプロイに含め、今後の当日データ取得で同じ文字化けが再発しないようにする。6月4日ページは本番DB・API・公開HTMLで修復済みだが、ブラウザ側に古いキャッシュが残る場合は再読み込みで確認する。

#### ✅ 収益改善: 追加伸長施策一式の実装
- **完了日時**: 2026-06-04 01:58
- **実施内容**: 記事流入後の回遊改善とCLS対策に続き、提示された追加施策を実装。重賞記事は同一URLで「1週間前の展望」「枠順確定後」「前日更新」「当日朝更新」を育てる前提にし、記事ページへ更新方針パネルを追加、記事生成プロンプトと公開処理にも `update_stage` と既存重賞記事更新ルールを追加した。低CTRページ対策として `/keiba-data` と `/about-ai` のSEOタイトル・descriptionを検索回答型へ変更。レース詳細ページはレース名、開催場、R番号を先頭に置いた「AI予想・出走馬分析」型のmetadataとOGPへ強化。モバイル追従広告は `control` / `delayed` / `compact` の3パターンA/Bへ変更し、表示開始位置と広告高さを比較可能にした。リワード広告は在庫なし・タイムアウト・準備中の場合にゲートを出し続けず、詳細データを直接表示するソフトフォールバックへ変更し、通常のインフィード広告で回収する構成にした。上位流入記事と検出された不自然な記事descriptionの重複・途中切れ・機械的タイトルをまとめて自然な文言へ修正した。
- **変更ファイル**: `frontend/app/keiba-data/page.tsx`, `frontend/app/about-ai/page.tsx`, `frontend/app/races/[date]/[venue]/[race]/page.tsx`, `frontend/app/articles/[slug]/page.tsx`, `frontend/components/GradeRaceUpdatePanel.tsx`, `frontend/components/MobileStickyAd.tsx`, `frontend/components/RaceTabs.tsx`, `frontend/lib/articles.ts`, `frontend/lib/grade-race-update-plan.ts`, `frontend/scripts/agents/agent_writer.ts`, `frontend/scripts/agents/agent_publisher.ts`, `frontend/content/templates/grade-race-preview-update-template.md`, `frontend/content/articles/*.md`（上位流入・不自然description検出記事）, `AGENTS.md`
- **確認事項**: `npm run article:validate-links` は82記事チェックで成功。`npm run build` は成功し、静的ページ数は151件。生成済みHTMLで日本ダービー記事に「重賞記事の更新方針」「次に確認するページ」「日本ダービーの出馬表を見る」「article-ad-slot」が含まれること、`/keiba-data` に「競馬データ分析 無料」、`/about-ai` に「競馬データ分析の仕組み」が含まれることを確認。`git diff --check` は成功。ビルド時には既存の `caniuse-lite` 更新推奨と、バックエンド未起動による `127.0.0.1:8000` 取得失敗ログが出たが終了コードは0。ローカルサーバー起動と最終プロセス確認は権限付き実行の利用上限で実施できなかった。
- **次のステップ**: 本番反映後に、Search Consoleで `/keiba-data`, `/about-ai`, `/races/*` のCTR推移、GA4で記事から出馬表・関連記事への2ページ目遷移率、AdSenseで `sticky_bottom_control/delayed/compact` のActive View・CTR・RPM、GA4で `reward_fallback_used` と `premium_data_view` の変化を確認する。GAM/AdSense管理画面ではリワード広告ユニット `/23345285369/uma-free-rewarded-premium` の対象デバイス、在庫、配信制限、広告ユニットパスを確認する。

#### ✅ 収益改善: 記事流入の回遊導線強化と記事CLS対策
- **完了日時**: 2026-06-04 01:37
- **実施内容**: `分析レポート` 内のSearch Console、GA4、AdSense系データを確認し、直近の収益増は日本ダービー記事を中心とした検索流入増、ページビュー増、広告表示回数増、クリック数増が主因と推定。記事流入後の離脱を抑えるため、記事冒頭の意図パネルに「次に確認するページ」を追加し、日本ダービー、目黒記念、オークス、新潟大賞典の記事では該当レースの出馬表へ直接遷移できる導線を設定。関連記事を本文後広告より前に移動し、広告を見る前に次の記事へ進める構成へ変更。Search ConsoleでCLS不良が出ていた記事ページ向けに、記事内広告枠を280pxで予約し、未配信時も本文を押し上げない設定を追加。広告コンテナの `contain-intrinsic-size` も設定し、モバイルでの記事タイトル・パンくず・本文見出しの横崩れ対策を追加。主要流入記事の重複気味なdescriptionも自然な文言へ整理した。
- **変更ファイル**: `frontend/lib/article-ux.ts`, `frontend/components/ArticleIntentPanel.tsx`, `frontend/components/AdUnit.tsx`, `frontend/components/Breadcrumb.tsx`, `frontend/app/globals.css`, `frontend/app/articles/[slug]/page.tsx`, `frontend/content/articles/2026-05-24-2026-ai-8a51ae64.md`, `frontend/content/articles/2026-05-24-2026-ai-98ffdbb1.md`, `frontend/content/articles/2026-05-21-2026-ai-22f493f9.md`, `frontend/content/articles/2025-11-11-weight-change-impact-analysis.md`, `AGENTS.md`
- **確認事項**: `npm run article:validate-links` は82記事チェックで成功。`npm run build` は151ページ生成で成功。ビルド時に既存の `caniuse-lite` 更新推奨と、バックエンド未起動による `127.0.0.1:8000` 取得失敗ログが出たが、終了コードは0。ローカル記事ページをEdge DevTools Protocolでモバイル幅390pxとして確認し、`innerWidth=390`, `scrollWidth=390`, H1幅334pxで横スクロールなし。記事内広告枠は `article-ad-slot` が高さ280px、`minHeight=280px`、初期 `layout-shift` 記録なしを確認。Codex内蔵ブラウザ制御はWindowsサンドボックス側の起動失敗で使用できなかったため、Edge CDPで代替確認した。
- **次のステップ**: 本番反映後、Search ConsoleでCLSグループの「修正を検証」を開始し、28日単位で該当45URLグループのCLS改善を確認する。GA4では記事ランディング後の2ページ目遷移率、`/races/2026-05-31/tokyo/11` など該当レースページへの遷移、関連記事クリック率を追跡する。AdSenseでは記事内広告ユニット別の表示回数、Active View、クリック率、RPMを確認し、280px予約枠によるViewable改善と収益への影響を見る。

#### ✅ 自動運用復旧: X API一時403とSNS投稿重複リスクの修正
- **完了日時**: 2026-06-04 00:30
- **実施内容**: 朝SNS投稿でX APIが403 Forbiddenになり、レスポンス本文がCloudflareの `Just a moment...` HTMLになった場合を恒久的な認証不備ではなく一時的な外部要因として扱うよう修正。X投稿は最大3回リトライし、Cloudflareチャレンジ、429、5xx、ネットワーク系エラーを一時障害として分類するようにした。Xだけが一時障害で失敗してもThreadsが成功した場合は `FAIL_ON_SNS_ERROR=true` でもジョブを失敗扱いにせず、投稿済み記録を保存する運用に変更。認証情報不足や恒久的なX APIエラーは引き続き失敗扱い。さらに、X投稿時にURL行を削った本文だけが記録され、重複チェック側のURL付き本文とハッシュがずれる問題を補正し、いずれかのSNSで配信できた場合は元本文でも投稿記録を残すようにした。投稿記録保存は既存レコード確認と `tweet_id` 補完に対応し、一意制約による不要な保存失敗ログを避けるよう改善した。
- **変更ファイル**: `backend/scripts/sns_poster.py`, `.github/workflows/keiba-sns-morning-post.yml`, `.github/workflows/keiba-sns-afternoon-post.yml`, `.github/workflows/keiba-sns-evening-post.yml`, `.github/workflows/keiba-sns-pre-race.yml`, `.github/workflows/keiba-sns-hit-immediate.yml`, `AGENTS.md`
- **確認事項**: `python -m py_compile backend\scripts\sns_poster.py` は成功。`py -3.12 -m py_compile backend\scripts\sns_poster.py` は成功。`git diff --check` は成功。補助確認として `python -c ...` と `py -3.11/-3.12 -c ...` で関数単体確認を試したが、PowerShell上のPython解決、壊れたStore版Python参照、またはサンドボックス実行権限により未完了。Codex同梱Pythonは `requests` が入っていないため、対象モジュールのインポート確認には使えなかった。
- **次のステップ**: 次回の朝SNS GitHub Actionsで、XがCloudflare 403になった場合に3回リトライすること、Threadsが成功した場合はジョブが成功終了し、同日の再実行でThreads投稿が重複しないことを確認する。XがJSON形式の認証/権限エラーを返した場合は引き続きSecretsまたはX Developer Portal側の確認を行う。

#### ✅ 自動運用復旧: 記事公開バリデーション・SNS本命馬成績集計の修正
- **完了日時**: 2026-05-27 22:12
- **実施内容**: 日次記事公開で `大きくな` が検出されて公開ロールバックされる問題を修正。NG語の単純置換で「圧倒な」「圧倒的な」などが不自然な断片に変わらないよう、文脈別の置換と公開直前の不自然語補正を追加し、通常表現の「大きくない」系も検証器に引っかからない自然な言い換えへ補正するようにした。朝SNS投稿では、APIレスポンスの結果キャッシュや馬番不一致によりAI本命馬成績が `[0-0-0-0]` になる問題を防ぐため、DBから `◎` と着順を直接集計する経路を追加し、APIフォールバック側も `horse_id`、馬番、馬名の順で照合するように改善。API側も結果未反映の過去日レスポンスを長時間キャッシュしないようTTLを調整し、JST朝に昨日分をUTC上の今日として扱わないようキャッシュ日付判定をJST基準に変更。結果レスポンスに `horse_id` も含めるよう変更した。
- **変更ファイル**: `frontend/scripts/agents/agent_editor.ts`, `backend/scripts/sns_poster.py`, `backend/crud/race_crud.py`, `backend/routers/races.py`, `backend/schemas/race_schema.py`, `AGENTS.md`
- **確認事項**: `npm run article:validate-links` は74記事チェックで成功。`python -m py_compile backend\scripts\sns_poster.py backend\crud\race_crud.py backend\routers\races.py backend\schemas\race_schema.py` は成功。`npm run build` は成功し、静的ページ数は143件。`git diff --check` は成功。補助確認として `npx --yes tsx -e ...` と `npm exec -- tsc ...` を試したが、サンドボックス内のnpmキャッシュ/ネットワーク権限およびローカルパス解決権限で失敗したため、個別のtsx/tsc実行確認は未完了。`npm run build` では既存の `caniuse-lite` 更新推奨と静的生成ワーカー再起動警告が表示されたが、終了コードは0。
- **次のステップ**: 次回の `article:publish` と朝SNS投稿のGitHub Actionsで、記事公開がロールバックされないこと、朝投稿の本命馬成績が実レース数つきで出ることを確認する。

#### ✅ データ系ページヘッダー調整: ダーク背景の撤去
- **完了日時**: 2026-05-22 23:23
- **実施内容**: `データの見方` と `AI予想成績`、およびデータの見方配下の3ページで、ページ上部が濃紺のダーク系ヒーローになっていたため白ベースへ変更。濃紺背景、白文字、暗い補助パネルを撤去し、白背景、薄い罫線、アンバーの上線、淡いグレーの補助カードで構成。情報密度とアクセントは残しつつ、他ページと馴染む明るいトンマナへ調整した。
- **変更ファイル**: `frontend/app/keiba-data/page.tsx`, `frontend/app/results/accuracy/page.tsx`, `frontend/app/keiba-data/site-selection/page.tsx`, `frontend/app/keiba-data/track-condition/page.tsx`, `frontend/app/keiba-data/horse-weight/page.tsx`, `AGENTS.md`
- **確認事項**: `npm run build` は成功し、静的ページ数は139件。`npm run article:validate-links` はサンドボックス内のnpmキャッシュ書き込み権限で一度失敗したが、権限付き再実行で70記事チェック成功。ローカル開発サーバーで `/keiba-data`, `/results/accuracy?days=90`, `/keiba-data/track-condition` がHTTP 200を返すことを確認。ブラウザでデスクトップ表示を確認し、ページ上部が白基調になっていることを確認。確認用の開発サーバーは停止済み。`npm run build` では `caniuse-lite` 更新推奨の警告のみ表示。
- **次のステップ**: 本番反映後に、主要ページのファーストビューが白基調で統一されているかを実機で確認する。

#### ✅ データの見方サブページUIトンマナ統一: site-selection, track-condition, horse-weight
- **完了日時**: 2026-05-22 23:15
- **実施内容**: データの見方（`/keiba-data`）配下の3つのサブページ（`site-selection`, `track-condition`, `horse-weight`）のデザインシステム乖離を解消。ヒーローセクションの角丸を `rounded-md` から `rounded-2xl` へ統一し、背景色を `bg-slate-950` に、バッジを英字から日本語（「予想サイト選びの視点」「馬場の読み方」「馬体重の読み方」）に更新、さらに上部にアクセント線（`absolute h-1 bg-accent`）を追加。カードは `border-t-4` による上辺装飾を廃止し、親ページと同様のスタイリッシュなアクセントバーをカード内に配置する構成に変更、角丸を `rounded-2xl` に統一。リストやボタンの角丸も `rounded-xl` に揃え、手順リストは `POINT 1` 等から `01` 等のモノスペース数字へ統一。
- **変更ファイル**: `frontend/app/keiba-data/site-selection/page.tsx`, `frontend/app/keiba-data/track-condition/page.tsx`, `frontend/app/keiba-data/horse-weight/page.tsx`, `AGENTS.md`
- **確認事項**: `npm run build` はエラーなく成功。`rounded-md` および `border-t-4` が対象ファイルから完全に排除されていることを確認。
- **次のステップ**: 本番デプロイ後にこれらのサブページのインデックス状況や表示速度を確認する。

#### ✅ データ導線UI再設計: データの見方・AI予想成績のトンマナ統一
- **完了日時**: 2026-05-22 22:57
- **実施内容**: `/keiba-data` と `/results/accuracy` が、トップページや記事一覧と比べて説明書風でシンプルに見えすぎていたため、情報設計から再整理。`/keiba-data` は「レース前の確認順」を中心に、濃紺ヒーロー、3つの利用前提、ミニ指標、4手順カード、データ別カード、コース・騎手カードを追加し、単なるリンク集ではなく実際の予想前フローが見える画面へ変更。`/results/accuracy` は、期間切替、主要成績、条件別傾向、扱いに注意したい条件、評価が届かなかったレース、公開方針を同じ角丸カードとバー表現で揃え、数字の羅列ではなく「どこまで信じるか」を判断できる構成へ調整。補助ラベルは英字を避け、日本語の自然な表現に寄せた。
- **変更ファイル**: `frontend/app/keiba-data/page.tsx`, `frontend/app/results/accuracy/page.tsx`, `AGENTS.md`
- **確認事項**: `npm run build` は成功し、静的ページ数は138件。`npm run article:validate-links` は69記事チェックで成功。ローカル開発サーバーで `/keiba-data` と `/results/accuracy?days=90` がHTTP 200を返すことを確認し、ブラウザでデスクトップと390px幅モバイルのファーストビューを確認。対象2ファイルに `RACE NOTE`, `AI RECORD`, `VIEW RANGE`, `CHECK ORDER`, `CHECK FLOW`, `DATA GUIDE`, `SUMMARY`, `CAUTION`, `MISSES`, `HOW TO READ`, `POLICY`, `rounded-md`, `border-t-4` が残っていないことを確認。ブラウザログでは既存のAdSense/gtag系script hydration warningが出ているが、今回変更した2ページ固有の表示崩れやコンパイルエラーはなし。確認用の開発サーバーは停止済み。`npm run build` では `caniuse-lite` 更新推奨の警告のみ表示。
- **次のステップ**: 実データが返る本番環境で `/results/accuracy` の主要成績、条件別傾向、未達レースがバー表示とカード内で詰まらないかを確認し、Search Consoleで `/keiba-data` と `/results/accuracy` のCTR、滞在、内部遷移を2週間単位で見る。

#### ✅ UIトンマナ再調整: データ導線の色使い・文言・見せ方改善
- **完了日時**: 2026-05-22 00:55
- **実施内容**: 前回の文言整理後に、固定ページの見た目が白背景と薄い罫線に寄りすぎ、UMA-FREE本来の濃紺・アンバーを軸にした競馬分析サイトらしさが弱くなっていたため再調整。ナビと主要導線は「分析ガイド」「予測成績」から、ユーザーの行動に近い「データの見方」「AI予想成績」へ変更。`/keiba-data` は濃紺のヒーロー、当日確認順、色付きカードで「出走表を見る前にどう判断するか」が伝わる構成へ変更。`/results/accuracy` は「AI予想の成績」として、良い数字だけでなく「評価が届かなかったレース」「扱いに注意したい条件」を見るページに調整。`/keiba-data/site-selection`, `/keiba-data/track-condition`, `/keiba-data/horse-weight` も同じ濃紺ヘッダー、アンバー/ブルー/グリーンの控えめなアクセント、影付きカードに揃え、説明書のような硬い文言をレース前の実用文へ寄せた。
- **変更ファイル**: `frontend/lib/growth-content.ts`, `frontend/components/Header.tsx`, `frontend/components/Footer.tsx`, `frontend/components/Breadcrumb.tsx`, `frontend/app/page.tsx`, `frontend/app/keiba-data/page.tsx`, `frontend/app/keiba-data/site-selection/page.tsx`, `frontend/app/keiba-data/track-condition/page.tsx`, `frontend/app/keiba-data/horse-weight/page.tsx`, `frontend/app/results/accuracy/page.tsx`, `frontend/app/search/page.tsx`, `frontend/app/grade-races/[slug]/page.tsx`, `frontend/app/robots.ts`, `AGENTS.md`
- **確認事項**: `npm run build` は成功し、静的ページ数は138件。主要表示コードで `競馬分析ガイド`, `予測成績`, `AI予測の成績`, `結果とずれた`, `慎重に見る条件`, `集計待ち`, `データ辞典`, `検証ページ` が残っていないことを確認。`npm run article:validate-links` はサンドボックス内の npm キャッシュ書き込み権限で失敗し、権限付き再実行は利用上限により許可されなかったため未完了。ローカル開発サーバーも同じ環境制約で起動できず、今回のブラウザ実画面確認は未実施。`npm run build` では `caniuse-lite` 更新推奨の警告のみ表示。
- **次のステップ**: 利用上限解除後に `npm run article:validate-links` とローカルブラウザ確認を再実行し、`/keiba-data`, `/results/accuracy`, `/keiba-data/site-selection`, `/keiba-data/track-condition`, `/keiba-data/horse-weight` のファーストビューとモバイル表示を確認する。

#### ✅ UI文言統一: 分析ガイド・予測成績への整理
- **完了日時**: 2026-05-22 00:32
- **実施内容**: サイト内で浮いていた「データ辞典」「AI偏差値の検証」などの開発者目線の呼び方を整理し、主要導線を「分析ガイド」「予測成績」に統一。`/keiba-data` は辞典風の一覧ではなく、レース前に見る順番を示す分析ガイドへ本文を調整。`/results/accuracy` は検証ページではなく、AI予測の成績と振り返りとして「上位評価馬の結果」「条件別の傾向」「結果とずれたレース」を確認する構成に変更。ナビ、フッター、パンくず、検索、トップページ、重賞ページCTA、サイト選びページの文言も同じトーンに揃えた。前回の補助UIに残っていた英字ラベルや強い表現も、日本語の落ち着いた補助文へ調整した。
- **変更ファイル**: `frontend/lib/growth-content.ts`, `frontend/components/Header.tsx`, `frontend/components/Footer.tsx`, `frontend/components/Breadcrumb.tsx`, `frontend/app/page.tsx`, `frontend/app/keiba-data/page.tsx`, `frontend/app/keiba-data/site-selection/page.tsx`, `frontend/app/results/accuracy/page.tsx`, `frontend/app/search/page.tsx`, `frontend/app/grade-races/[slug]/page.tsx`, `frontend/components/RacePageClient.tsx`, `frontend/components/RaceDayDashboard.tsx`, `frontend/components/ArticleIntentPanel.tsx`, `frontend/app/articles/[slug]/page.tsx`, `frontend/app/robots.ts`, `AGENTS.md`
- **確認事項**: 旧表示語の検索で `データ辞典`, `AI偏差値の検証`, `検証ページ`, `TODAY MEMO`, `馬券力UP`, `確認ポイントを開く`, `目次を開く`, `弱い条件` が主要フロントエンド表示コードに残っていないことを確認。`npm run build` は成功し、静的ページ数は138件。`npm run article:validate-links` は69記事チェックで成功。ブラウザ確認では `/keiba-data`, `/results/accuracy?days=90`, `/keiba-data/site-selection` の見出し、パンくず、本文で「分析ガイド」「予測成績」へ統一され、旧称が表示されないことを確認。確認用の開発サーバーは停止済み。`npm run build` では `caniuse-lite` 更新推奨の警告のみ表示。
- **次のステップ**: 本番反映後に、Search Consoleで新しい表示名のクリック率と検索クエリを確認し、「分析ガイド」「予測成績」が自然に受け入れられているかを2週間単位で見る。

#### ✅ UI視認性改善: 追加導線の折りたたみ化・表示密度調整
- **完了日時**: 2026-05-22 00:05
- **実施内容**: 前回追加した競合対策UIが、レースページと記事ページの主コンテンツより強く見えていたため、情報量を抑える方向で修正。`RaceDayDashboard` は大きなカード型ダッシュボードをやめ、初期表示では1行程度の「当日の見どころ」と「まず確認」レースだけを見せる折りたたみUIへ変更。開いた場合も、黒背景カードや大きな説明文ではなく、3列の小さな一覧で「まず確認」「混戦注意」「偏差値上位」を確認する構成にした。記事ページでは、記事意図パネルを小さな白背景の補助枠に変更し、確認ポイントは折りたたみ化。H2目次も大きなボックス表示をやめ、初期表示では「本文の流れを見る」だけの折りたたみUIに変更した。
- **変更ファイル**: `frontend/components/RaceDayDashboard.tsx`, `frontend/components/ArticleIntentPanel.tsx`, `frontend/app/articles/[slug]/page.tsx`, `AGENTS.md`
- **確認事項**: `npm run build` は成功。`npm run article:validate-links` は69記事チェックで成功。ブラウザ確認では、記事ページに「読み方のポイントを見る」と「本文の流れを見る」が表示され、旧来の大きな `この記事の流れ` 表示が出ていないことを確認。レースページでは「当日の見どころ」のコンパクト表示になり、旧来の `今日見るべきレースの整理` の大きな見出しが出ていないこと、予想エリアへ進めることを確認。確認用の開発サーバーは停止済み。`npm run build` では `caniuse-lite` 更新推奨の警告のみ表示。
- **次のステップ**: 本番反映後に、レースページのファーストビュー、記事ページの読了率、検索から記事・レースへの遷移率を確認し、補助UIがクリックされていない場合はさらに下部配置へ移動する。

#### ✅ 競合比アクセス改善: 当日ダッシュボード・検索復旧・データ入口拡張
- **完了日時**: 2026-05-21 23:32
- **実施内容**: 競合サイトとの差を、検索入口、当日再訪理由、検証透明性、データベース感、記事からレースページへの回遊に分解して改修。レースページには全開催を横断して「まず確認」「混戦注意」「AI偏差値上位馬」を整理する当日ダッシュボードを追加し、ユーザーが全レースを見比べる前に確認順を決められる構成へ変更。サイト内検索は存在しないバックエンド記事API依存を撤去し、Next.js側の静的インデックスで記事、固定ページ、コース、騎手、重賞を横断検索できるよう修正。記事詳細には著者・更新日、記事意図パネル、H2目次を追加し、読後に本日のAI予想や同カテゴリ記事へ戻りやすくした。AI偏差値検証ページは7日、30日、90日、180日の切替と期間比較、弱い条件の表示を追加。データハブには当日の予想で使う順番を追加し、騎手データを13名、コースデータを19ページ、重賞個別ページを8ページへ拡張した。構造化データは記事スキーマを `Article` に見直し、`SoftwareApplication` の `url` 表記も修正。
- **変更ファイル**: `frontend/components/RaceDayDashboard.tsx`, `frontend/components/RacePageClient.tsx`, `frontend/app/search/page.tsx`, `frontend/app/search/SearchPageClient.tsx`, `frontend/app/articles/[slug]/page.tsx`, `frontend/components/StructuredData.tsx`, `frontend/app/results/accuracy/page.tsx`, `frontend/app/keiba-data/page.tsx`, `frontend/lib/growth-content.ts`, `frontend/lib/grade-race-content.ts`, `AGENTS.md`
- **確認事項**: `npm run build` は成功し、静的ページ数は138件まで増加。`/courses/[venue]/[course]` は19ページ、`/jockeys/[slug]` は13ページ、`/grade-races/[slug]` は8ページ生成。`npm run article:validate-links` は69記事チェックで成功。ブラウザ確認では `/search?q=ルメール` がローカル検索インデックスから結果を返し、`/courses/tokyo/turf-1600m` と `/results/accuracy?days=90` の主要導線表示を確認。`npm run build` では `caniuse-lite` 更新推奨の警告のみ表示。
- **次のステップ**: デプロイ後にSearch Consoleで新規コース、騎手、重賞ページのインデックス登録を確認し、検索クエリ別に「騎手名 得意コース」「競馬場 距離 枠順」「重賞名 予想」の表示回数とCTRを2週間単位で追う。バックエンドの精度APIが本番で返る状態で `/results/accuracy` の期間比較が実測値に切り替わることも確認する。

#### ✅ 残タスク実施: 全記事信頼補強・重賞個別ハブ・検証API・X導線
- **完了日時**: 2026-05-21 03:35
- **実施内容**: 未完了だった低CTR記事追加対策、記事の信頼補強、重賞個別ページ、レース後回顧テンプレート、AI偏差値の実測検証、X投稿導線、旧URL追加リダイレクトを実装。全67記事に `この記事で扱う集計条件` を追加し、Search ConsoleでCTR改善余地が大きい馬場状態、馬体重、枠順、距離適性、血統記事のtitle/descriptionを検索意図寄りに更新。断定的・煽りの強い表現も一括で自然な表現へ調整した。重賞ハブは `/grade-races/2026-nihon-derby`, `/grade-races/2026-yasuda-kinen`, `/grade-races/2026-takarazuka-kinen` を追加し、7日前、枠順確定後、レース後回顧の3段階で使える構成にした。`/results/accuracy` はバックエンドの新API `/api/v1/predictions/stats/accuracy` からAI偏差値上位馬の勝率・複勝率、条件別傾向、外れたレースを表示する構成へ変更。X投稿は重賞個別ページから該当ページへ直接送る投稿導線を追加した。
- **変更ファイル**: `frontend/content/articles/*.md`, `frontend/scripts/agents/apply_remaining_growth_fixes.js`, `frontend/lib/grade-race-content.ts`, `frontend/app/grade-races/page.tsx`, `frontend/app/grade-races/[slug]/page.tsx`, `frontend/content/templates/grade-race-recap-template.md`, `frontend/app/results/accuracy/page.tsx`, `frontend/lib/api.ts`, `frontend/lib/types.ts`, `backend/api/v1/endpoints/races.py`, `backend/crud/race_crud.py`, `backend/schemas/race_schema.py`, `frontend/app/sitemap.ts`, `frontend/components/Breadcrumb.tsx`, `frontend/middleware.ts`
- **確認事項**: `npm run article:validate-links` は67記事チェックで成功。`python -m py_compile backend/api/v1/endpoints/races.py backend/crud/race_crud.py backend/schemas/race_schema.py` は成功。`npm run build` は成功し、静的ページ数は111件まで増加。`/grade-races/[slug]` は3ページ生成された。`npm run build` では `caniuse-lite` 更新推奨の警告のみ表示。
- **次のステップ**: フロントエンドとバックエンドを同時にデプロイし、`/results/accuracy` が新APIから実測値を取得できること、旧URLが301されること、重賞個別ページのSearch Console登録状況を確認する。

#### ✅ レースURL安定パス化・旧クエリURL301統合・index制御
- **完了日時**: 2026-05-21 02:45
- **実施内容**: レース詳細URLを `/races/YYYY-MM-DD/venue-slug/raceNumber` の安定パスへ移行する基盤を実装。旧来の `/races/YYYY-MM-DD?race=11&venue=東京` や `?venue=東京&race=11` はミドルウェアで301リダイレクトし、venueのみ・raceのみ・余分なクエリは日付ページへ集約するよう整理した。レース詳細用の新規動的ルートを追加し、個別レースのtitle、description、canonical、SportsEvent JSON-LDを安定パスで出力。古いレースアーカイブは `noindex,follow`、直近14日から未来2日までのレースと重賞はindex対象にする共通判定を追加。トップページ、AI注目馬、高配当的中ランキング、今週の重賞、レース内切替、前回見ていたレース保存URLも安定パスへ更新。サイトマップはクエリ付きURLを掲載せず、直近・重賞系の安定パスだけを出す方針に変更した。
- **変更ファイル**: `frontend/lib/race-url.ts`, `frontend/middleware.ts`, `frontend/app/races/[date]/[venue]/[race]/page.tsx`, `frontend/app/races/[date]/page.tsx`, `frontend/app/sitemap.ts`, `frontend/app/robots.ts`, `frontend/public/robots.txt`, `frontend/app/page.tsx`, `frontend/components/RacePageClient.tsx`, `frontend/components/RaceTabs.tsx`, `frontend/components/TopHitsDisplay.tsx`, `frontend/components/SpecialPickCard.tsx`, `frontend/components/WeeklyGradeRaces.tsx`, `frontend/scripts/agents/validate_article_links.js`, `frontend/scripts/agents/seo_checker.ts`, `frontend/scripts/agents/agent_editor.ts`
- **確認事項**: `npm run article:validate-links` は67記事チェックで成功。`npm run build` は成功し、`/races/[date]/[venue]/[race]` がDynamic routeとして追加されたことを確認。`npm run build` では `caniuse-lite` 更新推奨の警告のみ表示。
- **次のステップ**: デプロイ後に旧クエリURL数本で301先を確認し、Search Consoleで「リダイレクト エラー」「Googleにより正規ページとして選択されていません」「クロール済み - インデックス未登録」の推移を見る。

#### ✅ 検索流入改善のためのデータハブ・騎手別・コース別ページ整備
- **完了日時**: 2026-05-21 02:05
- **実施内容**: 競合比でアクセス数が伸びにくい要因を、検索意図の受け皿不足、レース詳細URLの重複、内部導線の弱さ、既存記事の汎用クエリ対応不足に分解して改善。新規に `競馬データ辞典`、馬場状態・馬体重・サイト選びの解説ページ、騎手別データ、コース別データ、重賞入口、AI偏差値の検証ページを追加し、トップページ・ヘッダー・フッター・パンくずから回遊できるようにした。記事側は馬場状態、馬体重、中山ダート1200m、天皇賞秋、ルメール騎手、武豊騎手、川田将雅騎手の記事を検索意図に合わせて調整し、関連する新規ページへの内部リンクを追加。サイトマップは記事専用XMLを追加し、レース詳細のクエリURLは日付ページへ正規化する方針へ整理した。
- **変更ファイル**: `frontend/lib/growth-content.ts`, `frontend/app/keiba-data/`, `frontend/app/jockeys/`, `frontend/app/courses/`, `frontend/app/results/accuracy/page.tsx`, `frontend/app/grade-races/page.tsx`, `frontend/app/sitemap-articles.xml/route.ts`, `frontend/app/page.tsx`, `frontend/app/sitemap.ts`, `frontend/app/robots.ts`, `frontend/app/races/[date]/page.tsx`, `frontend/components/Header.tsx`, `frontend/components/Footer.tsx`, `frontend/components/Breadcrumb.tsx`, `frontend/middleware.ts`, `frontend/next.config.mjs`, `frontend/public/robots.txt`, `frontend/scripts/agents/validate_article_links.js`, `frontend/content/articles/2025-10-26-ground-condition-impact.md`, `frontend/content/articles/2025-11-11-weight-change-impact-analysis.md`, `frontend/content/articles/2025-10-04-nakayama-dirt-1200m-data-analysis.md`, `frontend/content/articles/2025-10-27-tennosho-autumn-tokyo-turf-2000m-analysis.md`, `frontend/content/articles/2025-10-06-christophe-lemaire-data-analysis.md`, `frontend/content/articles/2025-10-07-yutaka-take-data-analysis.md`, `frontend/content/articles/2025-10-13-yuga-kawada-jockey-analysis.md`
- **確認事項**: `npm run article:validate-links` は67記事チェックで成功。`npm run build` は成功し、静的ページ数は108件まで増加。`git diff --check` はLF/CRLF警告のみでエラーなし。`npm run build` では `caniuse-lite` 更新推奨の警告のみ表示。
- **次のステップ**: デプロイ後にSearch Consoleで `sitemap.xml` と `sitemap-articles.xml` を送信し、インデックス登録、PC検索CTR、馬場状態・馬体重・コース名・騎手名系クエリの表示回数を2週間単位で確認する。

#### ✅ AdSense Offerwall公開・リワード広告導線の有効化
- **完了日時**: 2026-05-19 09:37
- **実施内容**: AdSense管理画面の `プライバシーとメッセージ > Offerwall` で既存下書き `UmaFree Premium Offerwall` を確認し、ユーザー承認後に公開。サイトは `uma-free.com`、言語は日本語、リワード広告はオン、メール収集はオフ、閉じるオプションはオフ、オファーウォール最適化はオン。表示文言は「詳細データをみるには」「このレースの詳細データを閲覧するには短い動画広告をご視聴ください。」で、視聴後のアクセス権は「24時間、サイト全体にアクセスできます」。公開確認ダイアログでは、AdSenseタグ経由で自動公開され、サイト表示まで1時間ほどかかる場合があることを確認。
- **変更ファイル**: `AGENTS.md`
- **確認事項**: Offerwall一覧でステータスが `公開済み`、公開トグルがオン、最終更新日が `2026/05/19` になっていることを確認。サイト側は `frontend/app/layout.tsx` に `ca-pub-4411270831448240` のAdSenseタグが実装済み。
- **次のステップ**: 1時間後を目安に本番 `uma-free.com` のレース詳細ページでOfferwall表示を実機確認し、AdSenseの `メッセージが表示された回数` と `リワード広告収入`、GA4の詳細分析閲覧イベントを突き合わせる。
- **追加対応**: 2026-05-19 12:16 に、Rewarded広告が使えない場合でも通常のAdSense広告枠は従来通り流れる構成を維持したまま、詳細分析ゲート下の「広告視聴が完了すると…」「広告を準備できない場合は…」という補足文を削除。`npm run build` と `git diff --check` は成功。
- **追加確認**: 2026-05-20 16:12 に、本番トップページでAdSenseタグ、広告iframe、`ins.adsbygoogle` が出ていることを確認。AdSense Offerwall管理画面では `メッセージが表示された回数 12`、`リワード広告収入 ¥4` を確認したため、Offerwall自体は一部セッションで配信済みと判断。ページ包含条件は `uma-free.com/races` 配下のみで、トップページ・記事ページは対象外。通常AdSenseについては、広告応答が3秒以内に返らない場合にコード側で自前の `unfilled` を付けて枠を畳む実装があり、遅延応答の広告まで非表示にする恐れがあったため、`frontend/components/Adsense.tsx` で自前 `unfilled` 付与を撤去し、Googleが付与したステータスのみを信頼するよう修正。さらに本番検証で `data-ad-status="unfill-optimized"` を確認したため、`AdUnit`, `InFeedAd`, `NativeCardAd`, `MobileStickyAd` でも `unfill-*` 系ステータスを空枠扱いにして、未配信広告枠が画面に残らないよう調整。`npm run build` と `git diff --check` は成功。

#### ✅ GAM Rewarded Ad可否確認・詳細分析ゲート計測強化
- **完了日時**: 2026-05-19 07:54
- **実施内容**: GAM管理画面で `uma-free-rewarded-premium` 広告ユニットと `UMA-FREE リワード Line Item` を確認。Rewarded用のページ外広告ユニットは有効で、リワード設定も存在する一方、広告申込情報は下書き、クリエイティブ未設定、`Ad Exchange` タイプが選択肢に出ていないため、現状ではGoogle需要を使った収益配信可能な状態ではないと判断。コード側では通常AdSenseを7秒表示する疑似リワード導線を撤去し、GAM Rewarded Adが使える場合は広告完了後に詳細分析を解放、在庫なし・非対応・タイムアウト時はユーザーを止めずに直接表示するfallbackへ変更。GA4にはゲート表示、クリック、広告準備完了、広告要求、広告開始、報酬付与、広告終了、利用不可、fallback利用、詳細分析閲覧の各イベントを送信するようにした。
- **追加確認**: GAMの `リンクされたアカウント` はGA4プロパティのみ表示。`高度な機能` は表示できるデータなし。`ネットワーク設定` はリワード基本設定とAdSense未販売枠補完が有効。`価格設定ルール` は有効ルール0件。`保護` は有効ルール0件で、Rewarded Web要件に関係する非インストリーム動画広告ブロックが有効になっている状態は確認されなかった。管理画面検索でも `Ad Exchange` に直接該当する管理項目は表示されなかった。
- **変更ファイル**: `frontend/lib/analytics.ts`, `frontend/hooks/useRewardedAd.ts`, `frontend/components/RaceTabs.tsx`, `AGENTS.md`
- **確認事項**: `npm run build` 成功。`git diff --check` はCRLF警告のみでエラーなし。GAM管理画面では保存・有効化・クリエイティブ追加など配信に影響する操作は未実施。
- **次のステップ**: GAMで収益化を続ける場合はAd Exchange利用可否をGoogle側で確認し、利用可能になってからRewarded用の正規需要を紐づける。すぐ収益化を優先する場合は、AdSense Offerwallのリワード広告導線を検討する。
- **追加対応**: 2026-05-20 16:22 に、本番 `?fc=alwaysshow&fctype=monetization` 確認で「詳細分析を表示」押下時に白紙広告のまま即時開放される挙動を確認。原因はAdSense Offerwallではなく、GAM Rewardedが未準備・未配信のときにコード側で詳細分析を直接開放するfallbackだったため、`RaceTabs.tsx` から未配信時の直接開放を撤去。今後はGAM Rewardedが利用可能かつ準備完了した場合だけ押下でき、実際の報酬付与イベント後に詳細分析を開放する。未配信時は `reward_ad_unavailable` を計測し、ボタンは `広告を準備中` のままにする。通常AdSense広告は通常枠として維持し、疑似リワード用途には使わない方針にした。
- **追加対応**: 2026-05-20 18:17 に、上記修正後の本番で `広告を準備中` が30秒以上続き操作不能になる問題を確認。GPTスクリプトがブロック・遅延した場合にタイムアウト処理自体が実行されない構造だったため、`useRewardedAd.ts` でGPTキュー外にも10秒の安全タイムアウトを追加。Rewardedが使える場合は従来通り広告完了後に開放し、10秒待っても準備できない場合は通常の `詳細分析を表示` ボタンに戻してレース単位で開放する。通常AdSenseは通常広告枠として維持し、GA4には `reward_ad_unavailable` と `reward_fallback_used` を分けて記録する。`npm run build` は成功。
- **追加確認**: 2026-05-20 18:27 に、デプロイ後の本番で `詳細分析を表示` ボタンが有効化され、押下後に脚質予測・枠順傾向・対戦成績・AI分析が表示されることを確認。`fc=alwaysshow&fctype=monetization` はOfferwall表示テスト用パラメータであり、通常訪問とは異なる確認条件。ライブDOMでは一部インフィード広告が `data-ad-status="unfill-optimized"` のまま空枠として残るケースを確認したため、`AdUnit`, `InFeedAd`, `NativeCardAd`, `MobileStickyAd` でMutationObserver開始前に既に付いた広告ステータスも即時・遅延再確認し、未配信広告枠を畳むよう補強。`npm run build` と `git diff --check` は成功。
- **追加対応**: 2026-05-20 18:43 に、デプロイ後もRewarded広告が表示されず、10秒後に通常開放されるだけの状態を再評価。公式仕様上、GAM Rewardedは `rewardedSlotReady` が発火した場合のみ表示可能で、AdSense OfferwallもRewarded在庫がない場合は表示されないため、現在はRewarded需要不足またはGAM側のAd Exchange/配信設定未成立が主因と判断。ユーザー待機による離脱を避けるため、`useRewardedAd.ts` の待機時間を10秒から5秒へ短縮し、空振り時は15分間セッション内で再待機しないキャッシュを追加。Rewardedが準備できた場合はキャッシュを解除し、従来通り広告完了後に開放する。`npm run build` は成功。
- **追加対応**: 2026-05-21 01:30 に、詳細分析内の `展開/脚質予測` と `このコースの枠順傾向` の縦サイズが馬数によって不揃いになる問題を修正。`StartPositionChart.tsx` は馬数から高さを算出する方式をやめ、モバイル180px・PC300pxの固定チャート高の中で馬マーカーを再配置。`HorseNumberAdvantageChart.tsx` と `RaceTabs.tsx` は同一グリッド行でカード内要素が伸びるよう `h-full` とflex構成を追加し、2つの分析カードの高さが揃うよう調整。通常AdSenseを7秒間の疑似Rewardedとして使う案は、AdSense通常在庫の事前時間表示・閲覧補償に該当する恐れがあるため採用しない判断。`npm run build` は成功。
- **追加対応**: 2026-05-21 01:34 に、通常AdSenseをRewarded扱いしないなら詳細分析の表示待ちは不要という判断に合わせ、`RaceTabs.tsx` の `広告を準備中` 待機表示とボタン無効化を撤去。GAM Rewardedはバックグラウンドで準備を続け、`rewardedSlotReady` 相当で利用可能になった場合のみ `広告を見て詳細分析を表示` として使う。未準備・loading中に押された場合は `reward_ad_unavailable` と `reward_fallback_used` を記録し、通常の `詳細分析を表示` として即時開放する。`npm run build` は成功。

#### ✅ ホーム画面の価値訴求・回遊導線・広告配置改善
- **完了日時**: 2026-05-17 22:23
- **実施内容**: ホーム上部を抽象的なヒーローから、今日のレースを入口にした分析ダッシュボードへ再構成。AI偏差値のミニ予想表、脚質予測・対戦成績・枠順傾向・AI分析のサンプルカード、本日の開催入口、前回見たレース復帰導線、注目馬、重賞導線を上部に集約。広告は価値を見せた直後の `home_after_value_preview` と高配当ランキング後に配置し、新規ユーザーの理解とリピーターの再訪導線を優先しつつViewableになりやすい構成へ変更。
- **変更ファイル**: `frontend/app/page.tsx`
- **確認事項**: `npm run build` 成功。`npm run article:validate-links` は主要変更後に成功し、最後の見出しタグ調整後の再実行は環境の権限申請上限で未実施。`git diff --check` は成功。ブラウザ確認はローカルプレビューURLが環境側のセキュリティポリシーでブロックされたため未実施。
- **次のステップ**: 本番プレビューまたは実機でファーストビューの見え方、広告配信時の余白、`home_after_value_preview` と `home_after_top_hits` のRPM/CTR/滞在影響をGA4とAdSenseで比較する。
- **追加対応**: 2026-05-18 00:18 に、ホーム上部の説明臭さを抑えるため、ヒーロー文と「Why UMA-FREE」説明セクションを撤去。ファーストビューは `本日の分析` の操作パネルへ変更し、「レースを開くと見られる分析」は `詳細分析メニュー` に改名。各サンプルカードの文言も「上位候補の差を見る」「前半の位置取りを見る」など操作語へ短縮。`npm run build`, `node -e "eval(require('fs').readFileSync('scripts/agents/validate_article_links.js','utf8'))"`, `git diff --check` は成功。
- **追加対応**: 2026-05-18 00:30 に、元サイトの表示・色合いから離れすぎていた白黒分割のファーストビューを撤去し、既存の濃紺フル幅ヒーロー、`venue-links`、高配当ランキング中心の構成へ戻した。`詳細分析メニュー` は通常の白カード群として下部に残し、追加価値だけを元のトンマナ内に収めた。`npm run build`, `node -e "eval(require('fs').readFileSync('scripts/agents/validate_article_links.js','utf8'))"`, `git diff --check` は成功。
- **追加対応**: 2026-05-18 00:42 に、価値訴求用のサンプルカード群は残したまま、見出しを `各レースで見られるデータ` に変更し、各カード文言も説明調から「評価差を確認」「位置取りをチェック」など自然な確認導線へ調整。初回広告 `home_after_value_preview` の直前へ移動し、新規ユーザーにサイト価値を見せてから広告が入る構成にした。`npm run build`, `node -e "eval(require('fs').readFileSync('scripts/agents/validate_article_links.js','utf8'))"`, `git diff --check` は成功。
- **追加対応**: 2026-05-18 01:02 に、ホーム本文の最上段を `高配当的中ランキング`、その直下を `前回見ていたレース` に並べ替え。レースデータカードは実データと誤認されないよう `レースデータの表示例` に変更し、各カードへ20文字前後の説明と `表示例` ラベルを追加した。`npm run build`, `git diff --check` は成功。
- **追加対応**: 2026-05-18 01:17 に、ファーストビューの最上段を既存ヒーロー（登録不要・完全無料 / AI競馬データ分析）へ戻し、その下に `高配当的中ランキング`、`前回見ていたレース` を配置。分析カードは `このサイトで見られる分析` に変更し、各文言から `表示例` の連呼を外して、AI偏差値・脚質予測・対戦成績・枠順傾向・AI分析という差別化要素が伝わる表現に調整。`npm run build`, ローカル表示確認, `git diff --check` は成功。

#### ✅ レース予想ページ中心のUI/UX統一・可変データ表示改善
- **完了日時**: 2026-05-17 19:41
- **実施内容**: PCで横幅を活用できるよう共通コンテナを拡張し、レース予想ページの予想表、指標解説、レース分析、注目馬、重賞導線、関連記事の表示密度を調整。スマホでは従来の読み順を保ちつつ、記事一覧の余白、予想表、指標解説、レース分析ブロックを圧縮。API由来の初期レースデータがクライアント再取得で「データなし」に上書きされる問題も修正し、ローカル確認用に `127.0.0.1:3000` のCORSを許可。
- **変更ファイル**: `backend/main.py`, `frontend/app/layout.tsx`, `frontend/app/articles/page.tsx`, `frontend/components/RacePageClient.tsx`, `frontend/components/RaceTabs.tsx`, `frontend/components/PredictionTable.tsx`, `frontend/components/TopHitsDisplay.tsx`, `frontend/components/WeeklyGradeRaces.tsx`, `frontend/components/DataExplanationPanel.tsx`, `frontend/components/RaceAnalysis.tsx`, `frontend/components/StartPositionChart.tsx`, `frontend/components/HorseNumberAdvantageChart.tsx`, `frontend/components/Footer.tsx`, `frontend/hooks/useMediaQuery.ts`
- **確認事項**: `npm run build`, `npm run article:validate-links`, `python -m py_compile backend/main.py`, `git diff --check` は成功。ブラウザで `/`, `/articles`, `/races/2026-05-18` をPC幅・スマホ幅で確認し、レース実データ表示、スマホ予想表、記事一覧の表示を確認。
- **次のステップ**: 実機または本番プレビューで広告配信時の余白、モバイル下部追従広告との干渉、レース詳細のロック解除後チャート表示を追加確認する。
- **追加対応**: 2026-05-17 22:04 に、右側サイドレールが唐突に見え、予想表の可読幅も削っていたため撤去。注目馬、今週の重賞、的中ランキング、日付移動、関連記事は本文の自然な読順へ戻し、PCでも主コンテンツを最大幅で読める構成に変更。`/races/2026-05-17` をPC幅・スマホ幅で確認し、右レールが出ないこと、実データが表示されることを確認。`npm run build`, `npm run article:validate-links`, `git diff --check` は成功。

#### ✅ データ実態に基づく予想ページ導線・広告配置改善
- **完了日時**: 2026-05-16 20:59
- **実施内容**: GA4のトラフィック獲得・維持率・ページ閲覧データ、Search Consoleデータ、GA4行動PDFをもとに、リピーターがレース予想を反復確認する利用実態に合わせて、前回見たレースへ戻る導線、レース閲覧イベント計測、広告配置ごとの詳細GA4計測、インフィード/ネイティブ広告のラベル・未配信処理を実装。レース予想表の前に出ていた広告は撤去し、予想確認後の自然な区切りに広告を集約。
- **変更ファイル**: `frontend/app/page.tsx`, `frontend/components/RacePageClient.tsx`, `frontend/components/RaceTabs.tsx`, `frontend/components/RecentRaceReturn.tsx`, `frontend/components/InFeedAd.tsx`, `frontend/components/NativeCardAd.tsx`, `frontend/components/AdUnit.tsx`, `frontend/components/TopHitsDisplay.tsx`, `frontend/lib/analytics.ts`, `frontend/lib/race-memory.ts`
- **確認事項**: `npm run build` は成功。`next lint` はESLint初期設定プロンプトで停止するため未実行。ローカルAPI未起動のため、レースデータ取得警告とレース詳細画面の実データ表示確認は未実施。
- **次のステップ**: GA4で `race_view_custom` と `ad_impression_custom` の配置別データを確認し、`race_after_prediction_table`, `race_premium_mid`, `race_after_data_explainer`, `race_after_top_hits` のRPM/CTR/滞在影響を比較する。

#### ✅ 記事自動生成パイプラインの復旧
- **完了日時**: 2026-05-16 21:57
- **実施内容**: ライター、エディター、SEOチェッカーの審査条件が互いに矛盾していた問題を整理。関連記事プレースホルダー要求を撤廃し、記事末尾の `/races/today` 導線と「このコースの買い目ポイント」見出しを正規ルールとして統一。Geminiモデル指定は実在性の低いpreview名の固定指定をやめ、安定モデル中心の共通設定に変更。記事生成失敗時にwrite_orderを無条件消費せず `failed/` に退避し、承認済み記事0件の実行失敗をCIで検知できるようにした。
- **変更ファイル**: `.github/workflows/keiba-article-pipeline.yml`, `frontend/package.json`, `frontend/scripts/agents/agent_writer.ts`, `frontend/scripts/agents/agent_editor.ts`, `frontend/scripts/agents/seo_checker.ts`, `frontend/scripts/agents/test_pipeline.ts`, `frontend/scripts/agents/model_tiers.ts`
- **確認事項**: `npm run build` は成功。初回ビルドは前回起動したNext dev serverが `.next/trace` を保持して失敗したため、該当dev serverのみ停止して再実行。ローカルではトップレベルのwrite_orderが無く、Gemini APIキーを使った記事生成本番実行は未実施。
- **次のステップ**: GitHub Actionsで `GEMINI_API_KEY` が設定済みか確認し、手動実行で `frontend/agents/queue/approved` に記事が入るか、また失敗時に `data/write_orders/failed` とActionsログへ原因が出るかを確認する。

#### ✅ Google AI Studio無料枠前提のGemini利用最適化
- **完了日時**: 2026-05-16 22:27
- **実施内容**: Google AI Studio無料枠ではレート制限がプロジェクト単位で効くため、記事生成とレース分析文生成をFlash-Lite優先に変更。記事生成は1日最大2本・10リクエストを既定値にし、使用回数を `data/gemini_usage` に記録するソフト上限を追加。レース分析文は1cronあたり最大8リクエスト・24レースに抑え、JRA・後半レース・頭数の多いレースを優先するようにした。非推奨期限が近い2.0/1.5系モデルは既定候補から除外。
- **変更ファイル**: `backend/scripts/llm_generator.py`, `render.yaml`, `.github/workflows/keiba-article-pipeline.yml`, `frontend/scripts/agents/gemini_quota.ts`, `frontend/scripts/agents/model_tiers.ts`, `frontend/scripts/agents/agent_writer.ts`, `frontend/scripts/agents/agent_editor.ts`, `frontend/scripts/agents/seo_checker.ts`, `frontend/scripts/agents/test_pipeline.ts`
- **確認事項**: `python -m py_compile backend/scripts/llm_generator.py` 成功。`npm run build` 成功。ローカルAPI未起動のため、ビルド時の予想API取得警告は継続。
- **次のステップ**: AI StudioのLimits画面で実際の `gemini-2.5-flash-lite` / `gemini-2.5-flash` のRPM・TPM・RPDを確認し、必要なら `GEMINI_RACE_ANALYSIS_REQUEST_LIMIT_PER_RUN` と `GEMINI_ARTICLE_DAILY_REQUEST_LIMIT` を実測値に合わせて調整する。
- **追加確認**: 2026-05-16 22:49 にGemini APIの429/quota/resource exhausted系エラーを再試行可能な一時停止として扱うよう追加修正。記事品質NGとしてwrite_orderを消費しないことを確認。`python -m py_compile backend/scripts/llm_generator.py` と `npm run build` は再度成功。

#### ✅ AI生成記事の自然化・回遊導線・流入改善
- **完了日時**: 2026-05-16 23:15
- **実施内容**: 公開記事一覧、既存Markdown、記事生成プロンプト、GSC/GA4データを確認し、重賞予想前の迷い・平場予想の短時間判断・レース直前の出馬表確認という読者心理に合わせて、記事一覧の目的別導線、記事詳細の使いどころパネル、見出しナビ、関連記事スコアリング、本文前広告の撤去、壊れた手動リンク片の表示除去を実装。CTRの低い既存記事のタイトル・descriptionを自然な検索意図に寄せ、最新重賞記事の煽り表現と壊れたリンクを修正。記事生成プロンプトとSEOチェッカーも「断定・煽り」より「確認順序・買う/見送る条件」を重視するルールへ更新。
- **変更ファイル**: `frontend/app/articles/page.tsx`, `frontend/app/articles/[slug]/page.tsx`, `frontend/components/ArticleIntentPanel.tsx`, `frontend/components/RelatedArticles.tsx`, `frontend/lib/articles.ts`, `frontend/lib/article-ux.ts`, `frontend/scripts/agents/agent_writer.ts`, `frontend/scripts/agents/agent_editor.ts`, `frontend/scripts/agents/seo_checker.ts`, `frontend/scripts/agents/test_seo_checker.ts`, `backend/scripts/agents/data_scientist.py`, `docs/system-documentation/13_記事生成AIトーンマナー定義書.md`, `frontend/content/articles/2026-05-14-niigata2026-ai.md`, `frontend/content/articles/2025-10-26-ground-condition-impact.md`, `frontend/content/articles/2025-11-11-weight-change-impact-analysis.md`, `frontend/content/articles/2025-10-04-nakayama-dirt-1200m-data-analysis.md`
- **確認事項**: `npm run build` 成功。`python -m py_compile backend/scripts/agents/data_scientist.py backend/scripts/agents/grade_race_writer.py` 成功。ローカルNext dev serverで `/articles` と `/articles/2026-05-14-niigata2026-ai` を確認し、目的別導線・使いどころパネル・見出しナビ・関連記事表示・壊れたリンク片の非表示を確認。ローカルAPI未起動のため、ビルド時の予想API取得警告は継続。
- **次のステップ**: Search Consoleで `馬場状態`, `馬体重`, `中山ダート1200m`, `騎手名 得意コース` 系のCTR推移を見て、表示回数が多くCTR 1%未満の記事から順にタイトル・descriptionを追加で調整する。
- **追加対応**: 2026-05-17 00:33 にSearch Consoleで表示回数がある低CTR記事を追加調整。`/articles` のtitle/description、初心者向け控除率記事、競馬用語記事、馬券券種記事、天皇賞秋データ、人気別成績、武豊・川田将雅の得意コース、調教師ランキングの記事について、検索語に近いtitle/descriptionへ変更し、「投資」「必勝」「圧倒的」など広告審査・信頼性の面で強すぎる表現を抑制。`npm run build` と `python -m py_compile backend/scripts/agents/data_scientist.py backend/scripts/agents/grade_race_writer.py` は成功。
- **追加確認**: 2026-05-17 00:40 に自動生成が再びAI的・煽り寄りの記事を作らないよう、ライター・エディターのプロンプト表現、Publisherのハブ記事テンプレート、データサイエンティストのテーマ生成文、13/14番ドキュメントを再点検。命令文の強い語感、手動関連記事要求、存在しないURL生成、断定・煽り語を抑え、買い目判断の条件整理と `/races/today` 導線を正規ルールとして統一。`npm run build` と `python -m py_compile backend/scripts/agents/data_scientist.py backend/scripts/agents/grade_race_writer.py` は成功。
- **追加確認**: 2026-05-17 00:47 に日次実行時の重複・上書きリスクを点検。承認済み記事が複数ある場合に1本しか公開されない問題、重賞の日本語レース名がslug生成で削られて衝突し得る問題、未公開draft履歴が次回生成候補を塞ぐ問題、同一実行内の同一keyword重複処理を修正。既存の重複draft履歴も整理し、記事生成workflowにconcurrencyを追加。`npm run build` と `python -m py_compile backend/scripts/agents/data_scientist.py backend/scripts/agents/grade_race_writer.py` は成功。
- **追加確認**: 2026-05-17 00:56 に既存67記事のMarkdownリンク、画像、frontmatter URLを全件検査。記事slug切れ・画像切れは0件だった一方、旧手動「関連記事」セクション50件と `uma-free.jp` のOGP URL 10件を検出したため、既存記事から手動関連記事を削除し、OGP URLを `uma-free.com` に統一。日次公開前に `npm run article:validate-links` が走る検査スクリプトを追加し、Publisherのコミット前検査、workflowの事前検査、SEOチェッカーのリンク規則にも反映。`npm run article:validate-links`, `npm run build`, `python -m py_compile backend/scripts/agents/data_scientist.py backend/scripts/agents/grade_race_writer.py`, `git diff --check` は成功。
- **追加対応**: 2026-05-17 02:27 に `/articles` と記事詳細のUIを再設計。目的別の説明付きタグ群、記事詳細の長い使いどころパネル、目次ブロックを撤去し、カテゴリ絞り込みとタイトル中心の一覧表示へ変更。過去対決成績は18頭でもPCで横スクロールに頼らない固定幅テーブルにし、スマホでは基準馬選択＋2列比較に変更。`npm run build`, `npm run article:validate-links`, `git diff --check` は成功。ローカルNextで `/articles` と `/articles/2026-05-14-niigata2026-ai` の表示を確認。
- **追加対応**: 2026-05-17 07:57 に既存記事64件の本文・title・descriptionを横断的に自然化。「投資」「期待値」「絶対」「圧倒」「最強」「必勝」「消去対象」など、広告審査や読者信頼の面で強すぎる表現を、オッズ妙味・購入候補・判断材料・評価を下げたい条件などの自然な競馬メディア表現へ置換。置換由来の不自然な接続も検査し、日次生成で再発しないよう `frontend/scripts/agents/validate_article_links.js` に文体ガードを追加。`npm run article:validate-links`, `npm run build`, `git diff --check` は成功。ローカルAPI未起動のため、ビルド時の予想API取得警告は継続。

-----

## 9\. ユーザーへの定期報告

### 各ステップ完了時の報告内容

1.  **完了報告**
       - 実施した内容の概要
       - 変更したファイルのリスト
       - 確認すべきポイント

2.  **進捗状況**
       - 現在のフェーズと完了率
       - KPIの現状値

3.  **次のステップ提案**
       - 推奨される次のステップ
       - その理由と期待効果

-----

## 10\. AdSense再申請の準備

### 再申請前チェックリスト

すべての項目を満たしてから再申請：

#### コンテンツ要件

  - [ ] 総ページ数50ページ以上
  - [ ] オリジナル記事40記事以上
  - [ ] 各記事2,000文字以上
  - [ ] 最新の記事投稿が1週間以内

#### 必須ページ要件

  - [ ] プライバシーポリシー（充実版）
  - [ ] 利用規約
  - [ ] お問い合わせフォーム（動作確認済み）
  - [ ] 運営者情報（詳細版）
  - [ ] 広告について
  - [ ] FAQページ

#### 技術要件

  - [ ] モバイルフレンドリーテスト合格
  - [ ] PageSpeed Insights モバイル85点以上
  - [ ] Core Web Vitals 全項目「良好」
  - [ ] 構造化データエラー0件
  - [ ] サイトマップ正常送信

#### ユーザーエクスペリエンス要件

  - [ ] サイト内導線の明確化
  - [ ] 関連記事機能の実装
  - [ ] パンくずリストの実装
  - [ ] 404ページのカスタマイズ
  - [ ] **AI的・機械的なUIや文言の排除**
  - [ ] **過度な絵文字装飾の排除**

#### トラフィック要件

  - [ ] 継続的なアクセス（1日50PV以上）
  - [ ] 自然検索流入の確認

### 推奨再申請タイミング

**最短**: 上記条件をすべて満たした2週間後
**推奨**: 上記条件をすべて満たした4週間後

-----

## 11\. 重要なリマインダー

### ユーザーへの確認事項

各ステップ実行時、以下を必ずユーザーに確認：

1.  **実装前**: 実装内容と変更ファイルの説明
2.  **実装中**: 進捗の可視化（TodoWrite活用）
3.  **実装後**: 動作確認の依頼と確認ポイント
4.  **完了後**: 進捗記録の更新報告

### Codexとしての行動指針

  - 仕様書から逸脱しない
  - 一度に複数ステップを進める場合は、ユーザーの明示的な許可を得る
  - 品質基準（特にセクション 7.3）を常に遵守
  - 進捗を透明に報告
  - 次のステップを常に提案

-----

## 12\. まとめ

このガイドに従って、段階的にAdSense審査合格を目指します。各ステップを確実に実行し、進捗を記録することで、目標達成への道筋が明確になります。

**成功への3つの鍵**:

1.  **段階的実行**: 焦らず、1ステップずつ確実に
2.  **品質重視**: 量だけでなく質にこだわる（特にAIらしさの排除）
3.  **継続的改善**: データに基づいて改善を繰り返す

それでは、ユーザーの指示に従って、AdSense審査合格プロジェクトを進めましょう！
