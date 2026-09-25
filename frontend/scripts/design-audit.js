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
  'components/HomeStickyRaceCta.tsx',
  'components/RaceAnalysisValueGrid.tsx',
  'components/RecentRaceReturn.tsx',
  'components/WeeklyGradeRaces.tsx',
  'components/RacePageClient.tsx',
  'components/RacePageJumpNav.tsx',
  'components/RacePageBottomNav.tsx',
  'components/RaceSelector.tsx',
  'components/RaceTabs.tsx',
  'hooks/useRaceSectionNavigation.ts',
  'lib/google-ad-overlay.ts',
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
  'components/DisclaimerNote.tsx',
  'components/MobileArticleThemeDirectory.tsx',
  'components/EntityArticleDocument.tsx',
  'components/ArticleBody.tsx',
  'components/ResponsiveDataTable.tsx',
  'components/SectionHeader.tsx',
  'components/AdSensePageLevelScript.tsx',
  'lib/page-scroll-lock.ts',
];
const extendedSources = extendedTargetFiles.map((relativePath) => ({
  relativePath,
  content: fs.readFileSync(path.join(root, relativePath), 'utf8'),
}));
const extendedContent = extendedSources.map(({ content }) => content).join('\n');

const dataTargetFiles = [
  'app/keiba-data/page.tsx',
  'app/compare/HorseCompareClient.tsx',
  'app/my-data/MyDataClient.tsx',
  'components/CourseDataDetailView.tsx',
  'components/CourseDirectoryView.tsx',
  'components/DataDirectoryView.tsx',
  'components/DataEntityDetailView.tsx',
  'components/DataHubActionLink.tsx',
  'components/DataHubNav.tsx',
  'components/DataSearchPanel.tsx',
  'components/DataStats.tsx',
  'components/PricingInterestSurvey.tsx',
  'components/RaceConditionComparison.tsx',
  'components/UpcomingRaceTrackedLink.tsx',
];
const dataSources = dataTargetFiles.map((relativePath) => {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`データ画面の監査対象が見つかりません: ${relativePath}`);
  }
  return {
    relativePath,
    content: fs.readFileSync(absolutePath, 'utf8'),
  };
});
const dataContent = dataSources.map(({ content }) => content).join('\n');

const countMatches = (content, pattern) => Array.from(content.matchAll(pattern)).length;

// 全画面の走査（ブランド色と文字サイズの検査に使う）
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const absolutePath = path.join(dir, entry.name);
  if (entry.isDirectory()) return walk(absolutePath);
  return /\.(tsx?|css)$/.test(entry.name) ? [absolutePath] : [];
});
const allSources = ['app', 'components', 'lib', 'hooks']
  .flatMap((dir) => walk(path.join(root, dir)))
  .map((absolutePath) => ({
    relativePath: path.relative(root, absolutePath).split(path.sep).join('/'),
    content: fs.readFileSync(absolutePath, 'utf8'),
  }));
const repoRoot = path.resolve(root, '..');
const readRepoFile = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

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

