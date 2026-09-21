'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../..');
const yaml = createRequire(path.join(root, 'frontend/package.json'))('js-yaml');
const read = file => yaml.load(fs.readFileSync(path.join(root, '.github/workflows', file), 'utf8'));

for (const file of ['keiba-ad-safety-daily.yml', 'keiba-monetization-cycle.yml']) {
  test(`${file}: 収集失敗でも通知し、秘密情報と書込権限を分離する`, () => {
    const workflow = read(file);
    const notify = workflow.jobs.notify;
    assert.match(notify.if, /always\(\)/);
    assert.match(notify.if, /!cancelled\(\)/);
    assert.match(notify.if, /github.repository == 'umazkym\/keiba_site_v1'/);
    assert.equal(notify.permissions['issues'], 'write');
    assert.equal(notify.permissions['id-token'], undefined);
    assert.equal(notify.env, undefined);
    assert.equal(workflow.permissions['issues'], undefined);
    assert.match(JSON.stringify(notify.steps), /publish_revenue_notice\.cjs/);
    const collection = Object.values(workflow.jobs).find(job => job !== notify);
    for (const step of collection.steps.filter(step => step.uses?.startsWith('actions/upload-artifact@'))) {
      if (step.with.name.startsWith('revenue-notice-')) {
        assert.match(step.with.path, /\/revenue-notice\/notification\.json$/);
        assert.match(step.if, /public_validate.outcome == 'success'/);
      } else {
        assert.match(step.if, /github.event.repository.private == true/);
      }
    }
    const validation = collection.steps.find(step => step.id === 'public_validate');
    assert.match(validation.with.script, /validate\(JSON.parse/);
  });
}

test('週次の過去期間の手動再集計ではメールを送らない', () => {
  const notify = read('keiba-monetization-cycle.yml').jobs.notify;
  assert.match(notify.if, /inputs.mode != 'backfill'/);
  assert.match(notify.if, /inputs.start_date == ''/);
  assert.match(notify.if, /inputs.end_date == ''/);
});
