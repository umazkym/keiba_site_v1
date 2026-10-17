import { PhraseText } from '@/components/PhraseText';
import { splitJaPhrases } from '@/lib/jp-phrase';

// 題名を分ける所。上から順に探し、最初に当たった所で分ける。
// 「｜」の無い題名（400本中33本・2026-10-17）は「？」「！」・先頭の【】[]・「。」「：」の後で分ける（言葉の途中で折れるのを防ぐ）。
const TITLE_BREAKS = [
    /^(.+?)(\s*[｜|]\s*)(.+)$/,
    /^(.+?[？！?!])(\s*)(.+)$/,
    /^([【［[][^】］\]]+[】］\]])(\s*)(.+)$/,
    /^(.+?[。：])(\s*)(.+)$/,
];

// 記事の題名。「本題｜副題」は、スマホだけ区切りの後で改行して2段にする（1字だけ次の行に落ちるのを防ぐ。OG画像と同じ分け方）。
// 各段の中は文節の間に <wbr> を入れる。親に word-break:keep-all を付けると、文節の間でだけ折れる（2026-10-17）。
// 文節の辞書はサーバー専用のため、この部品はサーバーの部品からだけ使う（ArticleParts はクライアントの部品からも読まれるので、そこに置かない）。
// 文字の並びは元の題名のまま（パンくず・読み上げ・検索で同じ文になる）。
export function ArticleTitleText({ title }: { title: string }) {
    const match = TITLE_BREAKS.map(pattern => title.match(pattern)).find(Boolean);
    if (!match) return <PhraseText phrases={splitJaPhrases(title)} />;
    const [, main, separator, sub] = match;
    // PC は1行に続けて出すため、区切りの「｜」が次の行の頭に来ないよう、前の文節とつないでおく（短い文節は折らない箱に入る）
    const mainPhrases = splitJaPhrases(main);
    const lastPhrase = mainPhrases.pop() ?? '';
    return (
        <>
            <span className="block sm:inline"><PhraseText phrases={[...mainPhrases, lastPhrase + separator]} /></span>
            <span className="block sm:inline"><PhraseText phrases={splitJaPhrases(sub)} /></span>
        </>
    );
}
