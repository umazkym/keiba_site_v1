import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { collectAllowedWriterMetricTokens, type WriteOrder } from './agent_writer';
import { runPostWriterArticleFlow } from './article_flow';

const order: WriteOrder = {
  target_keyword: '阪神ダート1800m 騎手 データ',
  theme_cluster: 'jockey_data',
  reference_data: {
    period: '2023年1月〜2026年6月',
    condition: '阪神ダート1800m',
    sample_size: 42,
    key_metrics: [
      {
        騎手: 'テスト騎手',
        騎乗回数: 42,
        勝率: '12.3%',
        単勝回収率: '88%',
      },
    ],
  },
};

const allowedTokens = collectAllowedWriterMetricTokens(order);
assert.equal(allowedTokens.includes('12.3%'), true);
assert.equal(allowedTokens.includes('88%'), true);
assert.equal(allowedTokens.includes('1800m'), true);
assert.equal(allowedTokens.includes('10%'), false);

const frontmatter = `---
title: 阪神ダート1800mの騎手データ
description: 入力済みの騎手成績から確認順を整理します。
target_keyword: 阪神ダート1800m 騎手 データ
theme_cluster: jockey_data
---
`;

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'article-flow-numeric-'));
try {
  const acceptedPath = path.join(tempDir, 'accepted.md');
  fs.writeFileSync(
    acceptedPath,
    `${frontmatter}\nテスト騎手の勝率は12.3%、単勝回収率は88%で、阪神ダート1800mでは入力済みデータの範囲で比較する。\n`,
    'utf-8',
  );
  const accepted = runPostWriterArticleFlow(order, acceptedPath);
  assert.equal(accepted.status, 'APPROVED', accepted.log);
  assert.deepEqual(accepted.criticalIssues, []);

  const popularityOrder: WriteOrder = {
    target_keyword: '新潟ダート1800m 荒れる 傾向',
    theme_cluster: 'popularity_data',
    reference_data: {
      period: '2024年10月〜2026年9月',
      condition: '新潟ダート1800m 良〜不良',
      sample_size: 500,
      key_metrics: [
        { 人気: '1番人気', 勝率: '45.0%', 複勝率: '75.0%', 単勝回収率: '85%' },
        { 人気: '2番人気', 勝率: '25.0%', 複勝率: '55.0%', 単勝回収率: '80%' },
        { 人気: '3番人気', 勝率: '15.0%', 複勝率: '40.0%', 単勝回収率: '90%' },
        { 人気: '4番人気', 勝率: '8.0%', 複勝率: '25.0%', 単勝回収率: '70%' },
        { 人気: '5番人気', 勝率: '4.0%', 複勝率: '15.0%', 単勝回収率: '30%' },
      ],
    },
  };
  const popularityFrontmatter = `---
title: 新潟ダート1800mの人気別成績
description: 入力済みの人気別成績から確認順を整理します。
target_keyword: 新潟ダート1800m 荒れる 傾向
theme_cluster: popularity_data
---
`;
  const naturallySortedPath = path.join(tempDir, 'naturally-sorted-popularity.md');
  fs.writeFileSync(
    naturallySortedPath,
    `${popularityFrontmatter}
| 人気 | 勝率 | 複勝率 | 単勝回収率 |
| --- | ---: | ---: | ---: |
| 1番人気 | 45.0% | 75.0% | 85% |
| 2番人気 | 25.0% | 55.0% | 80% |
| 3番人気 | 15.0% | 40.0% | 90% |
| 4番人気 | 8.0% | 25.0% | 70% |
| 5番人気 | 4.0% | 15.0% | 30% |
`,
    'utf-8',
  );
  const naturallySorted = runPostWriterArticleFlow(popularityOrder, naturallySortedPath);
  assert.equal(naturallySorted.status, 'APPROVED', naturallySorted.log);
  assert.doesNotMatch(
    naturallySorted.criticalIssues.map(issue => issue.message).join('\n'),
    /numeric table may be synthetic/,
  );

  const syntheticOrder: WriteOrder = {
    target_keyword: '検証用コース データ',
    theme_cluster: 'asset',
    reference_data: {
      period: '2024年1月〜2026年8月',
      condition: '検証用コース',
      sample_size: 500,
      key_metrics: [
        { 区分: 'A', 勝率: '50%', 複勝率: '80%', 単勝回収率: '120%' },
        { 区分: 'B', 勝率: '40%', 複勝率: '70%', 単勝回収率: '110%' },
        { 区分: 'C', 勝率: '30%', 複勝率: '60%', 単勝回収率: '100%' },
        { 区分: 'D', 勝率: '20%', 複勝率: '50%', 単勝回収率: '90%' },
        { 区分: 'E', 勝率: '10%', 複勝率: '40%', 単勝回収率: '80%' },
      ],
    },
  };
  const syntheticFrontmatter = `---
title: 検証用コースのデータ
description: 入力済みデータの品質ゲートを検証します。
target_keyword: 検証用コース データ
theme_cluster: asset
---
`;
  const syntheticPath = path.join(tempDir, 'synthetic-table.md');
  fs.writeFileSync(
    syntheticPath,
    `${syntheticFrontmatter}
| 区分 | 勝率 | 複勝率 | 単勝回収率 |
| --- | ---: | ---: | ---: |
| A | 50% | 80% | 120% |
| B | 40% | 70% | 110% |
| C | 30% | 60% | 100% |
| D | 20% | 50% | 90% |
| E | 10% | 40% | 80% |
`,
    'utf-8',
  );
  const synthetic = runPostWriterArticleFlow(syntheticOrder, syntheticPath);
  assert.equal(synthetic.status, 'REJECTED', synthetic.log);
  assert.match(
    synthetic.criticalIssues.map(issue => issue.message).join('\n'),
    /numeric table may be synthetic: table 1: 3 percentage columns are strictly monotonic/,
  );

  const rejectedPath = path.join(tempDir, 'rejected.md');
  fs.writeFileSync(
    rejectedPath,
    `${frontmatter}\n勝率10%、複勝率0%、好走率100%というコラムの見方を使う。\n`,
    'utf-8',
  );
  const rejected = runPostWriterArticleFlow(order, rejectedPath);
  assert.equal(rejected.status, 'REJECTED');
  const messages = rejected.criticalIssues.map(issue => issue.message).join('\n');
  assert.match(messages, /10%/);
  assert.match(messages, /0%/);
  assert.match(messages, /100%/);
  assert.match(rejected.log, /コラム/);

  const unitMismatchPath = path.join(tempDir, 'unit-mismatch.md');
  fs.writeFileSync(
    unitMismatchPath,
    `${frontmatter}\n入力に単位なしの10があっても、勝率10%へ換算してはいけない。\n`,
    'utf-8',
  );
  const unitMismatch = runPostWriterArticleFlow(order, unitMismatchPath);
  assert.equal(unitMismatch.status, 'REJECTED');
  assert.match(unitMismatch.criticalIssues.map(issue => issue.message).join('\n'), /10%/);

  const failureFixtures: Array<{ name: string; order: WriteOrder; forbidden: string; sentence: string }> = [
    {
      name: 'jockey',
      order,
      forbidden: '10%',
      sentence: '対象騎手は3回走れば2回以上という見方から、勝率10%として扱う。',
    },
    {
      name: 'hanshin-dirt',
      order: {
        ...order,
        target_keyword: '阪神ダート1800m コース傾向',
        theme_cluster: 'course_data',
      },
      forbidden: '67%',
      sentence: '阪神ダート1800mでは好走率67%という入力にない比率を使う。',
    },
    {
      name: 'grade-race',
      order: {
        ...order,
        target_keyword: '重賞 レース分析',
        theme_cluster: 'grade_race_preview',
        reference_data: {
          period: '2023年1月〜2026年6月',
          condition: '新潟芝1600m',
          sample_size: 1,
          race_name: 'テスト重賞',
          race_date: '2026年8月30日',
          venue: '新潟',
          key_metrics: [{ 馬名: 'テストホース', 評価: 'A' }],
        },
      },
      forbidden: '75%',
      sentence: 'テスト重賞では3回中2回を根拠に複勝率75%とみなす。',
    },
  ];

  for (const fixture of failureFixtures) {
    const fixtureFrontmatter = `---
title: ${fixture.order.target_keyword}
description: 入力済みデータだけで確認順を整理します。
target_keyword: ${fixture.order.target_keyword}
theme_cluster: ${fixture.order.theme_cluster}
---
`;
    const writerPath = path.join(tempDir, `${fixture.name}-writer.md`);
    fs.writeFileSync(writerPath, `${fixtureFrontmatter}\n${fixture.sentence}\n`, 'utf-8');
    const writerGate = runPostWriterArticleFlow(fixture.order, writerPath);
    assert.equal(writerGate.status, 'REJECTED', writerGate.log);
    assert.match(writerGate.criticalIssues.map(issue => issue.message).join('\n'), new RegExp(fixture.forbidden.replace('%', '\\%')));
    assert.match(writerGate.criticalIssues.map(issue => issue.message).join('\n'), new RegExp(fixture.sentence.slice(0, 12)));

    const stagedPath = path.join(tempDir, `${fixture.name}-staged.md`);
    fs.writeFileSync(
      stagedPath,
      `${fixtureFrontmatter}\nEditor修正後は未入力の割合と換算例を削除し、入力済みの事実だけを確認する。\n`,
      'utf-8',
    );
    const finalGate = runPostWriterArticleFlow(fixture.order, stagedPath);
    assert.equal(finalGate.status, 'APPROVED', finalGate.log);
  }
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

console.log('Article flow numeric evidence gate tests passed.');
