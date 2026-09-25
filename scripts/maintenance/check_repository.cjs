// 実運用のコードをimportせず、構成と参照だけを検査する。
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');

const ROOT = path.resolve(__dirname, '../..');
const frontendRequire = createRequire(path.join(ROOT, 'frontend/package.json'));
const yaml = frontendRequire('js-yaml');
const errors = [];
const slash = (value) => value.split(path.sep).join('/');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(ROOT, file));
const digest = (file) => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex');
const ignored = new Set(['node_modules', '.git', '.next', '.runtime', '.tmp', '.local', '__pycache__', '.pytest_cache', 'archive', '.playwright-cli', 'data', 'output', 'outputs', 'scratch']);

function filesUnder(directory) {
  if (!exists(directory)) return [];
  return fs.readdirSync(path.join(ROOT, directory), { withFileTypes: true }).flatMap((entry) => {
    if (entry.isSymbolicLink() || ignored.has(entry.name)) return [];
    const file = slash(path.join(directory, entry.name));
    return entry.isDirectory() ? filesUnder(file) : [file];
  }).sort();
}

function requirePath(file, source) {
  if (typeof file !== 'string' || file.includes('${{') || file.includes('$')) return;
  const resolved = path.resolve(ROOT, file);
  if (!resolved.startsWith(ROOT + path.sep) || !exists(file)) errors.push(`${source}: 存在しないか作業領域外の参照 ${file}`);
}

