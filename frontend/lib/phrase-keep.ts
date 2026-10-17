// 文節を折らない箱に入れる所の決まり（2026-10-17）。PhraseText（React）と jp-phrase の insertPhraseBreaks（HTML の文字列）で共用する。
// word-break:keep-all でも「28.6% / が示す」「（ / 12番人気」「33.3% / ——」のように文節の中で折れることがある
// （記号の後は折ってよい扱いのため。iPhone の text-wrap:balance は開きかっこの直後でも折る）。
// そこで7字以下の文節は丸ごと折らない箱（white-space:nowrap）に入れ、文節の間の <wbr> でだけ折れるようにする。
// 8字以上の文節は狭い枠（スマホの「次に読む分析」は1行約10字）に入らないことがあるので箱に入れず、overflow-wrap:anywhere で折れるようにする。
// その時も、開きかっこで始まる文節は、かっこと次の1字だけはつないでおく。
const KEEP_MAX = 7;
const TRAILING = /[\s｜|、。，．,.!?！？）」』】］〕：:]+$/; // 文節の終わりの句読点・かっこ・空白は字数に入れない
const OPEN = /^[【「『（［〔(\[]/;

export function splitPhraseForKeep(phrase: string): { keep: string; rest: string } {
    if (phrase.replace(TRAILING, '').length <= KEEP_MAX) return { keep: phrase, rest: '' };
    if (OPEN.test(phrase)) {
        const chars = Array.from(phrase);
        return { keep: chars.slice(0, 2).join(''), rest: chars.slice(2).join('') };
    }
    return { keep: '', rest: phrase };
}
