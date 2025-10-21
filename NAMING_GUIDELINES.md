# keiba_site_v1 命名規則ガイドライン

このドキュメントは、keiba_site_v1 プロジェクト全体で統一した命名規則を定義しています。

---

## 📋 目次

1. [フロントエンド（TypeScript/React）](#フロントエンドtypescriptreact)
2. [バックエンド（Python/FastAPI）](#バックエンドpythonfastapi)
3. [ファイル・アセット](#ファイルアセット)
4. [API エンドポイント](#apiエンドポイント)
5. [データベース・スキーマ](#データベーススキーマ)

---

## フロントエンド（TypeScript/React）

### コンポーネントファイル

```
命名規則: PascalCase（ファイル名）
形式: ComponentName.tsx または ComponentName.ts

例:
✓ PredictionTable.tsx
✓ RaceAnalysis.tsx
✓ MatchupTable.tsx
✓ Icons.tsx
✓ Adsense.tsx

不正例:
✗ predictionTable.tsx （小文字で始まる）
✗ icons.tsx （コンポーネント以外は使用禁止）
```

**例外:**
- ページコンポーネント：`page.tsx`（Next.js標準）
- クライアント専用ページ：`PageNameClient.tsx`

### インターフェース・型定義

```
命名規則: PascalCase（インターフェース・型）
ファイル: lib/types.ts に集約
プロパティ: camelCase

例:
interface RacePrediction {
  raceId: string
  raceName: string
  predictions: HorsePrediction[]
  matchup: MatchupData | null
}

interface HorsePrediction {
  horseId: string
  horseName: string
  horseNumber: number
  waku: number | null
  deviationScore: number | null
}
```

### ユーティリティ・ライブラリ

```
命名規則: camelCase（ファイル名）
形式: utilityName.ts

例:
✓ api.ts          （API呼び出し関数）
✓ utils.ts        （汎用ユーティリティ）
✓ articles.ts     （記事処理）
```

### ページ・ルート

```
命名規則: kebab-case（動的セグメント）+ page.tsx

例:
✓ app/page.tsx                    （ホーム）
✓ app/articles/page.tsx           （記事一覧）
✓ app/articles/[slug]/page.tsx    （記事詳細）
✓ app/races/[date]/page.tsx       （日付指定）
```

---

## バックエンド（Python/FastAPI）

### モジュール・ファイル

```
命名規則: snake_case
形式: module_name.py

例:
✓ database.py
✓ race_crud.py
✓ race_schema.py
✓ database_loader.py
```

### クラス

```
命名規則: PascalCase

例:
class Race
class Horse
class Jockey
class RacePrediction
class HorseNumberAdvantage
```

### 関数・メソッド

```
命名規則: snake_case

例:
def get_predictions_by_date()
def get_special_pick_for_date()
def get_filtered_matchups_for_race()
```

### 定数

```
命名規則: UPPER_SNAKE_CASE

例:
DB_URL = "postgresql://..."
CACHE_TTL = 3600
```

### デバッグ・ユーティリティスクリプト

```
命名規則: 接頭辞 + 説明

パターン:
- debug_*.py       （デバッグ用スクリプト）
- check_*.py       （検証・確認スクリプト）
- cleanup_*.py     （データ整理・修復）
- repair_*.py      （破損修復）

例:
✓ debug_api_data.py
✓ check_db.py
✓ cleanup_garbled_data.py
✓ repair_race_names.py
```

---

## ファイル・アセット

### 画像ファイル

```
命名規則: [category]-[identifier]-[type]-[spec].png
文字   : 英字小文字 + ハイフン区切り
エンコーディング: UTF-8（日本語は ALT テキストで提供）

形式: category-location-distance-analysis-type.png

例:
✓ course_nakayama_dirt_1200m_waku_rate.png
✓ course_tokyo_turf_2400m_leg_type_pie.png
✓ ground-analysis_nakayama_20241001-20250930_ground_condition_summary.png
✓ jockey-00666-popularity-summary.png
✓ grade-analysis_20241001-20250930_g1_radar.png

構成:
course-{venue}-{surface}-{distance}-{metric}.png
  venue: nakayama, kyoto, tokyo, hanshin, sapporo, kokura, niigata, fukushima
  surface: turf, dirt
  distance: 1000m, 1200m, 1600m, 1800m, 2000m, 2400m など
  metric: waku_rate, leg_type_pie, leg_type_rate など
```

### マークダウン記事

```
命名規則: YYYY-MM-DD-title-with-hyphens.md
形式: ISO 8601 日付 + ハイフン区切りタイトル
大文字・小文字: 小文字

例:
✓ 2025-10-04-nakayama-dirt-1200m-data-analysis.md
✓ 2025-10-11-umami-horse-strategy.md
✓ 2025-10-15-kyoto-turf-1800m-complete-guide.md

ファイル前置詞:
- すべて小文字で統一
- 日本語は含めない
```

---

## API エンドポイント

### エンドポイント命名

```
命名規則: RESTful + ハイフン区切り
複数形の使用
パスパラメータ: {id} 形式

例:
✓ GET /api/v1/predictions/{date}
✓ GET /api/v1/predictions/special-pick/{date}
✓ GET /api/v1/predictions/matchups/{raceId}
✓ GET /api/v1/predictions/hits/top-payouts

規則:
- リソース: 複数形（predictions, matchups, hits）
- サブリソース: ハイフン区切り（special-pick, top-payouts）
- 動的パラメータ: camelCase（{raceId}, {date}）
```

---

## データベース・スキーマ

### テーブル名

```
命名規則: snake_case（複数形）

例:
✓ races
✓ horses
✓ jockeys
✓ predictions
✓ race_results
```

### カラム名

```
命名規則: snake_case
外部キー: {table}_id 形式

例:
✓ race_id
✓ horse_name
✓ jockey_id
✓ deviation_score
✓ created_at
```

---

## 改善履歴

### 2025-10-21

**実施事項:**

1. **PredictuonTable.tsx のスペル修正**
   - 変更前: `PredictuonTable.tsx`
   - 変更後: `PredictionTable.tsx`
   - インポート元: `RaceTabs.tsx` を更新

2. **icons.tsx の大文字化**
   - 変更前: `icons.tsx`（小文字、命名規則違反）
   - 変更後: `Icons.tsx`（PascalCase）
   - 参照元: 5ファイルを更新
     - DetailedInfoTabs.tsx
     - Header.tsx
     - RaceTabs.tsx
     - SpecialPickCard.tsx
     - TopHitsDisplay.tsx

3. **画像ファイルの日本語リネーム**
   - リネーム対象: 24ファイル
   - 変更パターン:
     ```
     中山 → nakayama
     京都 → kyoto
     阪神 → hanshin
     札幌 → sapporo
     小倉 → kokura
     新潟 → niigata
     東京 → tokyo
     福島 → fukushima
     芝 → turf
     ダ → dirt
     ```
   - リネーム対象ファイル例:
     - `course_中山_ダ1200m_course_waku_rate.png` → `course_nakayama_dirt_1200m_course_waku_rate.png`
     - `ground-analysis_東京_20241001-20250930_ground_condition_summary.png` → `ground-analysis_tokyo_20241001-20250930_ground_condition_summary.png`

4. **マークダウン記事の画像パス更新**
   - 更新対象: 11ファイル
   - 旧パス → 新パス置換を実施

---

## 補足

### Google AdSense 対応

すべての命名規則は Google AdSense の要件を満たすよう設計されています：

- ✓ 言語混在がない（SEO改善）
- ✓ ファイルシステム互換性（URLエンコーディング問題回避）
- ✓ メンテナンス性向上（コード検索・自動化ツール対応）

---

## 参照

- Next.js 公式: https://nextjs.org/docs
- FastAPI スタイルガイド: https://pep8.org/
- REST API 設計: https://restfulapi.net/
