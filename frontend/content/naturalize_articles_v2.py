import os
import re
import random

ARTICLE_DIR = 'articles'

# --- Replacement Dictionaries ---

REPLACEMENTS = {
    "見ていきましょう。": [
        "確認してみます。",
        "探っていきます。",
        "分析してみることにします。",
        "チェックしてみましょう。",
        "掘り下げてみます。",
        "詳しく見ていくことにします。",
        "データを追ってみましょう。",
        "検証してみます。"
    ],
    "この記事では、": [
        "本稿では、",
        "今回の分析では、",
        "ここからは、",
        "本記事においては、",
        "以下では、",
        "このページでは、"
    ],
    "ことが分かります。": [
        "ことが判明しました。",
        "というデータが得られました。",
        "という事実が浮き彫りになります。",
        "ことが明白です。",
        "という傾向が伺えます。",
        "という結果になりました。"
    ],
    "と言えます。": [
        "と考えられます。",
        "という結論に至りました。",
        "と言って過言ではありません。",
        "という見方が妥当でしょう。",
        "と評価できます。",
        "という事実が明確です。"
    ],
    "徹底解説します。": [
        "詳しく紐解いていきます。",
        "深掘りしてみたいと思います。",
        "詳細に分析します。",
        "分かりやすく解説していきます。",
        "データを元に考察します。"
    ]
}

HEADER_REPLACEMENTS = {
    "## まとめ": [
        "## 総括",
        "## 最後に",
        "## 分析のまとめ",
        "## 今回の気づき",
        "## 結びに代えて",
        "## データからの結論",
        "## まとめと今後の展望"
    ]
}

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    # Replace specific phrases with random choices
    for target, variations in REPLACEMENTS.items():
        # Count occurrences
        count = content.count(target)
        for _ in range(count):
            content = content.replace(target, random.choice(variations), 1)

    # Replace headers
    for target, variations in HEADER_REPLACEMENTS.items():
        count = content.count(target)
        for _ in range(count):
            content = content.replace(target, random.choice(variations), 1)

    # Add a bit of natural flow variation to bullet points
    # Change some "・" to number points, or slightly alter sentence endings in list items if possible,
    # but that might be risky for formatting. We'll stick to safe text replacements.

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
    random.seed()
    main()
