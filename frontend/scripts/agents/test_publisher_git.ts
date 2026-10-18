import assert from 'assert';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import { hasStagedGitChanges, pushWithRebaseRetry } from './publisher_git';

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', args, { cwd, stdio: 'ignore' });
}

function gitOutput(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf-8' }).trim();
}

function cloneAs(remote: string, dir: string, shallow = false): void {
  // Windowsの手元でも改行を変えない（Actionsと同じ形で比べる）。
  // Actionsの actions/checkout は最新の1件だけを取るので、Publisher側は浅い取得にする。
  const source = shallow ? pathToFileURL(remote).href : remote;
  const depth = shallow ? ['--depth', '1'] : [];
  execFileSync('git', ['clone', '-q', ...depth, '-c', 'core.autocrlf=false', source, dir], { stdio: 'ignore' });
  git(dir, 'config', 'user.name', 'Publisher Test');
  git(dir, 'config', 'user.email', 'publisher-test@example.invalid');
}

function commitFile(cwd: string, file: string, content: string, message: string): void {
  fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
  fs.writeFileSync(path.join(cwd, file), content, 'utf-8');
  git(cwd, 'add', file);
  git(cwd, 'commit', '-q', '-m', message);
}

function testPushRetry(): void {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'publisher-push-'));
  try {
    const remote = path.join(base, 'remote.git');
    const bot = path.join(base, 'bot');
    const user = path.join(base, 'user');
    git(base, 'init', '-q', '--bare', '-b', 'main', remote);
    cloneAs(remote, user);
    commitFile(user, 'frontend/content/articles/a.md', 'a\n', 'initial');
    commitFile(user, 'root-state.txt', 'initial\n', 'root state');
    git(user, 'push', '-q', 'origin', 'main');
    cloneAs(remote, bot, true);
    assert.equal(gitOutput(bot, 'rev-parse', '--is-shallow-repository'), 'true');
    const botFrontend = path.join(bot, 'frontend');

    // 断られないときは、そのままpushする。
    commitFile(bot, 'frontend/content/articles/b.md', 'b\n', 'Auto-publish: b');
    pushWithRebaseRetry(botFrontend);
    assert.equal(gitOutput(remote, 'log', '-1', '--format=%s', 'main'), 'Auto-publish: b');
    git(user, 'pull', '-q', 'origin', 'main');

    // 記事の回の途中に別のpushが入っても、rebaseして両方を残す。
    commitFile(user, 'frontend/components/Header.tsx', 'header\n', 'user change');
    git(user, 'push', '-q', 'origin', 'main');
    commitFile(bot, 'frontend/content/articles/c.md', 'c\n', 'Auto-publish: c');
    // リポジトリ直下の未commitの変更があっても、rebaseを止めない。
    fs.writeFileSync(path.join(bot, 'root-state.txt'), 'changed by pipeline\n', 'utf-8');
    pushWithRebaseRetry(botFrontend);
    assert.deepEqual(
      gitOutput(remote, 'log', '-3', '--format=%s', 'main').split('\n'),
      ['Auto-publish: c', 'user change', 'Auto-publish: b'],
    );
    assert.equal(gitOutput(bot, 'rev-parse', 'HEAD'), gitOutput(remote, 'rev-parse', 'main'));
    assert.equal(fs.readFileSync(path.join(bot, 'root-state.txt'), 'utf-8'), 'changed by pipeline\n');
    git(user, 'pull', '-q', 'origin', 'main');

    // 同じファイルを直して衝突したら、元のcommitに戻してエラーにする。
    commitFile(user, 'frontend/content/articles/c.md', 'user edit\n', 'user edits c');
    git(user, 'push', '-q', 'origin', 'main');
    commitFile(bot, 'frontend/content/articles/c.md', 'bot edit\n', 'Auto-publish: c again');
    const botHead = gitOutput(bot, 'rev-parse', 'HEAD');
    assert.throws(() => pushWithRebaseRetry(botFrontend), /git pull --rebase origin main failed/);
    assert.equal(gitOutput(bot, 'rev-parse', 'HEAD'), botHead);
    assert.equal(fs.existsSync(path.join(bot, '.git', 'rebase-merge')), false);
    assert.equal(fs.existsSync(path.join(bot, '.git', 'rebase-apply')), false);
    assert.equal(gitOutput(remote, 'log', '-1', '--format=%s', 'main'), 'user edits c');
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
}

const repository = fs.mkdtempSync(path.join(os.tmpdir(), 'publisher-git-'));
const frontend = path.join(repository, 'frontend');

try {
  fs.mkdirSync(frontend, { recursive: true });
  git(repository, 'init', '-b', 'main');
  git(repository, 'config', 'user.name', 'Publisher Test');
  git(repository, 'config', 'user.email', 'publisher-test@example.invalid');

  fs.writeFileSync(path.join(repository, 'root-state.txt'), 'initial\n', 'utf-8');
  fs.writeFileSync(path.join(frontend, 'article.md'), 'initial\n', 'utf-8');
  git(repository, 'add', '.');
  git(repository, 'commit', '-m', 'initial');

  assert.equal(hasStagedGitChanges(frontend), false);

  // frontend外の未stage変更は、Publisherがcommitできる変更として扱わない。
  fs.writeFileSync(path.join(repository, 'root-state.txt'), 'changed outside frontend\n', 'utf-8');
  git(frontend, 'add', '.');
  assert.equal(hasStagedGitChanges(frontend), false);

  // frontend内でstageされた記事変更は、commit対象として扱う。
  fs.writeFileSync(path.join(frontend, 'article.md'), 'published article\n', 'utf-8');
  git(frontend, 'add', '.');
  assert.equal(hasStagedGitChanges(frontend), true);

  testPushRetry();

  console.log('Publisher Git change detection and push retry tests passed.');
} finally {
  fs.rmSync(repository, { recursive: true, force: true });
}
