// Cloudflare Workers の定時実行（Cron Triggers）から、GitHub Actions を予定の時刻に起動する（2026-10-25）。
// GitHub の schedule はこのリポジトリで2〜6時間おくれ、菊花賞の日は直前の投稿が発走のあとになった。
// GitHub の予定は予備として残す。二重に動かないようにするのは Workflow の関所
// （backend/scripts/maintenance/workflow_dispatch_gate.py）。

const REPOSITORY = "umazkym/keiba_site_v1";
const REF = "main";
const TRIGGER = "cloudflare";
const RETRY_WAITS_MS = [20_000, 60_000];

// UTC の時刻 → 起動する Workflow（JST は9時間足す）。targetOffset は対象日＝cron の UTC の日付＋日数
// （backend/scripts/social_video/workflow_dates.py の DAILY_PIPELINE_SCHEDULES と同じ）。
export const SLOTS = {
  "20:00": { workflow: "keiba-pipeline-runner.yml", targetOffset: 0 }, // 05:00 前日の結果
  "21:30": { workflow: "keiba-data-fetch-morning-today.yml", targetOffset: 1 }, // 06:30 当日の取得
  "22:00": { workflow: "keiba-sns-morning-post.yml" }, // 07:00 朝の投稿
  "01:00": { workflow: "keiba-data-fetch-retry-today.yml", targetOffset: 0 }, // 10:00 当日の取り直し
  "03:00": { workflow: "keiba-sns-afternoon-post.yml" }, // 12:00 昼の投稿
  "04:30": { workflow: "keiba-data-fetch-afternoon.yml", targetOffset: 1 }, // 13:30 翌日分（YouTube が続く）
  "05:00": { workflow: "keiba-sns-pre-race.yml", weekendOnly: true }, // 14:00 直前の投稿
  "10:00": { workflow: "keiba-sns-hit-immediate.yml", weekendOnly: true }, // 19:00 的中速報
  "11:00": { workflow: "keiba-sns-evening-post.yml" }, // 20:00 晩の投稿
};

const pad = (value) => String(value).padStart(2, "0");

// 予定の時刻（scheduledTime）から起動する Workflow と入力を決める。対象外の時刻は null。
export function dispatchFor(scheduledTime) {
  const at = new Date(scheduledTime);
  const slot = SLOTS[`${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}`];
  if (!slot) return null;
  const weekday = at.getUTCDay();
  if (slot.weekendOnly && weekday !== 0 && weekday !== 6) return null;
  const inputs = { trigger: TRIGGER };
  if (slot.targetOffset !== undefined) {
    const target = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate() + slot.targetOffset));
    inputs.target_date = target.toISOString().slice(0, 10);
  }
  return { workflow: slot.workflow, inputs };
}

// 起動を頼む。GitHub 側の一時的な失敗（5xx・429・通信）だけ待って出し直す。鍵や入力の誤り（4xx）は出し直さない。
export async function dispatch(job, token, { fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const url = `https://api.github.com/repos/${REPOSITORY}/actions/workflows/${job.workflow}/dispatches`;
  const request = {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "keiba-workflow-dispatcher",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ ref: REF, inputs: job.inputs }),
  };
  let lastError = "";
  for (let attempt = 0; attempt <= RETRY_WAITS_MS.length; attempt += 1) {
    if (attempt > 0) await sleep(RETRY_WAITS_MS[attempt - 1]);
    try {
      const response = await fetchImpl(url, request);
      if (response.ok) return { attempts: attempt + 1, status: response.status };
      const body = (await response.text()).slice(0, 300);
      lastError = `HTTP ${response.status} ${body}`;
      if (response.status !== 429 && response.status < 500) break;
    } catch (error) {
      lastError = `通信の失敗 ${error}`;
    }
  }
  throw new Error(`${job.workflow} を起動できませんでした（GitHub の予定の回が予備で動きます）: ${lastError}`);
}

export default {
  async scheduled(controller, env, ctx) {
    const job = dispatchFor(controller.scheduledTime);
    const at = new Date(controller.scheduledTime).toISOString();
    if (!job) {
      console.log(`対象の Workflow が無い時刻です: ${at} cron=${controller.cron}`);
      return;
    }
    if (!env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN が設定されていません（npx wrangler secret put GITHUB_TOKEN）");
    const result = await dispatch(job, env.GITHUB_TOKEN);
    console.log(`起動しました: ${job.workflow} ${JSON.stringify(job.inputs)} 予定=${at} 回数=${result.attempts}`);
  },
};
