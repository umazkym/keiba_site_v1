import assert from 'assert';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { hasStagedGitChanges } from './publisher_git';

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', args, { cwd, stdio: 'ignore' });
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

  console.log('Publisher Git change detection tests passed.');
} finally {
  fs.rmSync(repository, { recursive: true, force: true });
}
