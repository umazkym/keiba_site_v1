import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArticleRaceBridge } from '../../components/ArticleRaceBridge';
import { shouldRenderArticleRaceBridge, type ArticleRaceBridgeMetadata } from '../../lib/article-race-bridge';
import type { ArticleRacePreviewResponse } from '../../lib/types';

const metadata: ArticleRaceBridgeMetadata = {
  enabled: true,
  entityType: 'grade_race',
  raceName: 'マーキュリーカップ',
  scheduledRaceDate: '2026-07-20',
  seasonYear: 2026,
  raceId: 'race-20260720-morioka-12',
  raceUrl: '/races/2026-07-20/morioka/12',
};

const available: ArticleRacePreviewResponse = {
  status: 'available',
  race: {
    id: 'race-20260720-morioka-12',
    race_date: '2026-07-20',
    venue_name: '盛岡',
    race_number: 12,
    race_name: 'マーキュリーカップ',
    course_type: 'ダ',
    distance: 2000,
    race_url: '/races/2026-07-20/morioka/12',
  },
  top_predictions: [
    { horse_number: 1, horse_name: 'テストホース', deviation_score: 70.1, mark: '◎' },
  ],
  as_of: '2026-07-20T01:00:00Z',
};

assert.equal(shouldRenderArticleRaceBridge({ ...metadata, enabled: false }, available), false);
assert.equal(shouldRenderArticleRaceBridge({ ...metadata, raceId: undefined }, available), false);
assert.equal(shouldRenderArticleRaceBridge({ ...metadata, raceUrl: '/races/today' }, available), false);
assert.equal(shouldRenderArticleRaceBridge({ ...metadata, seasonYear: 2025 }, available), false);
assert.equal(shouldRenderArticleRaceBridge(metadata, available), true);
assert.equal(shouldRenderArticleRaceBridge(metadata, { ...available, status: 'race_only', top_predictions: [] }), false);
assert.equal(shouldRenderArticleRaceBridge(metadata, { ...available, status: 'not_found', race: null, top_predictions: [] }), false);
assert.equal(shouldRenderArticleRaceBridge(metadata, { ...available, race: { ...available.race!, id: 'other-race' } }), false);
assert.equal(shouldRenderArticleRaceBridge(metadata, null), true);

const commonBridgeProps = {
  articleSlug: 'mercury-cup-2026',
  articleCategory: '重賞攻略',
  raceId: metadata.raceId as string,
  raceName: metadata.raceName as string,
  raceDate: metadata.scheduledRaceDate as string,
  venueName: '盛岡',
  raceNumber: 12,
  raceUrl: metadata.raceUrl as string,
};
const availableHtml = renderToStaticMarkup(React.createElement(ArticleRaceBridge, {
  ...commonBridgeProps,
  preview: available,
}));
assert.match(availableHtml, /data-article-race-bridge/);
assert.match(availableHtml, /テストホース/);
assert.match(availableHtml, /href="\/races\/2026-07-20\/morioka\/12"/);

const metadataOnlyHtml = renderToStaticMarkup(React.createElement(ArticleRaceBridge, {
  ...commonBridgeProps,
  preview: null,
}));
assert.match(metadataOnlyHtml, /レースページで確認できます/);
assert.doesNotMatch(metadataOnlyHtml, /テストホース/);
assert.match(metadataOnlyHtml, /href="\/races\/2026-07-20\/morioka\/12"/);

console.log('article race bridge gate tests passed');
