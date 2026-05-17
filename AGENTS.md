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

**最終更新**: 2026-05-17

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

#### ✅ ホーム画面の価値訴求・回遊導線・広告配置改善
- **完了日時**: 2026-05-17 22:23
- **実施内容**: ホーム上部を抽象的なヒーローから、今日のレースを入口にした分析ダッシュボードへ再構成。AI偏差値のミニ予想表、脚質予測・対戦成績・枠順傾向・AI分析のサンプルカード、本日の開催入口、前回見たレース復帰導線、注目馬、重賞導線を上部に集約。広告は価値を見せた直後の `home_after_value_preview` と高配当ランキング後に配置し、新規ユーザーの理解とリピーターの再訪導線を優先しつつViewableになりやすい構成へ変更。
- **変更ファイル**: `frontend/app/page.tsx`
- **確認事項**: `npm run build` 成功。`npm run article:validate-links` は主要変更後に成功し、最後の見出しタグ調整後の再実行は環境の権限申請上限で未実施。`git diff --check` は成功。ブラウザ確認はローカルプレビューURLが環境側のセキュリティポリシーでブロックされたため未実施。
- **次のステップ**: 本番プレビューまたは実機でファーストビューの見え方、広告配信時の余白、`home_after_value_preview` と `home_after_top_hits` のRPM/CTR/滞在影響をGA4とAdSenseで比較する。
- **追加対応**: 2026-05-18 00:18 に、ホーム上部の説明臭さを抑えるため、ヒーロー文と「Why UMA-FREE」説明セクションを撤去。ファーストビューは `本日の分析` の操作パネルへ変更し、「レースを開くと見られる分析」は `詳細分析メニュー` に改名。各サンプルカードの文言も「上位候補の差を見る」「前半の位置取りを見る」など操作語へ短縮。`npm run build`, `node -e "eval(require('fs').readFileSync('scripts/agents/validate_article_links.js','utf8'))"`, `git diff --check` は成功。
- **追加対応**: 2026-05-18 00:30 に、元サイトの表示・色合いから離れすぎていた白黒分割のファーストビューを撤去し、既存の濃紺フル幅ヒーロー、`venue-links`、高配当ランキング中心の構成へ戻した。`詳細分析メニュー` は通常の白カード群として下部に残し、追加価値だけを元のトンマナ内に収めた。`npm run build`, `node -e "eval(require('fs').readFileSync('scripts/agents/validate_article_links.js','utf8'))"`, `git diff --check` は成功。
- **追加対応**: 2026-05-18 00:42 に、価値訴求用のサンプルカード群は残したまま、見出しを `各レースで見られるデータ` に変更し、各カード文言も説明調から「評価差を確認」「位置取りをチェック」など自然な確認導線へ調整。初回広告 `home_after_value_preview` の直前へ移動し、新規ユーザーにサイト価値を見せてから広告が入る構成にした。`npm run build`, `node -e "eval(require('fs').readFileSync('scripts/agents/validate_article_links.js','utf8'))"`, `git diff --check` は成功。

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
