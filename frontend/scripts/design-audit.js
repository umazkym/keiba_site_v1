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
  'components/RaceSelector.tsx',
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

const extendedTargetFiles = [
  'components/PredictionTable.tsx',
  'components/RaceAnalysis.tsx',
  'components/StartPositionChart.tsx',
  'components/HorseNumberAdvantageChart.tsx',
  'components/RelatedRaces.tsx',
  'components/DynamicRelatedArticles.tsx',
  'components/DisclaimerAlert.tsx',
  'components/MobileArticleThemeDirectory.tsx',
  'components/EntityArticleDocument.tsx',
  'components/ArticleBody.tsx',
  'components/AdSensePageLevelScript.tsx',
  'lib/page-scroll-lock.ts',
];
const extendedSources = extendedTargetFiles.map((relativePath) => ({
  relativePath,
  content: fs.readFileSync(path.join(root, relativePath), 'utf8'),
}));
const extendedContent = extendedSources.map(({ content }) => content).join('\n');

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
const predictionTable = extendedSources.find(({ relativePath }) => relativePath === 'components/PredictionTable.tsx').content;
const raceAnalysis = extendedSources.find(({ relativePath }) => relativePath === 'components/RaceAnalysis.tsx').content;
const articleBody = extendedSources.find(({ relativePath }) => relativePath === 'components/ArticleBody.tsx').content;
const mobileArticleThemes = extendedSources.find(({ relativePath }) => relativePath === 'components/MobileArticleThemeDirectory.tsx').content;
const entityArticleDocument = extendedSources.find(({ relativePath }) => relativePath === 'components/EntityArticleDocument.tsx').content;
const adSensePageLevel = extendedSources.find(({ relativePath }) => relativePath === 'components/AdSensePageLevelScript.tsx').content;
const articlesPage = sources.find(({ relativePath }) => relativePath === 'app/articles/page.tsx').content;
const raceJumpNav = sources.find(({ relativePath }) => relativePath === 'components/RacePageJumpNav.tsx').content;
const raceSelector = sources.find(({ relativePath }) => relativePath === 'components/RaceSelector.tsx').content;
const raceTabs = sources.find(({ relativePath }) => relativePath === 'components/RaceTabs.tsx').content;
const startPositionChart = extendedSources.find(({ relativePath }) => relativePath === 'components/StartPositionChart.tsx').content;

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
  {
    id: 'extended-no-transition-all',
    description: 'レース・記事・広告の追加監査対象にtransition-allがない',
    passed: !/\btransition-all\b/.test(extendedContent),
  },
  {
    id: 'extended-no-hover-motion',
    description: 'レース・記事の追加監査対象にhover拡大・移動がない',
    passed: !/(?:hover|group-hover|active):[^\s"'`]*(?:translate|scale)/.test(extendedContent),
  },
  {
    id: 'no-global-mobile-tailwind-rewrite',
    description: '全ページのTailwind余白を上書きするmobile-compact-scopeを使わない',
    passed: !globals.includes('mobile-compact-scope') && !layout.includes('mobile-compact-scope'),
  },
  {
    id: 'race-dedicated-table-styles',
    description: '予想表が汎用table/score/positionクラスへ依存しない',
    passed: predictionTable.includes('race-prediction-table')
      && !predictionTable.includes('className="table"')
      && !predictionTable.includes('className="score')
      && !predictionTable.includes(' position"'),
  },
  {
    id: 'race-analysis-full-accordion',
    description: 'AIレース展望全体が閉じたdetailsになっている',
    passed: raceAnalysis.includes('<details className="race-panel group overflow-hidden">')
      && !raceAnalysis.includes('analysis-preview')
      && !raceAnalysis.includes('section-title'),
  },
  {
    id: 'article-wide-layout',
    description: '記事本文を1080px紙面幅で表示する',
    passed: articleBody.includes('w-full max-w-none')
      && entityArticleDocument.includes('max-w-[1080px]'),
  },
  {
    id: 'mobile-article-theme-collapsed',
    description: 'モバイル記事テーマが初期状態で折りたたまれる',
    passed: mobileArticleThemes.includes('const [isOpen, setIsOpen] = useState(false)')
      && mobileArticleThemes.includes('{isOpen && <div id="mobile-article-theme-panel"'),
  },
  {
    id: 'grade-race-nested-accordion',
    description: '重賞テーマがグレード見出しと重賞一覧の二段階アコーディオンになっている',
    passed: articlesPage.includes('group/grade')
      && mobileArticleThemes.includes('group/grade')
      && articlesPage.includes('"jra-other": "その他"')
      && articlesPage.includes('"nar-other": "その他"'),
  },
  {
    id: 'race-selector-no-horizontal-rail',
    description: '1〜12Rを横スクロールに隠さず均等グリッドで表示する',
    passed: raceSelector.includes('gridTemplateColumns')
      && !raceSelector.includes('scrollIntoView')
      && !globals.includes('.race-selector {\n  padding: 4px;\n  display: flex'),
  },
  {
    id: 'desktop-analysis-sidebar',
    description: 'PC右側が同日レースの重複ではなく4分析ナビになっている',
    passed: raceTabs.includes('<RacePageJumpNav />')
      && !raceTabs.includes('同日レース')
      && raceJumpNav.includes('data-race-analysis-sidebar'),
  },
  {
    id: 'mobile-pace-chart-parity',
    description: 'スマホの展開・脚質もPCと同じ位置取りグラフを短い高さで使う',
    passed: startPositionChart.includes('height={128}')
      && startPositionChart.includes('<TrackView')
      && !startPositionChart.includes('grid grid-cols-3 gap-1.5 md:hidden'),
  },
  {
    id: 'article-switcher-height',
    description: '記事切り替えナビが52px以内で空列を描画しない',
    passed: entityArticleDocument.includes('h-[52px]')
      && entityArticleDocument.includes('if (!article) return null;'),
  },
  {
    id: 'adsense-scroll-recovery',
    description: 'Google広告UI終了後のoverflow/padding復旧監視がある',
    passed: adSensePageLevel.includes('hasVisibleGoogleDialog')
      && adSensePageLevel.includes('bodyPaddingTop')
      && adSensePageLevel.includes('MutationObserver'),
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
