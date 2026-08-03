export type MonetizationPageType =
  | 'home'
  | 'article'
  | 'article_index'
  | 'race_day'
  | 'race_detail'
  | 'data'
  | 'other';

export type MonetizationContentGroup =
  | 'grade_race'
  | 'evergreen_guide'
  | 'race_data'
  | 'entity_data'
  | 'utility';

export type MonetizationRacePhase =
  | 'field_building'
  | 'race_week'
  | 'draw_confirmed'
  | 'final_48h'
  | 'race_morning'
  | 'post_race'
  | 'evergreen';

const EXACT_RACE_PATH = /^\/races\/\d{4}-\d{2}-\d{2}\/[^/]+\/\d{1,2}$/;

function normalizePathname(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '/';
  try {
    const parsed = new URL(raw, 'https://uma-free.com');
    return parsed.pathname.replace(/\/+$/, '') || '/';
  } catch {
    return raw.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
  }
}

export function classifyMonetizationPageType(value: string): MonetizationPageType {
  const pathname = normalizePathname(value);
  if (pathname === '/') return 'home';
  if (pathname === '/articles') return 'article_index';
  if (pathname.startsWith('/articles/')) return 'article';
  if (EXACT_RACE_PATH.test(pathname)) return 'race_detail';
  if (pathname.startsWith('/races/')) return 'race_day';
  if (
    pathname === '/keiba-data'
    || pathname.startsWith('/keiba-data/')
    || pathname === '/my-data'
    || pathname.startsWith('/my-data/')
    || pathname === '/compare'
    || pathname.startsWith('/compare/')
    || pathname === '/courses'
    || pathname.startsWith('/courses/')
    || pathname === '/horses'
    || pathname.startsWith('/horses/')
    || pathname === '/jockeys'
    || pathname.startsWith('/jockeys/')
    || pathname === '/trainers'
    || pathname.startsWith('/trainers/')
    || pathname === '/grade-races'
    || pathname.startsWith('/grade-races/')
  ) return 'data';
  return 'other';
}

export function inferContentGroupFromPath(value: string): MonetizationContentGroup {
  const pageType = classifyMonetizationPageType(value);
  if (pageType === 'race_day' || pageType === 'race_detail') return 'race_data';
  if (pageType === 'data') return 'entity_data';
  if (pageType === 'article') return 'evergreen_guide';
  return 'utility';
}

export function normalizeRacePhase(value: string | undefined): MonetizationRacePhase | undefined {
  const normalized = String(value || '').trim() as MonetizationRacePhase;
  const allowed: MonetizationRacePhase[] = [
    'field_building',
    'race_week',
    'draw_confirmed',
    'final_48h',
    'race_morning',
    'post_race',
    'evergreen',
  ];
  return allowed.includes(normalized) ? normalized : undefined;
}

export function getBrowserMonetizationContext(pathname?: string): {
  page_type: MonetizationPageType;
  content_group: MonetizationContentGroup;
  race_phase?: MonetizationRacePhase;
} {
  const currentPath = pathname
    ?? (typeof window === 'undefined' ? '/' : window.location.pathname);
  const pageType = classifyMonetizationPageType(currentPath);
  let contentGroup = inferContentGroupFromPath(currentPath);
  let racePhase: MonetizationRacePhase | undefined;

  if (typeof document !== 'undefined') {
    const contextNode = document.querySelector<HTMLElement>('[data-content-group]');
    const storedContentGroup = contextNode?.dataset.contentGroup as MonetizationContentGroup | undefined;
    if (storedContentGroup && ['grade_race', 'evergreen_guide', 'race_data', 'entity_data', 'utility'].includes(storedContentGroup)) {
      contentGroup = storedContentGroup;
    }
    racePhase = normalizeRacePhase(contextNode?.dataset.racePhase) ?? racePhase;
  }

  return {
    page_type: pageType,
    content_group: contentGroup,
    race_phase: racePhase,
  };
}
