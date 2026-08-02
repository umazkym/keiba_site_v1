import assert from 'node:assert/strict';
import { buildDatasetSchema } from '../lib/dataset-schema';


const common = {
    measurementTechnique: '過去レース結果の集計',
};

const rootDataset = buildDatasetSchema({
    ...common,
    name: 'UMA-FREE 競馬条件別成績',
    description: '中央・地方競馬の競走馬、騎手、調教師、競馬場・コースの成績を、出走数や集計期間とともに同じ条件で比較できる、UMA-FREEの無料競馬データセットです。',
    url: 'https://uma-free.com/keiba-data',
});
const horseDataset = buildDatasetSchema({
    ...common,
    name: 'テストホース 競走成績',
    description: 'テストホースの直近成績と、コース・距離・馬場状態ごとの成績、AI偏差値の推移を、対象走数と集計期間とともに確認できるUMA-FREEの競走馬データセットです。',
    url: 'https://uma-free.com/horses/test-horse',
    startDate: '2025-01-01',
    endDate: '2026-08-01',
});
const courseDataset = buildDatasetSchema({
    ...common,
    name: '中京ダート1800m 条件別成績',
    description: '中京ダート1800mの過去レースを対象に、枠順・脚質・騎手・調教師ごとの成績を集計し、対象期間とサンプル数を確認できるUMA-FREEの競馬コースデータセットです。',
    url: 'https://uma-free.com/courses/chukyo/dirt-1800m',
    startDate: '2021-01-01',
    endDate: '2026-08-01',
});

for (const dataset of [rootDataset, horseDataset, courseDataset]) {
    assert.equal(dataset['@type'], 'Dataset');
    assert.equal(dataset.creator.name, 'UMA-FREE');
    assert.equal(dataset.creator.url, 'https://uma-free.com');
    assert.equal(dataset.license, 'https://uma-free.com/terms');
    assert.equal(dataset.isAccessibleForFree, true);
    assert.match(dataset['@id'], /#dataset$/);
    assert.ok(dataset.description.length >= 50);
    assert.ok(dataset.description.length <= 5000);
}

assert.equal(rootDataset.temporalCoverage, undefined);
assert.equal(horseDataset.temporalCoverage, '2025-01-01/2026-08-01');
assert.equal(courseDataset.temporalCoverage, '2021-01-01/2026-08-01');

const invalidCoverage = buildDatasetSchema({
    ...common,
    name: '期間不明のテストデータ',
    description: '開始日または終了日が不正な場合に、不完全な期間文字列を出力しないことを確認するためのUMA-FREEテスト用競馬データセットです。',
    url: 'https://uma-free.com/test-dataset',
    startDate: '',
    endDate: '2026-08-01',
});
assert.equal('temporalCoverage' in invalidCoverage, false);
assert.throws(
    () => buildDatasetSchema({
        ...common,
        name: '短い説明のテスト',
        description: '短すぎる説明',
        url: 'https://uma-free.com/test-short-description',
    }),
    /50〜5000文字/,
);

console.log('Dataset構造化データ: 3ページ種別と入力ガードの検証に成功しました。');
