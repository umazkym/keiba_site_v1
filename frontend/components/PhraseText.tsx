import { Fragment } from 'react';
import { splitPhraseForKeep } from '@/lib/phrase-keep';

// 文節（lib/jp-phrase の splitJaPhrases で区切った物）の間に <wbr> を挟んで描く。短い文節は折らない箱に入れる（lib/phrase-keep）。
// 親に word-break:keep-all が要る（長い文節を言葉の途中で折らないため）。
// 区切りの辞書はサーバー専用のため、この部品は区切った結果だけを受け取る（クライアントの部品からも使える）。
export function PhraseText({ phrases }: { phrases: string[] }) {
    return (
        <>
            {phrases.map((phrase, index) => {
                const { keep, rest } = splitPhraseForKeep(phrase);
                return (
                    <Fragment key={index}>
                        {index > 0 && <wbr />}
                        {keep && <span className="whitespace-nowrap">{keep}</span>}
                        {rest}
                    </Fragment>
                );
            })}
        </>
    );
}
