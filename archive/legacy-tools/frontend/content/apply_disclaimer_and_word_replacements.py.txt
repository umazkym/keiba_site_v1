import os
import re

ARTICLE_DIR = 'articles'

# 古い免責事項ブロックのパターン (H2見出し含む場合と含まない場合)
OLD_DISCLAIMER_PATTERN_WITH_H2 = re.compile(
    r'##\s*(この記事で扱う集計条件|本記事の集計条件について)\s*\n+>\s*本記事の数値は.*?的中や回収を保証するものではありません。',
    re.DOTALL
)

OLD_DISCLAIMER_PATTERN_ONLY_TEXT = re.compile(
    r'>\s*本記事の数値は.*?的中や回収を保証するものではありません。',
    re.DOTALL
)

NEW_DISCLAIMER = (
    "> 数値はUMA-FREEの過去データをテーマ別条件で集計したものです。"
    "出走取消・欠損データ・極端な少頭数レースは除外しています。"
    "的中・回収の保証はありません。"
)

# 語句置換リスト
WORD_REPLACEMENTS = {
    '難しいなコース': '難しいコース',
    '難しいな展開': '難しい展開',
    '大きくに有利': '大きく有利',
    '過信を禁物とする': '過信は禁物だ',
    'かなり合致している': 'よく合致している',
    '突出だ。': '突出している。',
    'かなり低い水準': '大幅に低い水準',
    '絶望的な低さ': '大幅に低い水準',
    '絶望的数値': '大幅に低い数値',
    '絶望的': '著しく低い',
    '壊滅的': '大幅な不振',
}

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    # 1. 古い免責事項の削除
    # H2見出し付きのパターンをまず削除
    content, count1 = OLD_DISCLAIMER_PATTERN_WITH_H2.subn('', content)
    # テキストのみのパターンを削除 (H2見出しが別になっていた場合など)
    content, count2 = OLD_DISCLAIMER_PATTERN_ONLY_TEXT.subn('', content)

    # 2. 新しい免責事項を最初のH2直下に挿入
    # frontmatterの終わり (---) 以降で、最初の「## 」を探す
    frontmatter_match = re.match(r'^---.*?---\s*', content, re.DOTALL)
    if frontmatter_match:
        fm_end = frontmatter_match.end()
        body = content[fm_end:]
        
        # 最初のH2を検索
        h2_match = re.search(r'^##\s+.*$', body, re.MULTILINE)
        if h2_match:
            h2_end = fm_end + h2_match.end()
            # 既に免責事項がそこにあるかチェック (二重挿入防止)
            if "的中・回収の保証はありません" not in content[h2_end:h2_end+200]:
                content = content[:h2_end] + "\n\n" + NEW_DISCLAIMER + "\n" + content[h2_end:]
        else:
            # H2がない場合は本文の冒頭 (frontmatter直後) に挿入
            if "的中・回収の保証はありません" not in content[fm_end:fm_end+200]:
                content = content[:fm_end] + NEW_DISCLAIMER + "\n\n" + content[fm_end:]
    else:
        # frontmatterがない場合
        h2_match = re.search(r'^##\s+.*$', content, re.MULTILINE)
        if h2_match:
            h2_end = h2_match.end()
            if "的中・回収の保証はありません" not in content[h2_end:h2_end+200]:
                content = content[:h2_end] + "\n\n" + NEW_DISCLAIMER + "\n" + content[h2_end:]

    # 3. 語句の一括置換
    for old_word, new_word in WORD_REPLACEMENTS.items():
        content = content.replace(old_word, new_word)

    # 4. 末尾の孤立数値文のクリーンアップ (例: 「8枠の勝率は4.0%に留まっている。」などの最終行)
    # 最終行に単独で「X枠の複勝率・勝率は〇〇%」といった数値文がある場合、または「である。」で終わる孤立行
    lines = content.split('\n')
    if lines:
        # 末尾の空行を除外して最後の実質行を取得
        last_non_empty_idx = -1
        for idx in range(len(lines) - 1, -1, -1):
            if lines[idx].strip() and not lines[idx].strip().startswith('---'):
                last_non_empty_idx = idx
                break
        
        if last_non_empty_idx != -1:
            last_line = lines[last_non_empty_idx].strip()
            # 孤立した数値文パターン: 「[1-8]枠の[勝複]勝率は...留まっている。」「...数値となっている。」など
            if (re.search(r'[1-8]枠の(?:勝率|複勝率|成績)は.*?(?:留まっている|なっている|低い値です|最低値です|最高値です)。', last_line) or
                re.search(r'[1-8]枠の複勝率は.*?であり、全枠順の中で最も低い数値となっている。', last_line)):
                print(f"Removing isolated last line in {os.path.basename(filepath)}: {last_line}")
                lines[last_non_empty_idx] = "" # 削除
                content = '\n'.join(lines)

    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    modified_count = 0
    total_files = 0
    for filename in os.listdir(ARTICLE_DIR):
        if filename.endswith('.md'):
            total_files += 1
            filepath = os.path.join(ARTICLE_DIR, filename)
            if process_file(filepath):
                modified_count += 1
    print(f"Total files checked: {total_files}")
    print(f"Files modified: {modified_count}")

if __name__ == '__main__':
    main()
