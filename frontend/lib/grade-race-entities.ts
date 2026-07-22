import registry from '@/content/reference/grade-race-entities.json';

export type GradeRaceEntity = {
  entity_key: string;
  name: string;
  aliases: string[];
  circuit: 'jra' | 'nar' | 'overseas';
  grade: string;
};

export const gradeRaceEntities = registry as GradeRaceEntity[];

function normalizeGradeRaceText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/20\d{2}年?/g, '')
    .replace(/[\s　・･()（）【】「」『』｜|:：_-]/g, '')
    .toLowerCase();
}

export function findGradeRaceEntity(value: string): GradeRaceEntity | null {
  const normalized = normalizeGradeRaceText(value);
  if (!normalized) return null;
  const matches = gradeRaceEntities.filter((entity) =>
    [entity.name, ...entity.aliases].some((alias) => normalized.includes(normalizeGradeRaceText(alias))),
  );
  return matches.length === 1 ? matches[0] : null;
}

export function getGradeRaceEntity(entityKey: string): GradeRaceEntity | null {
  return gradeRaceEntities.find((entity) => entity.entity_key === entityKey) || null;
}
