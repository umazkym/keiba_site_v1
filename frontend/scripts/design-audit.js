const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const targetFiles = [
  'app/globals.css',
  'app/layout.tsx',
  'app/page.tsx',
  'app/articles/page.tsx',
  'app/articles/[slug]/page.tsx',
  'components/Header.tsx',
  'components/RaceAnalysisValueGrid.tsx',
  'components/RecentRaceReturn.tsx',
  'components/WeeklyGradeRaces.tsx',
  'components/RacePageClient.tsx',
  'components/RacePageJumpNav.tsx',
  'components/RacePageBottomNav.tsx',
  'components/RaceTabs.tsx',
  'hooks/useRaceSectionNavigation.ts',
];

const sources = targetFiles.map((relativePath) => {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`監査対象が見つかりません: ${relativePath}`);
  }
  return {
    relativePath,
    content: fs.readFileSync(absolutePath, 'utf8'),
  };
});

const countMatches = (content, pattern) => Array.from(content.matchAll(pattern)).length;

const rules = [
  {
    id: 'transition-all',
    description: '意図しないプロパティまで動かすtransition-all',
    pattern: /\btransition-all\b/g,
    max: 0,
    rationale: '色・背景・境界・透明度の遷移を明示する',
  },
  {
    id: 'interaction-motion',
    description: 'hoverまたはactive時の移動・拡大縮小',
    pattern: /(?:hover|group-hover|active):[^\s"'`]*(?:translate|scale)/g,
    max: 0,
    rationale: 'レイアウトが動かない色・境界の反応を使う',
  },
  {
    id: 'rounded-2xl',
    description: '12pxを超える汎用角丸',
    pattern: /\brounded-2xl\b/g,
    max: 1,
    rationale: 'globals.cssの既存モバイル互換ルール1件だけを許可する',
  },
  {
    id: 'backdrop-blur',
    description: '背景ぼかし面',
    pattern: /\bbackdrop-blur-(?:sm|md|lg|xl|2xl|3xl)\b/g,
    max: 3,
    rationale: 'stickyヘッダー、stickyレース選択、モバイル下部ナビに限定する',
  },
  {
    id: 'low-contrast-text',
    description: 'Slate 400の小さい文字',
    pattern: /\btext-slate-400\b/g,
    max: 5,
    rationale: '目次番号、開閉記号、リストマーカーなど非本文の表示だけを許可する',
  },
  {
    id: 'persistent-pulse',
    description: '常時pulseアニメーション',
    pattern: /\banimate-pulse\b/g,
    max: 0,
    rationale: '読み込み状態以外の継続アニメーションを使わない',
  },
  {
    id: 'decorative-gradient',
    description: 'コンポーネント上のグラデーション',
    pattern: /\bbg-gradient-(?:to-[tblr]{1,2}|radial|conic)\b/g,
    max: 0,
    rationale: '状態やデータの意味を持たない装飾グラデーションを使わない',
  },
];

const results = rules.map((rule) => {
  const locations = sources
    .map(({ relativePath, content }) => ({
      relativePath,
      count: countMatches(content, rule.pattern),
    }))
    .filter(({ count }) => count > 0);
  const count = locations.reduce((sum, item) => sum + item.count, 0);
  return { ...rule, count, locations, passed: count <= rule.max };
});

const globals = sources.find(({ relativePath }) => relativePath === 'app/globals.css').content;
const layout = sources.find(({ relativePath }) => relativePath === 'app/layout.tsx').content;
const raceNavigation = sources.find(({ relativePath }) => relativePath === 'hooks/useRaceSectionNavigation.ts').content;
const racePageClient = sources.find(({ relativePath }) => relativePath === 'components/RacePageClient.tsx').content;
const weeklyGradeRaces = sources.find(({ relativePath }) => relativePath === 'components/WeeklyGradeRaces.tsx').content;

const checks = [
  {
    id: 'single-root',
    description: ':root定義が1か所に統合されている',
    passed: countMatches(globals, /^:root\s*\{/gm) === 1,
  },
  {
    id: 'reduced-motion-css',
    description: 'CSSがprefers-reduced-motionを尊重する',
    passed: globals.includes('@media (prefers-reduced-motion: reduce)'),
  },
  {
    id: 'reduced-transparency-css',
    description: 'CSSがprefers-reduced-transparencyを尊重する',
    passed: globals.includes('@media (prefers-reduced-transparency: reduce)'),
  },
  {
    id: 'reduced-motion-scroll',
    description: 'レース内スクロールが動きの削減設定を尊重する',
    passed: raceNavigation.includes("matchMedia('(prefers-reduced-motion: reduce)')")
      && racePageClient.includes("matchMedia('(prefers-reduced-motion: reduce)')"),
  },
  {
    id: 'skip-link',
    description: '本文へのスキップリンクと移動先がある',
    passed: layout.includes('href="#main-content"') && layout.includes('id="main-content"'),
  },
  {
    id: 'grade-race-no-hidden-rail',
    description: '重賞一覧がモバイルの隠れた横レールに依存しない',
    passed: !weeklyGradeRaces.includes('overflow-x-auto'),
  },
];

console.log('UMA-FREE design audit');
for (const result of results) {
  const status = result.passed ? 'PASS' : 'FAIL';
  const locationText = result.locations.length > 0
    ? ` (${result.locations.map(({ relativePath, count }) => `${relativePath}:${count}`).join(', ')})`
    : '';
  console.log(`${status} ${result.id}: ${result.count}/${result.max}${locationText}`);
  console.log(`     ${result.rationale}`);
}
for (const check of checks) {
  console.log(`${check.passed ? 'PASS' : 'FAIL'} ${check.id}: ${check.description}`);
}

const failed = results.some((result) => !result.passed) || checks.some((check) => !check.passed);
if (failed) {
  console.error('デザイン監査に失敗しました。DESIGN.mdの基準と例外上限を確認してください。');
  process.exitCode = 1;
} else {
  console.log('デザイン監査に合格しました。');
}