function commandPaths(command, cwd) {
  const result = [];
  const pattern = /\b(?:python(?:3)?(?: -u)?|node|npx(?: --yes)? tsx)\s+['"]?([\w./-]+\.(?:py|[cm]?js|ts))\b/g;
  for (const match of String(command || '').matchAll(pattern)) result.push(slash(path.join(cwd, match[1])));
  return result;
}

function inspectWorkflows() {
  const result = [];
  for (const file of filesUnder('.github/workflows').filter((f) => /\.ya?ml$/.test(f))) {
    let config;
    try { config = yaml.load(read(file)); } catch (error) { errors.push(`${file}: YAML構文エラー ${error.message}`); continue; }
    if (!config?.name || !config.on || !config.jobs) { errors.push(`${file}: name/on/jobsがありません`); continue; }
    const entrypoints = new Set();
    for (const [jobId, job] of Object.entries(config.jobs)) {
      if (job.uses?.startsWith('./')) requirePath(job.uses, file);
      for (const step of job.steps || []) {
        if (step.uses?.startsWith('./')) requirePath(step.uses, `${file}/${jobId}`);
        const cwd = step['working-directory'] || job.defaults?.run?.['working-directory'] || config.defaults?.run?.['working-directory'] || '.';
        if (cwd !== '.') requirePath(cwd, file);
        for (const target of commandPaths(step.run, cwd)) {
          requirePath(target, `${file}/${step.name || jobId}`);
          entrypoints.add(target);
        }
        const cachePaths = step.with?.['cache-dependency-path'];
        if (typeof cachePaths === 'string') for (const target of cachePaths.trim().split(/\r?\n/)) {
          if (!target.includes('*')) requirePath(target.trim(), file);
        }
      }
    }
    result.push({ file, config, entrypoints: [...entrypoints].sort() });
  }
  // workflow_runはファイル名でなく表示名を参照する。
  const names = new Set(result.map((row) => row.config.name));
  for (const row of result) for (const name of row.config.on.workflow_run?.workflows || []) {
    if (!names.has(name)) errors.push(`${row.file}: 連動元Workflowがありません ${name}`);
  }
  yaml.load(read('.github/actions/setup-iap-db/action.yml'));
  return result;
}

function inspectArchive() {
  const manifest = JSON.parse(read('archive/manifest.json'));
  for (const move of manifest.moves) {
    if (exists(move.source)) errors.push(`アーカイブ元が再出現しました: ${move.source}`);
    if (move.local && !exists(move.destination)) continue;
    requirePath(move.destination, 'archive/manifest.json');
    for (const target of move.active_alternatives || []) requirePath(target, '現行素材');
    if (exists(move.destination) && digest(move.destination) !== (move.archived_sha256 || move.sha256)) {
      errors.push(`アーカイブ内容が台帳と不一致です: ${move.destination}`);
    }
  }
  const runtimeFiles = ['backend', 'frontend', '.github'].flatMap(filesUnder).filter((f) => /\.(py|tsx?|[cm]?js|ya?ml)$/.test(f));
  for (const file of runtimeFiles) {
    const text = read(file);
    for (const move of manifest.moves.filter((item) => !item.local && !item.active_alternatives)) {
      if (text.includes(move.source)) errors.push(`${file}: アーカイブ元への参照が残っています ${move.source}`);
    }
  }
  return manifest.moves.length;
}

function inspectLayout() {
  const { moves } = JSON.parse(read('docs/operations/layout-moves.json'));
  for (const move of moves) {
    // ローカル生成物は外部ツールが再作成することがあり、cloneにも含まれない。
    if (move.local) continue;
    requirePath(move.destination, 'docs/operations/layout-moves.json');
    if (exists(move.source)) errors.push(`移動前の配置にファイルが残っています: ${move.source}`);
  }
  for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.py')) errors.push(`ルートのPythonツールは用途別に配置してください: ${entry.name}`);
  }
  for (const entry of fs.readdirSync(path.join(ROOT, 'docs'), { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.md') && !['README.md', 'archive_agents_history.md'].includes(entry.name)) {
      errors.push(`資料はdocsの分野別フォルダに配置してください: ${entry.name}`);
    }
  }
  return moves.length;
}

function generateMap(workflows, features) {
  const lines = ['# 自動処理と公開ルートの一覧', '', '`npm run repository:map`で現行コードから再生成します。手書きの役割は[機能ガイド](system-guide.md)、移動の記録は[archive](../../archive/README.md)を参照してください。', '', '## 機能別の入口', '', '| 機能 | 主な入口 | 副作用・保存先 |', '| --- | --- | --- |'];
  for (const feature of features) lines.push(`| ${feature.name} | ${feature.entrypoints.map((p) => `[${p}](../../${p})`).join('<br>')} | ${feature.effect} |`);
  lines.push('', '## GitHub Actions', '', 'cronはUTCです。JSTは時刻に9時間を足し、曜日をまたぐ場合もあります。予定時刻と実際の開始は異なります。', '', '| Workflow | 起動条件 | 排他グループ | ローカル実行入口 |', '| --- | --- | --- | --- |');
  for (const row of workflows) {
    const triggers = Object.entries(row.config.on).map(([key, value]) => key === 'schedule' ? value.map((item) => `cron: \`${item.cron}\``).join('<br>') : key === 'workflow_run' ? `workflow_run: ${(value.workflows || []).join(', ')}` : key);
    const group = typeof row.config.concurrency === 'string' ? row.config.concurrency : row.config.concurrency?.group;
    lines.push(`| [${row.config.name}](../../${row.file}) | ${triggers.join('<br>')} | ${group || '設定なし（個別の台帳・処理制御を確認）'} | ${row.entrypoints.map((p) => `[${p}](../../${p})`).join('<br>') || 'Workflow内の処理／再利用Workflow'} |`);
  }
  lines.push('', '## Next.jsの公開ルートとAPI', '', 'ファイルルートの一覧です。実際の公開可否・リダイレクト・noindexは各ページと公開台帳に依存します。', '', '| ルート | ソース |', '| --- | --- |');
  // JSXで画像を返すルート（記事のOG画像 route.tsx）も公開ルートとして載せる
  for (const file of filesUnder('frontend/app').filter((f) => /\/(page\.tsx|route\.tsx?)$/.test(f))) {
    const route = file.replace('frontend/app', '').replace(/\/(page\.tsx|route\.tsx?)$/, '') || '/';
    lines.push(`| \`${route}\` | [${file}](../../${file}) |`);
  }
  lines.push('', '## FastAPIの登録エンドポイント', '', 'ルータのprefixは`backend/main.py`を参照してください。下表は各ルータ内の相対パスです。', '', '| ファイル | メソッドと相対パス |', '| --- | --- |');
  for (const file of filesUnder('backend/api/v1/endpoints').filter((f) => f.endsWith('.py'))) {
    const routes = [...read(file).matchAll(/@(?:router|growth_router)\.(get|post|put|delete|patch)\(\s*['"]([^'"]*)/g)];
    for (const [, method, route] of routes) lines.push(`| [${file}](../../${file}) | \`${method.toUpperCase()} ${route}\` |`);
  }
  return lines.join('\n') + '\n';
}

function main() {
  const workflows = inspectWorkflows();
  const { features } = JSON.parse(read('docs/operations/features.json'));
  const knownWorkflows = new Set(workflows.map((row) => path.basename(row.file)));
  const covered = new Set();
  for (const feature of features) {
    for (const file of feature.entrypoints) requirePath(file, `機能 ${feature.id}`);
    for (const name of feature.workflows) {
      covered.add(name);
      if (!knownWorkflows.has(name)) errors.push(`機能 ${feature.id}: Workflowが存在しません ${name}`);
    }
  }
  for (const name of knownWorkflows) if (!covered.has(name)) errors.push(`機能台帳に未登録のWorkflow: ${name}`);
  const archiveCount = inspectArchive();
  const layoutCount = inspectLayout();
  const packageFiles = ['package.json', 'frontend/package.json'];
  for (const file of packageFiles) {
    const data = JSON.parse(read(file));
    for (const command of Object.values(data.scripts || {})) for (const target of commandPaths(command, path.dirname(file))) requirePath(target, file);
  }
  const generated = generateMap(workflows, features);
  const destination = 'docs/operations/automation-map.md';
  if (process.argv.includes('--write-map') && errors.length === 0) fs.writeFileSync(path.join(ROOT, destination), generated);
  else if (!exists(destination) || read(destination).replace(/\r\n/g, '\n') !== generated) errors.push('自動処理一覧が古いか存在しません。npm run repository:mapで更新してください');
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else console.log(`構成検査成功: ${features.length}機能、${workflows.length}Workflow、${archiveCount}アーカイブ、${layoutCount}配置変更。公開・DB接続・外部投稿は実行していません。`);
}

main();
