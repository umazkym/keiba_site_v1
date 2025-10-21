# keiba_site_v1 命名規則統一化 - 改善サマリー

**実施日:** 2025-10-21
**実施者:** Claude Code
**目的:** 画像・コンポーネント名称の統一化と Google AdSense 対応強化

---

## 📊 改善実績

### 1️⃣ コンポーネント命名の修正

#### PredictuonTable.tsx スペル間違い修正

| 項目 | 詳細 |
|------|------|
| **変更前** | `PredictuonTable.tsx` |
| **変更後** | `PredictionTable.tsx` |
| **影響范囲** | 1ファイル（RaceTabs.tsx） |
| **効果** | IDE検索・自動補完の改善 |

**修正ファイル:**
- ✓ `frontend/components/PredictionTable.tsx` （リネーム）
- ✓ `frontend/components/RaceTabs.tsx` （インポート文更新）

---

#### icons.tsx 命名規則統一

| 項目 | 詳細 |
|------|------|
| **変更前** | `icons.tsx` （小文字） |
| **変更後** | `Icons.tsx` （PascalCase） |
| **影響范囲** | 5ファイル |
| **効果** | React コンポーネント命名規則統一 |

**参照元ファイル更新:**
- ✓ `DetailedInfoTabs.tsx`
- ✓ `Header.tsx`
- ✓ `RaceTabs.tsx`
- ✓ `SpecialPickCard.tsx`
- ✓ `TopHitsDisplay.tsx`

---

### 2️⃣ 画像ファイルの日本語リネーム

#### リネーム統計

| カテゴリ | ファイル数 | ステータス |
|---------|-----------|-----------|
| **course_** | 18 | ✓ 完了 |
| **ground-analysis_** | 6 | ✓ 完了 |
| **合計** | **24** | **✓ 完了** |

#### リネームマッピング

**競馬場名:**
```
中山     → nakayama
京都     → kyoto
阪神     → hanshin
札幌     → sapporo
小倉     → kokura
新潟     → niigata
東京     → tokyo
福島     → fukushima
```

**コース種別:**
```
芝      → turf
ダ      → dirt
```

#### リネーム例

```
変更前: course_中山_ダ1200m_course_waku_rate.png
変更後: course_nakayama_dirt_1200m_course_waku_rate.png

変更前: ground-analysis_東京_20241001-20250930_ground_condition_summary.png
変更後: ground-analysis_tokyo_20241001-20250930_ground_condition_summary.png

変更前: course_京都_芝1800m_course_leg_type_pie.png
変更後: course_kyoto_turf_1800m_leg_type_pie.png
```

**リネーム対象ファイル一覧:**

**Course Analysis (18ファイル):**
- course_nakayama_dirt_1200m_*.png (2)
- course_tokyo_dirt_1600m_*.png (2)
- course_tokyo_turf_2400m_*.png (2)
- course_kyoto_turf_1800m_*.png (2)
- course_hanshin_turf_1600m_*.png (2)
- course_sapporo_turf_2000m_*.png (2)
- course_kokura_turf_1200m_*.png (2)
- course_niigata_turf_1000m_*.png (2)
- course_fukushima_turf_1800m_*.png (2)

**Ground Analysis (6ファイル):**
- ground-analysis_nakayama_20241001-20250930_*.png (3)
- ground-analysis_tokyo_20241001-20250930_*.png (3)

---

### 3️⃣ マークダウン記事の画像参照パス更新

#### 更新対象記事

| # | ファイル名 | 更新数 |
|---|-----------|-------|
| 1 | 2025-10-04-nakayama-dirt-1200m-data-analysis.md | 2 |
| 2 | 2025-10-04-seasonal-ground-analysis.md | 複数 |
| 3 | 2025-10-05-tokyo-turf-2400m-data-analysis.md | 複数 |
| 4 | 2025-10-09-hanshin-turf-1600m-data-analysis.md | 複数 |
| 5 | 2025-10-12-nakayama-ground-condition-analysis.md | 複数 |
| 6 | 2025-10-14-niigata-turf-1000m-straight-analysis.md | 複数 |
| 7 | 2025-10-15-kyoto-turf-1800m-complete-guide.md | 複数 |
| 8 | 2025-10-17-kokura-turf-1200m-summer-analysis.md | 複数 |
| 9 | 2025-10-17-tokyo-dirt-1600m-february-stakes.md | 複数 |
| 10 | 2025-10-18-sapporo-turf-2000m-data-analysis.md | 複数 |
| 11 | 2025-10-19-fukushima-turf-1800m-complete-guide.md | 複数 |

**合計: 11ファイル**

#### 更新方法

Bash `sed` コマンドで一括置換:
```bash
sed -i 's|course_中山_ダ1200m|course_nakayama_dirt_1200m|g' *.md
sed -i 's|ground-analysis_東京|ground-analysis_tokyo|g' *.md
```

---

## 🎯 改善の効果

### ✅ メンテナンス性の向上

| 観点 | 改善内容 |
|------|---------|
| **IDE検索** | `PredictionTable` で正確に検索可能 |
| **自動補完** | ファイル・コンポーネント名が正しく補完される |
| **Git履歴** | ファイル追跡が容易に |
| **参照管理** | 言語混在がないため自動ツール対応向上 |

### ✅ Google AdSense 対応強化

| 項目 | 効果 |
|------|------|
| **SEO** | URL整合性向上によるクローラー処理改善 |
| **信頼性** | ファイル名がプロフェッショナルに |
| **互換性** | URLエンコーディング問題を排除 |
| **ローカライズ** | 画像ALTテキストで日本語説明を提供 |

### ✅ プロジェクト品質向上

- 命名規則の統一度向上
- 新規チームメンバーのオンボーディング時間削減
- コード レビュー効率化
- 自動ツール・スクリプト対応可能

---

## 📄 ドキュメント

### 新規作成

**NAMING_GUIDELINES.md** - 包括的な命名規則ガイド
- フロントエンド（TypeScript/React）
- バックエンド（Python/FastAPI）
- ファイル・アセット
- API エンドポイント
- データベース・スキーマ

---

## ⚠️ 注意事項

### 画像ファイルの日本語使用

すべての画像ファイルは英数字とハイフンのみで命名されています。
日本語説明は Markdown の ALT テキストで提供してください：

```markdown
✓ 正しい使用法:
![中山ダート1200m 枠番別成績](/images/articles/course_nakayama_dirt_1200m_waku_rate.png)

✗ 誤った使用法:
![](/images/articles/course_中山_ダ1200m_waku_rate.png)
```

---

## 📋 チェックリスト

- [x] PredictuonTable.tsx → PredictionTable.tsx リネーム
- [x] RaceTabs.tsx インポート文更新
- [x] icons.tsx → Icons.tsx リネーム
- [x] 5ファイルのインポート文更新
- [x] 24ファイルの画像リネーム実施
- [x] 11ファイルのマークダウン記事パス更新
- [x] 命名規則ガイドライン作成
- [x] 改善サマリー作成

---

## 🚀 次のステップ

1. **継続的な命名規則遵守**
   - 新規ファイル作成時は NAMING_GUIDELINES.md を参照
   - PR レビュー時に命名規則チェック

2. **追加の改善検討**
   - app/blog/ の未使用ディレクトリ確認
   - その他コンポーネント名の見直し

3. **Google AdSense 審査対応**
   - この改善により SEO スコア向上が期待される
   - 次の AdSense 審査時に大きなプラスポイント

---

**改善完了日:** 2025-10-21
