export function getSeasonalGradeRaceSlug(
  entityType: unknown,
  entityKey: unknown,
  seasonYear: unknown,
): string | null {
  const type = String(entityType || '').trim().toLowerCase();
  const key = String(entityKey || '').trim().toLowerCase();
  const year = String(seasonYear || '').trim();
  if (type !== 'grade_race' || !/^[a-z0-9-]+$/.test(key) || !/^20\d{2}$/.test(year)) {
    return null;
  }
  return `${key}-${year}`;
}

export function isSameSeasonalGradeRaceIdentity(
  left: { entityType: unknown; entityKey: unknown; seasonYear: unknown },
  right: { entityType: unknown; entityKey: unknown; seasonYear: unknown },
): boolean {
  const leftSlug = getSeasonalGradeRaceSlug(left.entityType, left.entityKey, left.seasonYear);
  return Boolean(
    leftSlug
    && leftSlug === getSeasonalGradeRaceSlug(right.entityType, right.entityKey, right.seasonYear),
  );
}
