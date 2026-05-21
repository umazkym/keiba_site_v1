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

**最終更新**: 2026-05-19

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