// 全画面に対する上限。数を増やさない（段階ごとに減らし、減らしたら max も下げる）
const siteWideRules = [
  {
    id: 'raw-blue-utility',
    description: 'Tailwindのblue-*（ブランド色はbrand-*、4枠の青はwaku-4）',
    pattern: /(?<=-)blue-(?:50|100|200|300|400|500|600|700|800|900|950)\b/g,
    max: 0,
    rationale: 'ロゴのインディゴ（brand）と枠色（waku）を混ぜない',
  },
  {
    id: 'tiny-text',
    description: '11px未満の文字（text-[8px]〜text-[10.5px]）',
    pattern: /\btext-\[(?:8|8\.5|9|9\.5|10|10\.5)px\]/g,
    max: 19,
    rationale: '段階0で130件、段階1（共通の枠）で122件、段階2（レース画面）で91件、段階3（ホーム）で69件、段階5（記事・データ）で19件へ。残りは広告のPR表記・対戦表の中・4つの視点の小さな図だけ',
  },
];
const siteWideResults = siteWideRules.map((rule) => {
  const locations = allSources
    .map(({ relativePath, content }) => ({ relativePath, count: countMatches(content, rule.pattern) }))
    .filter(({ count }) => count > 0);
  const count = locations.reduce((sum, item) => sum + item.count, 0);
  return { ...rule, count, locations, passed: count <= rule.max };
});

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
const articleDetailPage = sources.find(({ relativePath }) => relativePath === 'app/articles/[slug]/page.tsx').content;
const raceJumpNav = sources.find(({ relativePath }) => relativePath === 'components/RacePageJumpNav.tsx').content;
const raceSelector = sources.find(({ relativePath }) => relativePath === 'components/RaceSelector.tsx').content;
const raceTabs = sources.find(({ relativePath }) => relativePath === 'components/RaceTabs.tsx').content;
const startPositionChart = extendedSources.find(({ relativePath }) => relativePath === 'components/StartPositionChart.tsx').content;
const header = sources.find(({ relativePath }) => relativePath === 'components/Header.tsx').content;
const homeStickyCta = sources.find(({ relativePath }) => relativePath === 'components/HomeStickyRaceCta.tsx').content;
const googleAdOverlay = sources.find(({ relativePath }) => relativePath === 'lib/google-ad-overlay.ts').content;
const dataHubPage = dataSources.find(({ relativePath }) => relativePath === 'app/keiba-data/page.tsx').content;
const dataHubNav = dataSources.find(({ relativePath }) => relativePath === 'components/DataHubNav.tsx').content;
const horseCompare = dataSources.find(({ relativePath }) => relativePath === 'app/compare/HorseCompareClient.tsx').content;
const dataStats = dataSources.find(({ relativePath }) => relativePath === 'components/DataStats.tsx').content;
const responsiveDataTable = extendedSources.find(({ relativePath }) => relativePath === 'components/ResponsiveDataTable.tsx').content;

const brandTokenFiles = [
  'frontend/tailwind.config.ts',
  'frontend/app/globals.css',
  'frontend/lib/brand.ts',
  'backend/scripts/brand_tokens.py',
].map((relativePath) => ({ relativePath, content: readRepoFile(relativePath) }));

const readFrontendFile = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const footer = readFrontendFile('components/Footer.tsx');
const notFoundPage = readFrontendFile('app/not-found.tsx');
const errorPage = readFrontendFile('app/error.tsx');
const racesDatePage = readFrontendFile('app/races/[date]/page.tsx');
const courseShapes = readFrontendFile('lib/course-shapes.ts');

