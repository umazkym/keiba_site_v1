// この Worker は umafree.ai@gmail.com の Cloudflare に置く。
// PC 全体の wrangler のログイン（otofuya22・onomaui などの Pages 用）とは置き場を分け、切り替えずに使う。
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const appData = process.env.APPDATA ?? join(homedir(), ".config");
const env = { ...process.env, XDG_CONFIG_HOME: join(appData, "umafree-wrangler") };
const result = spawnSync("npx", ["--yes", "wrangler@4.152.0", ...process.argv.slice(2)], {
  env,
  stdio: "inherit",
  // Windows の npx は .cmd なので shell を通す
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
