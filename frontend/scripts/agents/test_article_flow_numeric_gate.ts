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