const checks = [
  {
    id: 'no-global-mobile-heading-cap',
    description: 'スマホの見出しを一律15px前後に押さえ込む!important指定を置かない（各画面のクラスで決める）',
    // 行頭（インデント4つ）の素の h1 規則だけを見る。.race-page-scope など scope 付きの規格は対象外
    passed: !/\n {4}h1 \{\n {8}font-size: [0-9.]+px !important;/.test(globals),
  },
  {
    id: 'shell-footer-brand',
    description: 'フッターが夜の紺の面に横組みロゴと20歳未満の注意を置く',
    passed: footer.includes('bg-night')
      && footer.includes('<BrandLockup')
      && footer.includes('20歳'),
  },
  {
    id: 'shell-guide-horse-states',
    description: '404とエラー画面が案内役の馬と次に押す場所を持つ',
    passed: notFoundPage.includes('<GuideHorse')
      && notFoundPage.includes('action="/search"')
      && errorPage.includes('<GuideHorse')
      && errorPage.includes('ui-btn--primary'),
  },
  {
    id: 'shell-unified-buttons',
    description: 'ボタンがui-btnの1系統で、旧来のボタン名も主ボタンの色にそろう',
    passed: globals.includes('.ui-btn--primary')
      && globals.includes('.ui-btn--secondary')
      && /\.btn-primary \{\s+@apply[^;]*bg-brand-600/.test(globals)
      && /\.recent-return-primary \{\s+@apply[^;]*bg-brand-600/.test(globals),
  },
  {
    id: 'brand-tokens-in-sync',
    description: 'ブランド色（#4C4EFF・#1C2787・#0E1440）がtailwind・CSS・lib/brand.ts・Pythonで同じ',
    passed: brandTokenFiles.every(({ content }) => ['#4C4EFF', '#1C2787', '#0E1440'].every((hex) => content.toUpperCase().includes(hex))),
  },
  {
    id: 'brand-fonts-loaded',
    description: '見出しと数字の書体をnext/fontで読み込み、本文は端末の書体（日本語の本文書体は配信しない）',
    passed: layout.includes("from \"next/font/google\"")
      && ['--font-display', '--font-num'].every((name) => layout.includes(name))
      && !layout.includes('Noto_Sans_JP')
      && globals.includes('--font-body: "Hiragino Sans"'),
  },
  {
    id: 'waku-single-source',
    description: '枠色の定義がlib/waku.tsの1か所にまとまっている',
    passed: allSources.filter(({ relativePath, content }) => relativePath !== 'lib/waku.ts'
      && /(?:case 4|4:)\s*(?:return\s*)?['"`][^'"`]*bg-(?:blue|brand)-6/.test(content)).length === 0,
  },
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
    description: 'レース内スクロールが動きの削減設定を尊重し、レース詳細は読み込み時に自動でスクロールしない（見出しを画面の外へ送らない。2026-09-25）',
    passed: raceNavigation.includes("matchMedia('(prefers-reduced-motion: reduce)')")
      && !racePageClient.includes('window.scrollTo(')
      && !racePageClient.includes('hasScrolled'),
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
    description: '記事を1080px紙面、通常本文を760pxで表示する',
    passed: articleBody.includes('w-full max-w-none')
      && articleDetailPage.includes('site-shell-article')
      && entityArticleDocument.includes('max-w-[1080px]')
      && globals.includes('max-width: 760px;')
      && globals.includes('max-width: 1080px;'),
  },
  {
    id: 'mobile-article-theme-collapsed',
    description: 'モバイル記事テーマが初期状態で折りたたまれる',
    passed: mobileArticleThemes.includes('const [isOpen, setIsOpen] = useState(false)')
      && mobileArticleThemes.includes('{isOpen && <div id="mobile-article-theme-panel"'),
  },
  {
    id: 'course-venue-nested-accordion',
    description: 'コーステーマが競馬場から各コースを開く二段階構造になっている',
    passed: articlesPage.includes('groupCourseArchivesByVenue')
      && mobileArticleThemes.includes('group/venue')
      && mobileArticleThemes.includes('courseSections'),
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
    id: 'race-selector-height-budget',
    description: 'レース要約と1〜12Rのsticky面が88px以内で重複要約を持たない',
    passed: raceTabs.includes('max-h-[88px]')
      && !raceTabs.includes('ml-7 mt-0.5 text-[11px] font-medium'),
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
    id: 'header-stable-fixed-policy',
    description: '全画面幅でヘッダーを固定し、広告やスクロールで位置を変えない',
    passed: header.includes('data-site-header-visible="true"')
      && !header.includes('nextScrollY')
      && !header.includes("window.addEventListener('scroll'")
      && globals.includes('.site-header-spacer')
      && globals.includes('position: fixed;')
      && globals.includes('top: var(--site-header-top-gap);'),
  },
  {
    id: 'header-stable-ad-control-gap',
    description: '上部広告の全高と最大32pxの操作部予約高を分離する',
    passed: googleAdOverlay.includes('topAnchorControlHeight')
      && adSensePageLevel.includes('TOP_ANCHOR_CONTROL_MAX_HEIGHT = 32')
      && header.includes('overlay.topAnchorControlHeight')
      && header.includes('DESKTOP_HEADER_TOP_GAP = 32')
      && raceNavigation.includes('getBoundingClientRect().bottom'),
  },
  {
    id: 'home-persistent-cta',
    description: '全画面幅でホームCTAが広告高やスクロールに追従しない',
    passed: homeStickyCta.includes('className="home-sticky-race-cta"')
      && !homeStickyCta.includes('bottomAnchorHeight')
      && !homeStickyCta.includes('data-home-primary-race-cta')
      && !homeStickyCta.includes("window.addEventListener('scroll'")
      && globals.includes('bottom: calc(env(safe-area-inset-bottom, 0px) + var(--safari-bottom-offset, 0px));'),
  },
  {
    id: 'header-tablet-menu-breakpoint',
    description: '768pxではメニュー、1024px以上では主要ナビを表示して横はみ出しを防ぐ',
    passed: header.includes('hidden lg:flex items-center')
      && header.includes('lg:hidden')
      && !header.includes('hidden md:flex items-center'),
  },
  {
    id: 'mobile-race-readable-type',
    description: '640px未満のレース画面で見出しを一律15px・14pxに押さえ込まず、セクション見出し17px・本文13pxの専用scopeを持つ（2026-09-24 段階2）',
    passed: globals.includes('.race-page-scope .race-section-heading,')
      && globals.includes('.race-page-scope .ui-section-header__title')
      && !globals.includes('.race-page-scope :is(h1, h2, h3, h4, h5, h6)')
      && /\.race-page-scope \.race-section-heading \{\s+gap: 6px;\s+font-size: 17px;/.test(globals),
  },
  {
    id: 'race-analysis-bug-fixes',
    description: 'AIレース展望の先行判定がレース内の相対値で、馬番の有利不利を出走馬だけで比べ「枠」と呼ばない',
    passed: raceAnalysis.includes('getPositionLabels(race.predictions)')
      && !raceAnalysis.includes('start_1c_indicator > 0')
      && raceAnalysis.includes('runnerNumbers.has(item.horse_number)')
      && !raceAnalysis.includes('waku_number === bestFrame')
      && !raceAnalysis.includes('オッズ妙味を判断'),
  },
  {
    id: 'race-day-board',
    description: '開催日ページが全馬データを送らない開催日ボードで、コース図のデータはサーバー専用',
    passed: racesDatePage.includes('<RaceDayBoard')
      && racesDatePage.includes('buildRaceDaySummary(')
      && !racesDatePage.includes('RacePageClient')
      && courseShapes.includes("import 'server-only';"),
  },
  {
    id: 'home-photo-entry',
    description: 'ホームが写真の入口（A×C）で、広告4枠・PR枠・ホームからの入口計測を保ち、注目馬をオッズの言葉で呼ばない（2026-09-25 段階3）',
    passed: (() => {
      const homePage = sources.find(({ relativePath }) => relativePath === 'app/page.tsx').content;
      const homeHero = fs.readFileSync(path.join(root, 'components/HomeHero.tsx'), 'utf8');
      const homeVenues = fs.readFileSync(path.join(root, 'components/HomeTodayVenues.tsx'), 'utf8');
      const pickSummary = fs.readFileSync(path.join(root, 'lib/home-page-summary.ts'), 'utf8')
        + fs.readFileSync(path.join(root, 'components/SpecialPickCard.tsx'), 'utf8');
      return homePage.includes('<HomeHero')
        && homeHero.includes('fetchPriority="high"')
        && homeHero.includes('home-hero-scrim')
        && homeHero.includes('entryMethod="hero_cta"')
        && ['home_after_today_races', 'home_after_today_pick', 'home_article_feed_1', 'home_after_special_pick']
          .every((placement) => homePage.includes(`analyticsPlacement="${placement}"`))
        && homePage.includes('entryMethod="grade_fallback"')
        && homeVenues.includes("entry_method: 'venue_card'")
        && homeVenues.includes('home_nar_voting')
        && globals.includes('.home-hero-scrim')
        && !pickSummary.includes('オッズ妙味');
    })(),
  },
  {
    id: 'mobile-article-readable-type',
    description: '記事の本文はスマホ15.5px・PC17px、H2はスマホ20px・PC25px、H3はスマホ17px（2026-09-25 段階5。スマホで12px・16pxに押さえ込む !important を置かない）',
    passed: articleBody.includes('prose-p:text-[15.5px]')
      && articleBody.includes('sm:prose-p:text-[17px]')
      && articleBody.includes('prose-h2:text-[20px]')
      && articleBody.includes('sm:prose-h2:text-[25px]')
      && articleBody.includes('prose-h3:text-[17px]')
      && !/\.article-page-prose[^{]*\{[^}]*font-size: 1[26]px !important/.test(globals)
      && !globals.includes('.article-page-lead {'),
  },
  {
    id: 'article-reading-aids',
    description: '記事が目次・カテゴリと日付・冒頭の写真を持ち、OG画像を題名入りのブランドの画像にしている（段階5）',
    passed: (() => {
      const parts = fs.readFileSync(path.join(root, 'components/ArticleParts.tsx'), 'utf8');
      const ogRoute = fs.readFileSync(path.join(root, 'app/og/[slug]/route.tsx'), 'utf8');
      const nextConfig = fs.readFileSync(path.join(root, 'next.config.mjs'), 'utf8');
      return articleDetailPage.includes('<ArticleToc')
        && articleDetailPage.includes('<ArticleMetaRow')
        && articleDetailPage.includes('<ArticleCover')
        && entityArticleDocument.includes('<ArticleToc')
        && parts.includes('この記事で確認できること')
        && articleDetailPage.includes('/og/${encodeURIComponent(params.slug)}.png')
        && ogRoute.includes("from 'next/og'")
        && ogRoute.includes('MPLUSRounded1c-ExtraBold.ttf')
        && !ogRoute.includes("from 'sharp'")
        && nextConfig.includes("'/og/**'")
        && fs.existsSync(path.join(root, 'assets/fonts/MPLUSRounded1c-ExtraBold.ttf'));
    })(),
  },
  {
    id: 'data-pages-light-head',
    description: 'データベースの画面が紺の面の15px見出しではなく白い紙面の見出し（DataPageHead）を使う（段階5）',
    passed: (() => {
      const files = ['app/keiba-data/page.tsx', 'components/DataDirectoryView.tsx', 'components/CourseDirectoryView.tsx', 'app/my-data/MyDataClient.tsx', 'app/compare/HorseCompareClient.tsx']
        .map((relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8'));
      return files.every((content) => content.includes('<DataPageHead') && !content.includes('border-slate-800 bg-slate-900'));
    })(),
  },
  {
    id: 'mobile-layer-cleanup',
    description: 'ヘッダーを不透明にし（本文がロゴの後ろに透けない）、レース詳細に別レースの注目馬と黄色の免責帯を挟まず、免責は出走表の直後の1文にする。ナビの名前はレース画面の見出しと同じ（2026-09-25）',
    passed: (() => {
      const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
      const raceTabs = read('components/RaceTabs.tsx');
      const raceDayExtras = read('components/RaceDayExtras.tsx');
      const valueGrid = read('components/RaceAnalysisValueGrid.tsx');
      const glassRule = globals.match(/\.glass \{[^}]*\}/);
      return Boolean(glassRule)
        && !/bg-white\/\d+|backdrop-blur/.test(glassRule[0])
        && !racePageClient.includes('SpecialPickCard')
        && !racePageClient.includes('DisclaimerAlert')
        && raceTabs.includes('<DisclaimerNote')
        && raceDayExtras.includes('<DisclaimerNote')
        && raceDayExtras.includes('race-day-pick-heading')
        && !fs.existsSync(path.join(root, 'components/DisclaimerAlert.tsx'))
        && !valueGrid.includes("compactTitle: '対戦比較'")
        && !valueGrid.includes("compactTitle: '馬番傾向'");
    })(),
  },
  {
    id: 'article-top-switcher-removed',
    description: '省略表示ばかりになる記事上部の前後ナビを置かない',
    passed: !entityArticleDocument.includes('ArticleThemeNavigator')
      && !entityArticleDocument.includes('前の記事'),
  },
  {
    id: 'adsense-scroll-recovery',
    description: 'Google広告UI終了後のoverflow復旧を監視し、Google管理paddingを上書きしない',
    passed: adSensePageLevel.includes('hasVisibleGoogleDialog')
      && adSensePageLevel.includes('baseline.bodyOverflow')
      && adSensePageLevel.includes('MutationObserver')
      && !adSensePageLevel.includes('document.body.style.paddingTop ='),
  },
  {
    id: 'data-pages-no-prohibited-decoration',
    description: 'データ画面群に禁止モーション・装飾グラデーション・絵文字・広い影がない',
    passed: !/\btransition-all\b/.test(dataContent)
      && !/(?:hover|group-hover|active):[^\s"'`]*(?:translate|scale)/.test(dataContent)
      && !/\bbg-gradient-(?:to-[tblr]{1,2}|radial|conic)\b/.test(dataContent)
      && !/[👑✨🔥🏇]/u.test(dataContent)
      && !/\bshadow-(?:sm|md|lg|xl|2xl|3xl)\b/.test(dataContent)
      && !/\brounded-2xl\b/.test(dataContent),
  },
  {
    id: 'data-nav-visible-mobile-grid',
    description: 'データナビが主操作3列・分類4列でモバイルにも全項目を表示する',
    passed: dataHubNav.includes("'grid-cols-3'")
      && dataHubNav.includes("'grid-cols-4'")
      && !dataHubNav.includes('overflow-x-auto'),
  },
  {
    id: 'data-hub-concrete-value-copy',
    description: 'データトップが同条件・出走数を具体的に説明する',
    passed: dataHubPage.includes('競走馬・騎手・コースを同じ条件で比較')
      && dataHubPage.includes('勝率・3着以内率を出走数と一緒に確認できます。'),
  },
  {
    id: 'horse-comparison-sample-contract',
    description: '比較画面が通算順位を避け、母数区分とWilson下限値を明示する',
    passed: horseCompare.includes('条件が異なるため順位付けは行いません')
      && horseCompare.includes('少数データ')
      && horseCompare.includes('参考値')
      && horseCompare.includes('比較対象')
      && horseCompare.includes('Wilson下限')
      && !horseCompare.includes('BEST'),
  },
  {
    id: 'mobile-horse-comparison-switcher',
    description: 'モバイル比較が3区分の切替と選択馬sticky要約を持つ',
    passed: horseCompare.includes("type ComparisonView = 'overall' | 'matched' | 'recent'")
      && horseCompare.includes('comparison-view-switcher')
      && horseCompare.includes('compare-selected-summary')
      && horseCompare.includes('aria-controls={`${view}-comparison-panel`}'),
  },
  {
    id: 'data-table-sticky-first-column',
    description: '条件表と比較表がキーボード操作可能な表内スクロールと先頭列固定を使う',
    passed: responsiveDataTable.includes('tabIndex={0}')
      && globals.includes('.responsive-data-table--sticky-first')
      && globals.includes('position: sticky;')
      && dataStats.includes('<ResponsiveDataTable')
      && horseCompare.includes('<ResponsiveDataTable'),
  },
];

console.log('UMA-FREE design audit');
for (const result of [...siteWideResults, ...results]) {
  const status = result.passed ? 'PASS' : 'FAIL';
  const shown = result.locations.slice(0, 6).map(({ relativePath, count }) => `${relativePath}:${count}`);
  if (result.locations.length > 6) shown.push(`ほか${result.locations.length - 6}ファイル`);
  const locationText = shown.length > 0 ? ` (${shown.join(', ')})` : '';
  console.log(`${status} ${result.id}: ${result.count}/${result.max}${locationText}`);
  console.log(`     ${result.rationale}`);
}
for (const check of checks) {
  console.log(`${check.passed ? 'PASS' : 'FAIL'} ${check.id}: ${check.description}`);
}

const failed = [...siteWideResults, ...results].some((result) => !result.passed) || checks.some((check) => !check.passed);
if (failed) {
  console.error('デザイン監査に失敗しました。DESIGN.mdの基準と例外上限を確認してください。');
  process.exitCode = 1;
} else {
  console.log('デザイン監査に合格しました。');
}
