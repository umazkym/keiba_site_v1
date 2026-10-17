// 日本語の見出しを文節で区切る（2026-10-17）。
// iPhone（WebKit）は word-break:auto-phrase が効かず、見出しが「脚/質」「フロムダ/スク」のように言葉の途中で折れていた。
// サーバーで文節の間に <wbr> を入れ、CSS の word-break:keep-all（文節の間でだけ折る）と overflow-wrap:anywhere（長すぎる時の逃げ道）と組み合わせる。
// 区切りの判定は BudouX（lib/budoux-ja）。辞書が約20KBあるため、クライアントのJSに載せないよう server-only にしている。
// クライアントの部品は区切った結果（string[]）を受け取り、PhraseText で描く。
import 'server-only';
import { BudouxParser } from './budoux-ja/parser';
import { JA_MODEL } from './budoux-ja/model';
import { splitPhraseForKeep } from './phrase-keep';

let parser: BudouxParser | null = null;

// 区切ってよい所の決まり（BudouX の区切りに足し引きする）
const ALNUM = /[0-9A-Za-z０-９Ａ-Ｚａ-ｚ.,．，%％]/; // 英数字どうしの間では区切らない（「2400m」「G1」「18.0%」を割らない）
const BREAK_AFTER = /[｜|？！?!】」』）］〕。、：]/; // この後では区切る（BudouX は「｜」の後で区切らないことがある）
const OPEN = /[【「『（［〔(\[]/; // 開きかっこの前では区切り、後では区切らない
const CLOSE = /[】」』）］〕)\]]/;
const NO_BREAK_BEFORE = /[】」』）］〕)\]、。，．,.・ー：:；;！？!?々ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ]/; // 行の頭に来てはいけない字
const KANJI = /[㐀-䶿一-鿿々〆]/;
const KATAKANA = /[ァ-ヺー-ヿｦ-ﾟ]/; // 「・」（30FB）は入れない
const HIRAGANA = /[ぁ-ゖ]/;
const DASH = /[—―]/;
const DIGIT = /[0-9０-９]/;
const COUNTER = /[年月日歳番着頭回位人戦勝走週秒分円倍点枠号度代期周馬]/;
const LATIN = /[A-Za-zＡ-Ｚａ-ｚ]/;
const RACE_SUFFIX = /[賞杯盃]/; // 英字の後でも割らない（「CBC賞」「NHK杯」）
// 8字以上の文節は、狭い枠（スマホの「次に読む分析」は1行約10字）に収まらず字の途中で折れる。
// そのような文節だけ、字の種類が変わる所（カタカナの後の漢字・3字以上の漢字の後のカタカナ・数字の頭と終わり・英字の後）でも区切る。
// 割らない所：数字の後の数える言葉（「7番」「2026年」「2着」）、漢字の後の英字（「東海S」）、英字の後の賞・杯（「CBC賞」）、2字以下の漢字の後のカタカナ（「東京ダート」）。
const LONG_PHRASE = 8;

// 長いカタカナのレース名を、よくある語の前で割る（「スパーキングレディー / カップ」「アイビスサマー / ダッシュ」）
const KATAKANA_WORDS = ['カップ', 'ステークス', 'トロフィー', 'ダッシュ', 'スプリント', 'クラシック', 'ダービー', 'オークス', 'マイル', 'チャレンジ', 'ジュベナイル', 'グランプリ', 'ナイター', 'サマー', 'オータム', 'レディー', 'チャンピオン', 'クイーン', 'ロイヤル'];

function digitRunBefore(phrase: string, i: number): number {
  let length = 0;
  while (i - 1 - length >= 0 && DIGIT.test(phrase[i - 1 - length])) length++;
  return length;
}

function isScriptBoundary(phrase: string, i: number): boolean {
  const prev = phrase[i - 1];
  const next = phrase[i];
  if ((KATAKANA.test(prev) || HIRAGANA.test(prev)) && KATAKANA_WORDS.some((word) => phrase.startsWith(word, i))) return true;
  if (KATAKANA.test(prev) && KANJI.test(next)) return true;
  if (KANJI.test(prev) && KATAKANA.test(next)) return i >= 3 && KANJI.test(phrase[i - 2]) && KANJI.test(phrase[i - 3]);
  if ((KANJI.test(prev) || KATAKANA.test(prev) || HIRAGANA.test(prev)) && DIGIT.test(next)) return true;
  // 4桁の数（年）の後は「年」「円」「万」だけをつなぐ（「2026 / 枠順確定後」）
  if (DIGIT.test(prev) && KANJI.test(next)) return digitRunBefore(phrase, i) >= 4 ? !/[年円万]/.test(next) : !COUNTER.test(next);
  // レース名の後の年（「スプリンターズS / 2026」）
  if (LATIN.test(prev) && /^(19|20)[0-9]{2}/.test(phrase.slice(i))) return true;
  // 2字以上のひらがなの後の漢字（「見るべき / 確認ポイント」。「取り組み」のような1字の送り仮名では割らない）
  if (HIRAGANA.test(prev) && HIRAGANA.test(phrase[i - 2] ?? '') && KANJI.test(next)) return true;
  return LATIN.test(prev) && (KANJI.test(next) || KATAKANA.test(next)) && !RACE_SUFFIX.test(next);
}

