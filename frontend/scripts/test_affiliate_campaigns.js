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
    getRakutenKeibaPlacement,
    shouldShowRakutenKeibaHeader,
} = campaignModule.exports;

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

const qualifiedRace = getAffiliateCampaignsForContext({
    context: 'race_after_prediction',
    raceType: 'nar',
    rakutenMode: 'qualified_nar',
})[0];
assert.equal(qualifiedRace.title, '馬券を買うたびに楽天ポイントが貯まる！');
assert.equal(
    qualifiedRace.description,
    '地方競馬全場に対応。投票会員登録には楽天会員情報と銀行口座の登録が必要です。',
);
assert.equal(qualifiedRace.links[0].label, '新規投票会員登録の案内を見る');
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

const slotSource = fs.readFileSync(
    path.join(frontendRoot, 'components', 'AffiliateSlot.tsx'),
    'utf8',
);
assert.match(slotSource, /const wholeSlotLink = !campaign\.ctaOnly/);
assert.match(slotSource, /campaign\.ctaOnly \? 'min-h-11'/);
assert.match(slotSource, /campaign\.showDescription && campaign\.description/);
assert.match(slotSource, /rel="sponsored nofollow noopener noreferrer"/);

console.log('楽天競馬アフィリエイトの配置・CTA回帰テストに成功しました。');
