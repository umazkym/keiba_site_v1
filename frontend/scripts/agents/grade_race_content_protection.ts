export function shouldPreserveRichExistingGradeRaceContent(
  existingData: Record<string, unknown>,
  existingContent: string,
  incomingData: Record<string, unknown>,
  incomingContent: string,
): boolean {
  // 定型fallbackは開催条件だけを扱うため、既存の通常記事を文字数比較だけで
  // 上書き可否にすると、短くても確認済みの固有情報を持つ本文を失う。
  // 通常記事として読める最低限の本文量があれば、保守側へ倒して定型更新を止める。
  return existingData.entity_type === 'grade_race'
    && incomingData.official_fact_fallback === true
    && existingData.official_fact_fallback !== true
    && existingContent.trim().length >= 400;
}
