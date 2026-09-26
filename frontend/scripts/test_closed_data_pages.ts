import assert from 'node:assert/strict';
import {
    CLOSED_DATA_ENTITY_TYPES,
    isClosedDataPath,
    linkableDataHref,
} from '../lib/closed-data-pages';

// 競走馬・調教師のページ（2026-09-26 に提供終了）は、一覧・個別・絶対URL・クエリ付きのどれでも閉じたと判定する
for (const url of [
    '/horses',
    '/horses/',
    '/horses/2022100001',
    '/horses/2022100001?utm_source=x',
    'https://uma-free.com/horses/2022100001',
    '/trainers',
    '/trainers/01234',
    '/trainers/01234#top',
]) {
    assert.equal(isClosedDataPath(url), true, url);
    assert.equal(linkableDataHref(url), null, url);
}

// 残すページ（騎手・コース・馬比較・レース）と、名前が似ているだけのパスは閉じない
for (const url of [
    '/jockeys/data/05339',
    '/jockeys',
    '/courses/tokyo/turf-1600m',
    '/compare',
    '/races/2026-09-27/nakayama/11',
    '/horses-guide',
    '/articles/horses',
]) {
    assert.equal(isClosedDataPath(url), false, url);
    assert.equal(linkableDataHref(url), url, url);
}

assert.equal(isClosedDataPath(null), false);
assert.equal(linkableDataHref(undefined), null);
assert.equal(linkableDataHref(''), null);
assert.deepEqual([...CLOSED_DATA_ENTITY_TYPES].sort(), ['horse', 'trainer']);

console.log('closed data pages: ok');
