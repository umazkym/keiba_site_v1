import os
import re
import random

ARTICLE_DIR = 'articles'

# --- Replacement Dictionaries for V3 ---

ADVANCED_REPLACEMENTS = {
    "について解説します。": [
        "について詳しく見ていきましょう。",
        "を紐解いてみたいと思います。",
        "の真相に迫ります。",
        "について、実際のデータと考え方をシェアします。",
        "のポイントを整理してみました。",
        "について語っていきましょう。"
    ],
    "結論から言うと、": [
        "単刀直入にお伝えすると、",
        "まず核心からお話しすると、",
        "データを集計して真っ先に分かったのは、",
        "ズバリ結論から申し上げると、",
        "結論から先に言ってしまうと、",
        "最も重要なポイントを先にお伝えすると、"
    ],
    "以上のことから、": [
        "これらのデータを総合すると、",
        "ここまでの分析を踏まえると、",
        "以上の数字が示唆しているのは、",
        "これらの傾向から導き出されるのは、",
        "この事実から言えることは、"
    ],
    "ここで注意したいのは、": [
        "ただ、一つ気をつけたいポイントがあります。それは、",
        "しかし、手放しで喜べない要素もあります。",
        "ここで気を留めておきたいのが、",
        "ただし、留意すべき点として、",
        "見落としてはならないのが、"
    ],
    "まずは": [
        "手始めに",
        "最初のステップとして",
        "では手始めに",
        "最初に取り上げたいのは",
        "まず最初に"
    ],
    "重要なポイントは": [
        "決定的な鍵となるのは",
        "最大の肝となる部分は",
        "ここでのキーポイントは",
        "勝敗を分ける最大の要素は",
        "最も意識すべき点は"
    ]
}


def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    for target, variations in ADVANCED_REPLACEMENTS.items():
        count = content.count(target)
        for _ in range(count):
            content = content.replace(target, random.choice(variations), 1)

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