export function splitJaPhrases(text: string): string[] {
  if (!text) return [];
  if (!parser) parser = new BudouxParser(JA_MODEL);
  const breaks = new Set<number>();
  let position = 0;
  for (const chunk of parser.parse(text).slice(0, -1)) {
    position += chunk.length;
    breaks.add(position);
  }
  for (let i = 1; i < text.length; i++) {
    // 空白の後も文節の切れ目にする（「（12番人気 / 1枠2番）」を1つの長い文節と見なさない）
    if (BREAK_AFTER.test(text[i - 1]) || OPEN.test(text[i]) || (/\s/.test(text[i - 1]) && !/\s/.test(text[i]))) breaks.add(i);
    // ダッシュ（——）の前と、中黒（・）の後でも区切る（「32.3% / ——中枠」「36.5%・ / 複勝率」。数字どうしの「1・2番」は割らない）
    if (DASH.test(text[i]) && !DASH.test(text[i - 1])) breaks.add(i);
    if (text[i - 1] === '・' && !(DIGIT.test(text[i - 2] ?? '') && DIGIT.test(text[i]))) breaks.add(i);
  }
  for (const i of [...breaks]) {
    const prev = text[i - 1];
    const next = text[i];
    if (NO_BREAK_BEFORE.test(next) || OPEN.test(prev) || (ALNUM.test(prev) && ALNUM.test(next))) breaks.delete(i);
    // 閉じかっこの後の助詞は前につなぐ（「（◎） / の複勝率」と行の頭に「の」が来ないように）
    if (CLOSE.test(prev) && HIRAGANA.test(next)) breaks.delete(i);
    // 「1枠2番」「2026年10月」のような 数字＋数える言葉＋数字 の間でも区切らない（長い時は下の長い文節の決まりで割る）
    if (DIGIT.test(text[i - 2] ?? '') && COUNTER.test(prev) && DIGIT.test(next)) breaks.delete(i);
  }
  const sorted = [...breaks].sort((a, b) => a - b);
  const phrases: string[] = [];
  let from = 0;
  for (const to of [...sorted, text.length]) {
    const phrase = text.slice(from, to);
    if (phrase.length < LONG_PHRASE) {
      phrases.push(phrase);
    } else {
      // 長い文節の中の区切り。前後とも2字以上残る所だけ
      let start = 0;
      for (let i = 2; i <= phrase.length - 2; i++) {
        if (i - start >= 2 && isScriptBoundary(phrase, i)) {
          phrases.push(phrase.slice(start, i));
          start = i;
        }
      }
      phrases.push(phrase.slice(start));
    }
    from = to;
  }
  return phrases;
}

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const ENTITY_PATTERN = /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi;

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 見出しの HTML の文字の部分に <wbr> を入れ、短い文節を折らない箱に入れる（PhraseText と同じ決まり）。タグ（<strong> など）は触らない。
// 文字参照（&amp; &#x26; など）は割らないよう一度戻してから区切り、& < > だけを書き直す。知らない名前の文字参照がある所は区切らない。
export function insertPhraseBreaks(html: string): string {
  return html.split(/(<[^>]*>)/).map((part) => {
    if (!part || part.startsWith('<') || !part.trim()) return part;
    let unknownEntity = false;
    const text = part.replace(ENTITY_PATTERN, (match, name: string) => {
      if (name[0] === '#') {
        const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
        if (!(code > 0 && code <= 0x10ffff)) {
          unknownEntity = true;
          return match;
        }
        return String.fromCodePoint(code);
      }
      const decoded = NAMED_ENTITIES[name.toLowerCase()];
      if (decoded === undefined) unknownEntity = true;
      return decoded ?? match;
    });
    if (unknownEntity) return part;
    return splitJaPhrases(text)
      .map((phrase) => {
        const { keep, rest } = splitPhraseForKeep(phrase);
        return (keep ? `<span class="whitespace-nowrap">${escapeHtml(keep)}</span>` : '') + escapeHtml(rest);
      })
      .join('<wbr>');
  }).join('');
}
