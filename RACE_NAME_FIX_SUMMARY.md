# race_name が空文字列になる問題の解決報告

## 📋 問題の概要

`run_pipeline` 実行時に、`races` テーブルの `race_name` カラムに値が入らず、空文字列のまま保存されるケースが発生していました。

- **発生率**: 全レースの約 0.12%（109/91744 件）
- **主な発生箇所**: 地方競馬（門別、大井、笠松など）
- **影響を受けたレース数**: 109 件

---

## 🔍 根本原因の特定

### HTMLの構造の不一致

地方競馬のレース情報ページでは、異なるHTMLレイアウトが使用されていました：

**問題のあるHTML構造:**
```html
<h1>
  <a href="https://www.netkeiba.com/?rf=logo" title="netkeiba">
    <img alt="netkeiba" src="...netkeiba_logo02.png"/>
  </a>
</h1>
```

- h1タグは存在するが、**テキストコンテンツが空**（ロゴ画像のみ）
- 実際のレース名は別の場所に格納されていた

### 正しいレース名の位置

```html
<div class="RaceName">ナダル・プレミアム(A1)</div>
```

- `<div class="RaceName">` に実際のレース名が格納されている
- parser.py の現在のロジックは `h1` タグのみを探していたため、この情報を取得していなかった

---

## ✅ 実装した修正

### ファイル: `backend/scripts/parser.py`

**修正内容**: `parse_shutuba_page` 関数内のレース名取得ロジックを改善

**変更前:**
```python
# 1. レース名: h1 タグを最優先で探す
race_name_elm = soup.find("h1")
if race_name_elm:
    race_name_text = race_name_elm.get_text(strip=True)
    race_info_dict['race_name'] = _normalize_race_name(race_name_text)
```

**変更後:**
```python
# 1. レース名: 複数の方法で取得を試みる
race_name_text = None

# 方法1: h1 タグから取得を試みる
h1_elm = soup.find("h1")
if h1_elm:
    text = h1_elm.get_text(strip=True)
    if text and len(text) > 2:  # h1内のテキストが意味のある長さなら採用
        race_name_text = text

# 方法2: h1が空の場合、RaceNameクラスの div から取得
if not race_name_text:
    race_name_elm = soup.find("div", class_="RaceName")
    if race_name_elm:
        text = race_name_elm.get_text(strip=True)
        if text:
            race_name_text = text

if race_name_text:
    race_info_dict['race_name'] = _normalize_race_name(race_name_text)
```

### 修正のポイント

1. **フォールバックロジック**: h1タグが空の場合、`RaceName`クラスを持つdivタグからレース名を取得
2. **テキスト長チェック**: 取得したテキストが意味のある長さ（>2文字）であることを確認
3. **段階的な取得**: 複数の取得方法を試す堅牢な実装

---

## 🧪 修正の検証

### テスト1: 単一レースの確認
```
修正前: race_name = ''
修正後: race_name = 'ナダル・プレミアム(A1)'
```

### テスト2: 複数レースの一括検証
```
テスト対象: DB上で空のrace_nameを持つ 10 レース
結果: 10/10 成功 ✅
```

**抽出されたレース名の例:**
- `'2歳ー6組'`
- `'2歳牝馬 未勝利'`
- `'3歳以上 C4ー2'`
- `'大自然の恵み。らんこし米特別(A2)'`
- `'グランシャリオドリーム74(C4)'`
- `'C2二組'`

---

## 🔄 既存データの修復

### 実行されたスクリプト

**ファイル**: `backend/repair_race_names.py`

- DB上の空のrace_nameを持つ全レース（109件）を特定
- 各レースのHTMLを再取得してパース
- 正しいrace_nameを取得して更新

### 修復進捗

```
修復前: 109 件の空race_nameレコード
修復中: ... (進行中)
```

---

## 📝 今後の対応

### パイプラインで同じ問題が発生しないために

1. **新規データの自動対応**: 修正後のコードが自動的にRaceNameクラスからレース名を取得
2. **キャッシュの無効化**: 修復後、該当するHTMLキャッシュをクリアしてパイプラインを再実行すれば、修正が反映される

### 推奨される追加施策

```bash
# 修復スクリプトを実行
cd backend
python repair_race_names.py

# または、次回のパイプライン実行で自動対応
PIPELINE_MODE=HISTORY python run_pipeline.py 2025-10-22 2025-10-22
```

---

## 🎯 結論

- ✅ **根本原因**: h1タグが空で、実際のレース名が`RaceName`クラスに格納されていた
- ✅ **修正実装**: フォールバックロジックで複数のHTML要素から取得する堅牢な実装に改善
- ✅ **テスト完了**: 10/10 レースで正常にレース名を取得確認
- ✅ **データ修復**: 既存の109件の空race_nameを修復中

これにより、将来のパイプライン実行ではレース名が正常に保存されます。
