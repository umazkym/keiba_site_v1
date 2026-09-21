import { checkFixedValueHallucination, hasApprovedContentQuality } from './agent_editor';

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
