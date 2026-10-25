import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { SLOTS, dispatch, dispatchFor } from "../src/index.js";

const utc = (text) => Date.parse(`${text}Z`);
const workflowsDir = new URL("../../../.github/workflows/", import.meta.url);

test("翌日分の取得は対象日が翌日（13:30 JST）", () => {
  assert.deepEqual(dispatchFor(utc("2026-10-25T04:30:00")), {
    workflow: "keiba-data-fetch-afternoon.yml",
    inputs: { trigger: "cloudflare", target_date: "2026-10-26" },
  });
});

test("朝の取得は UTC の前日の晩に動き、対象日は JST の当日", () => {
  assert.equal(dispatchFor(utc("2026-10-31T21:30:00")).inputs.target_date, "2026-11-01");
});

test("結果の取り込みと取り直しは UTC の日付のまま", () => {
  assert.equal(dispatchFor(utc("2026-10-25T20:00:00")).inputs.target_date, "2026-10-25");
  assert.equal(dispatchFor(utc("2026-10-25T01:00:00")).inputs.target_date, "2026-10-25");
});

test("SNS の回は対象日を渡さない", () => {
  assert.deepEqual(dispatchFor(utc("2026-10-25T22:00:00")), {
    workflow: "keiba-sns-morning-post.yml",
    inputs: { trigger: "cloudflare" },
  });
});

test("直前と的中速報は土日だけ", () => {
  assert.equal(dispatchFor(utc("2026-10-25T05:00:00")).workflow, "keiba-sns-pre-race.yml"); // 日曜
  assert.equal(dispatchFor(utc("2026-10-24T10:00:00")).workflow, "keiba-sns-hit-immediate.yml"); // 土曜
  assert.equal(dispatchFor(utc("2026-10-26T05:00:00")), null); // 月曜
});

test("対象外の時刻は何もしない", () => {
  assert.equal(dispatchFor(utc("2026-10-25T05:30:00")), null);
});

test("wrangler.toml の3本の cron は SLOTS の時刻と同じ", () => {
  const toml = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
  const crons = [...toml.matchAll(/^\s*"([^"]+)",?$/gm)].map((match) => match[1]);
  const times = crons.flatMap((cron) => {
    const [minute, hours] = cron.split(" ");
    return hours.split(",").map((hour) => `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`);
  });
  assert.deepEqual(times.sort(), Object.keys(SLOTS).sort());
});

test("SLOTS は各 Workflow の GitHub の予定と同じ時刻", () => {
  for (const [time, slot] of Object.entries(SLOTS)) {
    const [hour, minute] = time.split(":").map(Number);
    const workflow = readFileSync(new URL(slot.workflow, workflowsDir), "utf8");
    const days = slot.weekendOnly ? "0,6" : "*";
    assert.ok(workflow.includes(`cron: '${minute} ${hour} * * ${days}'`), `${slot.workflow} ${time}`);
    assert.ok(workflow.includes("inputs.trigger == 'cloudflare'"), slot.workflow);
    assert.equal(workflow.includes("target_date:"), slot.targetOffset !== undefined, slot.workflow);
  }
});

test("GitHub の一時的な失敗は出し直し、鍵の誤りは出し直さない", async () => {
  const job = dispatchFor(utc("2026-10-25T05:00:00"));
  const waits = [];
  const sleep = async (ms) => { waits.push(ms); };
  const responses = [new Response("busy", { status: 502 }), new Response(null, { status: 204 })];
  const calls = [];
  const fetchImpl = async (url, request) => { calls.push({ url, request }); return responses.shift(); };
  const result = await dispatch(job, "token", { fetchImpl, sleep });
  assert.deepEqual(result, { attempts: 2, status: 204 });
  assert.deepEqual(waits, [20_000]);
  assert.equal(calls[0].url, "https://api.github.com/repos/umazkym/keiba_site_v1/actions/workflows/keiba-sns-pre-race.yml/dispatches");
  assert.deepEqual(JSON.parse(calls[0].request.body), { ref: "main", inputs: { trigger: "cloudflare" } });

  const unauthorized = async () => new Response("Bad credentials", { status: 401 });
  await assert.rejects(dispatch(job, "token", { fetchImpl: unauthorized, sleep }), /HTTP 401/);
  assert.deepEqual(waits, [20_000]);
});
