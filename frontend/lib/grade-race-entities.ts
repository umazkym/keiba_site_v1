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

const contextPrefixPattern = /^(?:(?:jra|nar|地方競馬|中央競馬|競馬|重賞|交流重賞|地方重賞|g[123]|jpn(?:i{1,3}|[123])|jg[123]|s[123]|m[123]|bg[123]|札幌|函館|福島|新潟|東京|中山|中京|京都|阪神|小倉|門別|盛岡|水沢|浦和|船橋|大井|川崎|金沢|笠松|名古屋|園田|姫路|高知|佐賀|帯広)+)/;

type GradeRaceAliasRow = {
  alias: string;
  entity: GradeRaceEntity;
};

function gradeRaceAliasRows(): GradeRaceAliasRow[] {
  return gradeRaceEntities
    .flatMap((entity) => [entity.name, ...entity.aliases].map((value) => ({
      alias: normalizeGradeRaceText(value),
      entity,
    })))
    .filter((row) => Boolean(row.alias))
    .sort((left, right) => right.alias.length - left.alias.length || left.alias.localeCompare(right.alias));
}

export function findGradeRaceEntityByName(value: string): GradeRaceEntity | null {
  const normalized = normalizeGradeRaceText(value);
  if (!normalized) return null;
  const matches = gradeRaceAliasRows()
    .filter((row) => row.alias === normalized)
    .map((row) => row.entity);
  const unique = [...new Map(matches.map((entity) => [entity.entity_key, entity])).values()];
  return unique.length === 1 ? unique[0] : null;
}

export function findGradeRaceEntity(value: string): GradeRaceEntity | null {
  const normalized = normalizeGradeRaceText(value).replace(contextPrefixPattern, '');
  if (!normalized) return null;
  const matches = gradeRaceAliasRows().filter((row) => normalized.startsWith(row.alias));
  if (matches.length === 0) return null;
  const longest = matches[0].alias.length;
  const unique = [...new Map(
    matches
      .filter((row) => row.alias.length === longest)
      .map((row) => [row.entity.entity_key, row.entity]),
  ).values()];
  return unique.length === 1 ? unique[0] : null;
}

export function getGradeRaceEntity(entityKey: string): GradeRaceEntity | null {
  return gradeRaceEntities.find((entity) => entity.entity_key === entityKey) || null;
}
