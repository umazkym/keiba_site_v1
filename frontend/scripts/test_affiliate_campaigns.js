const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const frontendRoot = path.resolve(__dirname, '..');
const campaignSourcePath = path.join(frontendRoot, 'lib', 'affiliate-campaigns.ts');
const campaignSource = fs.readFileSync(campaignSourcePath, 'utf8');
const transpiledCampaigns = ts.transpileModule(campaignSource, {
    compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
    },
    fileName: campaignSourcePath,
});
const campaignModule = { exports: {} };
const executeCampaignModule = new Function(
    'exports',
    'require',
    'module',
    '__filename',
    '__dirname',
    transpiledCampaigns.outputText,
);
executeCampaignModule(
    campaignModule.exports,
    require,
    campaignModule,
    campaignSourcePath,
    path.dirname(campaignSourcePath),
);

const {
    getAffiliateCampaignsForContext,
    getRakutenKeibaAffiliateUrl,
    getRakutenKeibaPlacement,
    shouldShowRakutenKeibaHeader,
} = campaignModule.exports;

const CAMPAIGN_URL = 'https://ad2.trafficgate.net/t/r/77/1958/318200_397641';
const TOP_URL = 'https://ad2.trafficgate.net/t/r/14/1958/318200_397641';

const getCampaignIds = (context, raceType) => {
    return getAffiliateCampaignsForContext({
        context,
        raceType,
        rakutenMode: 'qualified_nar',
        now: new Date('2026-08-01T00:00:00+09:00'),
    }).map((campaign) => campaign.id);
};

assert.deepEqual(
    getCampaignIds('race_after_prediction', 'nar'),
    ['rakuten-keiba-qualified-nar-race'],
    '地方競馬のAI偏差値表直後では適格化キャンペーンだけを抽出する',
);
assert.deepEqual(
    getCampaignIds('home_nar_voting', 'nar'),
    ['rakuten-keiba-qualified-nar-home'],
    'ホームの地方競馬開催一覧直後では適格化キャンペーンだけを抽出する',
);
assert.deepEqual(
    getCampaignIds('race_after_prediction', 'jra'),
    [],
    'JRAのAI偏差値表直後では楽天競馬を表示しない',
);
assert.deepEqual(
    getCampaignIds('race_top_nar', 'nar'),
    ['rakuten-keiba-qualified-nar-race-top'],
    '地方競馬の予想表の上では1行の帯だけを抽出する',
);
assert.deepEqual(
    getCampaignIds('race_top_nar', 'jra'),
    [],
    'JRAの予想表の上には楽天競馬を表示しない',
);
assert.deepEqual(
    getAffiliateCampaignsForContext({ context: 'race_top_nar', raceType: 'nar', rakutenMode: 'legacy' }).map((campaign) => campaign.id),
    [],
    'レガシーモードでは予想表の上の帯を表示しない',
);
assert.deepEqual(
    getCampaignIds('race_after_top_hits', 'nar'),
    [],
    '日別ページ下部の重複枠では楽天競馬を表示しない',
);
assert.equal(
    shouldShowRakutenKeibaHeader('qualified_nar'),
    false,
    '適格化モードではサイト共通ヘッダーの楽天競馬導線を表示しない',
);
assert.equal(
    shouldShowRakutenKeibaHeader('legacy'),
    true,
    '既定のレガシーモードでは現行ヘッダー導線を維持する',
);

assert.equal(getRakutenKeibaPlacement('home_nar_voting', 'nar'), 'home_nar_voting');
assert.equal(getRakutenKeibaPlacement('race_after_prediction', 'nar'), 'race_after_prediction_nar');
assert.equal(getRakutenKeibaPlacement('race_after_prediction', 'jra'), 'race_after_prediction_jra');
assert.equal(getRakutenKeibaPlacement('race_after_top_hits', 'nar'), 'race_after_top_hits');
assert.equal(getRakutenKeibaPlacement('race_top_nar', 'nar'), 'race_after_prediction_nar');

// 地方の2か所はキャンペーンの文言なので、変数が空でもキャンペーンのページ（ID 77）へ飛ばす。ほかは今までのトップ（ID 14）
assert.equal(getRakutenKeibaAffiliateUrl('race_after_prediction', 'nar'), CAMPAIGN_URL);
assert.equal(getRakutenKeibaAffiliateUrl('race_top_nar', 'nar'), CAMPAIGN_URL);
assert.equal(getRakutenKeibaAffiliateUrl('home_nar_voting', 'nar'), CAMPAIGN_URL);
assert.equal(getRakutenKeibaAffiliateUrl('site_header'), TOP_URL);
assert.equal(getRakutenKeibaAffiliateUrl('race_after_prediction', 'jra'), TOP_URL);

