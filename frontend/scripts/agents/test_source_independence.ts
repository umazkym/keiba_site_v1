import assert from 'node:assert/strict';
import { buildWriterFacingOrder, type WriteOrder } from './agent_writer';
import { checkSourceIndependence } from './seo_checker';

const order: WriteOrder = {
  target_keyword: '東京競馬場 コース分析',
  theme_cluster: 'course_venue',
  research_sources: [
    {
      source_url: 'https://news.netkeiba.com/example',
      source_name: 'news.netkeiba.com',
      source_type: 'trusted_media',
      fetched_at: '2026-07-21T00:00:00.000Z',
      title: '外部記事タイトル',
      allowed_claims: ['第三者の推奨馬はテストホース。'],
    },
  ],
  reference_data: {
    period: '2026',
    condition: '東京芝コース',
    sample_size: 1,
    source: '外部ニュースとUMA-FREE DB',
    source_cards: [
      {
        title: '外部記事タイトル',
        source_url: 'https://news.netkeiba.com/example',
        source_name: 'news.netkeiba.com',
        source_type: 'trusted_media',
        fetched_at: '2026-07-21T00:00:00.000Z',
        allowed_claims: ['第三者の推奨馬はテストホース。'],
      },
    ],
    external_research_query: 'netkeiba 東京競馬場 コラム',
    key_metrics: [
      {
        確認項目: '外部ソース',
        内容: 'https://news.netkeiba.com/example',
        出典種別: '信頼媒体',
      },
      {
        確認項目: 'UMA-FREE該当レース',
        内容: '2026-07-21 東京11R テスト競走',
        出典種別: '内部データ',
      },
    ],
    writer_evidence: {
      facts: [
        { text: '東京芝コースの直線距離は525.9メートル。', origin: 'official' },
        { text: '媒体の推奨馬はテストホース。', origin: 'uma_free' },
      ],
      metrics: [
        {
          label: 'UMA-FREE該当レース',
          value: '2026-07-21 東京11R テスト競走',
          origin: 'uma_free',
        },
      ],
      as_of: '2026-07-21T00:00:00.000Z',
    },
  },
};

const writerOrder = buildWriterFacingOrder(order);
const serialized = JSON.stringify(writerOrder);

assert.equal(writerOrder.research_sources, undefined);
assert.equal('source_cards' in writerOrder.reference_data, false);
assert.equal('external_research_query' in writerOrder.reference_data, false);
assert.equal(serialized.includes('netkeiba'), false);
assert.equal(serialized.includes('https://'), false);
assert.equal(serialized.includes('外部記事タイトル'), false);
assert.equal(serialized.includes('信頼媒体'), false);
assert.equal(serialized.includes('内部データ'), false);
assert.equal(serialized.includes('出典種別'), false);
assert.equal(serialized.includes('推奨馬'), false);
assert.equal(serialized.includes('東京芝コースの直線距離は525.9メートル。'), true);
assert.equal(serialized.includes('2026-07-21 東京11R テスト競走'), true);

const accepted = checkSourceIndependence(`---
title: 東京競馬場のコース分析
description: JRAのコース数値とUMA-FREE掲載データを使い、出馬表の確認順を整理します。
keywords:
  - 東京競馬場
category: コース分析
theme_cluster: course_venue
article_type: course_venue
---
JRAが公開するコース数値では、東京芝コースの直線距離は525.9メートルです。NARの開催情報も公式事実として確認できます。
`);
assert.equal(accepted.passed, true, accepted.errors.join('\n'));

const mediaDependent = checkSourceIndependence(`---
title: 外部記事を使った分析
description: netkeibaのコラムを紹介します。
keywords:
  - 競馬
category: 競馬ニュース
theme_cluster: news_context
article_type: news_context
---
日刊スポーツの推奨馬と陣営コメントを紹介します。
`);
assert.equal(mediaDependent.passed, false);
assert.ok(mediaDependent.errors.length >= 3);

const invalidNarCategory = checkSourceIndependence(`---
title: サンタアニタトロフィー2026の確認ポイント
description: 大井競馬場のダート1600mを確認します。
keywords:
  - 大井競馬場
category: 海外競馬
theme_cluster: race_update
article_type: race_update
---
大井競馬場で開催される重賞を確認します。
`);
assert.equal(invalidNarCategory.passed, false);
assert.ok(invalidNarCategory.errors.some(error => error.includes('NAR開催場')));

const malformedCopy = checkSourceIndependence(`---
title: 枠順発表前前の確認
description: 数字 of 強弱を整理します。
keywords:
  - 枠順
category: 重賞攻略
theme_cluster: race_update
article_type: race_update
---
ニュース後に確認します。
`);
assert.equal(malformedCopy.passed, false);
assert.ok(malformedCopy.errors.some(error => error.includes('同一語の連続')));
assert.ok(malformedCopy.errors.some(error => error.includes('英単語')));
assert.ok(malformedCopy.errors.some(error => error.includes('ニュース依存')));

console.log('[SourceIndependenceTest] 公式事実・UMA-FREE指標だけがWriterへ渡ることを確認しました。');
