import { checkFixedValueHallucination, hasApprovedContentQuality, resolveReplacementOriginal } from './agent_editor';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const approvedQuality = {
  answers_search_intent: true,
  has_verifiable_specific_value: true,
  states_applicable_conditions: true,
  states_as_of_or_update_status: true,
};

assert(hasApprovedContentQuality(approvedQuality), '4条件がboolean trueの短い事実記事はEditor承認候補になるべきです');
assert(!hasApprovedContentQuality(undefined), 'content_quality欠落は不合格にする必要があります');
assert(!hasApprovedContentQuality({ ...approvedQuality, answers_search_intent: false }), 'falseの品質項目は不合格にする必要があります');
assert(!hasApprovedContentQuality({ ...approvedQuality, has_verifiable_specific_value: 'true' }), '文字列trueは承認してはいけません');

const longGenericArticle = '一般論だけを繰り返す長い本文。'.repeat(400);
assert(longGenericArticle.length > 3000, '長文ケースを用意できていません');
assert(
  !hasApprovedContentQuality({
    answers_search_intent: false,
    has_verifiable_specific_value: false,
    states_applicable_conditions: false,
    states_as_of_or_update_status: false,
  }),
  '長い一般論をEditorが不合格と評価した場合、公開承認してはいけません',
);

const evidenceNumbers = new Set([35.3, 1200]);
assert(
  checkFixedValueHallucination('複勝率は42.1%です。', evidenceNumbers).hasHallucination,
  'Evidence Packにない数値の置換は拒否する必要があります',
);
assert(
  !checkFixedValueHallucination('複勝率は35.3%です。', evidenceNumbers).hasHallucination,
  'Evidence Packにある数値は拒否してはいけません',
);

// 2026-10-02 の記事回：original はリンク付きの下書きから引用され、本文は自動補正でリンクが外れていた
const linkedOriginal = '他の芝コース傾向、例えば[京都芝1800mの枠順傾向](/articles/2026-04-16-kyototurf1800m-waku-data)や[東京芝1400mの枠順データ](/articles/2026-10-02-tokyoturf-1400-m-waku-data)と比較しても、特定の中枠（3枠）や外寄り（7枠）で単勝回収率が150%以上まで跳ね上がる現象は福島芝1800m特有のポイントといえる。';
const unwrappedSentence = '他の芝コース傾向、例えば京都芝1800mの枠順傾向や東京芝1400mの枠順データと比較しても、特定の中枠（3枠）や外寄り（7枠）で単勝回収率が150%以上まで跳ね上がる現象は福島芝1800m特有のポイントといえる。';
const repairedBody = `## 枠ごとの傾向\n\n${unwrappedSentence}\n\n次の段落。\n`;
assert(
  resolveReplacementOriginal(repairedBody, linkedOriginal) === unwrappedSentence,
  'リンクが外れた本文には、リンクを外した original で照合する必要があります',
);
assert(
  resolveReplacementOriginal(repairedBody, '次の段落。') === '次の段落。',
  '完全一致する original はそのまま返す必要があります',
);
assert(
  resolveReplacementOriginal(repairedBody, '本文に無い文。') === null,
  '本文に無い original は見つからない扱いにする必要があります',
);
const allowedLinkBody = '詳しくは[今日のAI予想・出馬表](/races/today)で確認する。';
assert(
  resolveReplacementOriginal(allowedLinkBody, '詳しくは[今日のAI予想・出馬表](/races/today)で確認する。') !== null,
  '許可されたリンクを含む original は完全一致で照合できる必要があります',
);