const qualifiedRace = getAffiliateCampaignsForContext({
    context: 'race_after_prediction',
    raceType: 'nar',
    rakutenMode: 'qualified_nar',
})[0];
assert.equal(qualifiedRace.title, '新規登録キャンペーン実施中');
assert.equal(
    qualifiedRace.description,
    'はじめて登録する方が対象（要エントリー）。地方競馬の全場に対応。登録には楽天銀行の口座が必要です。',
);
assert.equal(qualifiedRace.links[0].label, 'キャンペーンを見る');
assert.equal(qualifiedRace.links[0].url, CAMPAIGN_URL);
assert.equal(
    qualifiedRace.attention,
    '※馬券の購入は20歳以上の方のみ対象です。',
);
assert.equal(qualifiedRace.ctaOnly, true);
assert.equal(qualifiedRace.showDescription, true);

const qualifiedHome = getAffiliateCampaignsForContext({
    context: 'home_nar_voting',
    raceType: 'nar',
    rakutenMode: 'qualified_nar',
})[0];
assert.equal(qualifiedHome.title, qualifiedRace.title);
assert.equal(qualifiedHome.description, qualifiedRace.description);
assert.equal(qualifiedHome.links[0].label, qualifiedRace.links[0].label);
assert.equal(qualifiedHome.attention, qualifiedRace.attention);
assert.equal(qualifiedHome.ctaOnly, true);

const qualifiedRaceTop = getAffiliateCampaignsForContext({
    context: 'race_top_nar',
    raceType: 'nar',
    rakutenMode: 'qualified_nar',
})[0];
assert.equal(qualifiedRaceTop.title, '楽天競馬の新規登録キャンペーン');
assert.equal(qualifiedRaceTop.attention, 'はじめて登録する方が対象・20歳以上');
assert.equal(qualifiedRaceTop.ctaOnly, true);
assert.equal(qualifiedRaceTop.links.length, 1);

const slotSource = fs.readFileSync(
    path.join(frontendRoot, 'components', 'AffiliateSlot.tsx'),
    'utf8',
);
assert.match(slotSource, /const wholeSlotLink = !campaign\.ctaOnly/);
assert.match(slotSource, /campaign\.ctaOnly \? 'min-h-11'/);
assert.match(slotSource, /campaign\.showDescription && campaign\.description/);
assert.match(slotSource, /rel="sponsored nofollow noopener noreferrer"/);
// 1行の帯：帯そのものが44px以上のリンク・PR の表示・年齢の注記
assert.match(slotSource, /if \(variant === 'line'\)/);
assert.match(slotSource, /className="flex min-h-11 items-center/);
assert.match(slotSource, /campaign\.attention && \(\s*<span className="block truncate text-\[11px\]/);
const raceTabsSource = fs.readFileSync(
    path.join(frontendRoot, 'components', 'RaceTabs.tsx'),
    'utf8',
);
assert.ok(
    raceTabsSource.indexOf('context="race_top_nar"') > -1
        && raceTabsSource.indexOf('context="race_top_nar"') < raceTabsSource.indexOf('id="race-prediction-section"'),
    '予想表の上の帯は、予想表の前に1つだけ置く',
);
assert.ok(
    raceTabsSource.indexOf('data-race-selector-sticky') < raceTabsSource.indexOf('context="race_top_nar"'),
    '帯は追従するレースの切替の外（後ろ）に置く',
);

// 外へのリンク先はサーバーのHTMLに載せない（巡回ロボットが TrafficGate のクリックの約8割だったため。2026-09-26）
assert.match(slotSource, /const hydrated = useHydrated\(\)/);
assert.doesNotMatch(slotSource, /href=\{resolvedLinks\[/);
const headerSource = fs.readFileSync(
    path.join(frontendRoot, 'components', 'Header.tsx'),
    'utf8',
);
assert.match(headerSource, /href=\{hydrated \? getRakutenKeibaAffiliateUrl\('site_header'\) : undefined\}/);

console.log('楽天競馬アフィリエイトの配置・CTA回帰テストに成功しました。');
