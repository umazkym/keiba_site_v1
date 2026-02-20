import os
import re
import random

ARTICLE_DIR = 'articles'

INTRO_A = "今回私たちは、独自の分析スクリプトを用いて、"
INTRO_A_REPLACEMENTS = [
    "今回、当サイトのデータベースを使って過去の傾向を洗ってみたところ、",
    "オカルトや個人の感覚ではなく、過去の実データから客観的に集計してみると、",
    "競馬ファンの間でもよく話題になる定説ですが、実際にプログラムで解析してみると、",
    "実は、膨大なレース結果をフラットな視点で見直すことで、",
    "「本当にその定説は正しいのか？」と疑問に思い、過去数年分のデータを徹底検証した結果、",
    "今回は、人間の先入観を一旦横に置き、純粋なデータ分析の観点から、",
    "巷で言われているセオリーを、独自開発の分析ツールで丸裸にしてみたところ、",
    "何万というレース結果を一つひとつ紐解いていくと、",
    "過去の膨大な出馬表と結果をAIに読み込ませてみた結果、",
    "私たちのチームが長年蓄積してきた競馬データベースを駆使して、",
    "単なるイメージにとらわれず、実際の数字がどうなっているのか調べてみると、",
    "メディアでよく語られる傾向について、念のためデータで裏取りをしてみたところ、"
]

INTRO_B = "この記事を読めば、漠然としたイメージではなく、"
INTRO_B_REPLACEMENTS = [
    "この記事をお読みいただければ、単なるイメージではなく、",
    "本記事では、感覚的な予想を排し、",
    "曖昧な勘に頼るのではなく、",
    "根拠のない思い込みは一旦捨てて、",
    "この記事を通して、表面的なデータを超えた、",
    "最後まで読んでいただければ、漠然とした定説の裏にある、",
    "ここでは、多くの人が見落としがちな、",
    "今回は、一般的な競馬ファンが知らないような、",
    "この記事では、客観的な事実に基づき、",
    "本稿では、数字が証明する、"
]

OUTRO_A = "データという確かな根拠を手に、"
OUTRO_A_REPLACEMENTS = [
    "客観的なデータ分析の視点を取り入れて、",
    "このように数字が示す事実をひとつの武器として、",
    "過去の傾向という強力な裏付けをもとに、",
    "AIやプログラムが弾き出した事実をうまく活用して、",
    "時には自分の直感と、こうした客観データの両輪で、",
    "感情に流されないデータという頼もしい相棒とともに、",
    "表面的なオッズに惑わされず、この事実を胸に秘めて、",
    "このような隠れた傾向をうまく馬券検討に組み込んで、",
    "ここで見えた新しい気付きを活かして、",
    "データが教えてくれたこのセオリーを武器に、"
]

OUTRO_B = "データという客観的な羅針盤を手に、"
OUTRO_C = "データという確かな武器を手に、"

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    # Replace instances of INTRO_A
    while INTRO_A in content:
        content = content.replace(INTRO_A, random.choice(INTRO_A_REPLACEMENTS), 1)

    # Replace instances of INTRO_B
    while INTRO_B in content:
        content = content.replace(INTRO_B, random.choice(INTRO_B_REPLACEMENTS), 1)

    # Replace instances of OUTRO_A, OUTRO_B, OUTRO_C
    for outro in [OUTRO_A, OUTRO_B, OUTRO_C]:
        while outro in content:
            content = content.replace(outro, random.choice(OUTRO_A_REPLACEMENTS), 1)

    # Further tweaking for general "です/ます" repetition matching "見えるでしょう。" etc.
    # We will just do simple string replacements to vary the ending.
    content = content.replace("見えてくるでしょう。", random.choice([
        "見えてくるはずです。",
        "ハッキリと浮かび上がってきました。",
        "見えてくるのではないでしょうか。",
        "理解していただけると思います。",
        "見えてくることでしょう。",
        "明らかになります。"
    ]))

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
    # Set fixed seed for consistent testability if needed, or leave dynamic.
    random.seed()
    main()
