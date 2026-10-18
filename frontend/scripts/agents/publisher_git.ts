import { spawnSync } from 'child_process';

/**
 * Publisherが実際にcommitできる変更だけを判定する。
 *
 * `git status --porcelain` は、現在の作業ディレクトリより上にある未stage変更も
 * 返す。Publisherは `frontend/` から `git add .` を実行するため、その結果を
 * statusで判定すると、repository直下の未stage変更だけがある場合にも空commitを
 * 試みてしまう。ここではGitのindexだけを確認する。
 */
export function hasStagedGitChanges(cwd = process.cwd()): boolean {
  const result = spawnSync('git', ['diff', '--cached', '--quiet'], {
    cwd,
    stdio: 'ignore',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status === 0) {
    return false;
  }
  if (result.status === 1) {
    return true;
  }

  throw new Error(`git diff --cached --quiet failed with status ${result.status ?? 'unknown'}`);
}

function runGit(cwd: string, args: string[]): { ok: boolean; output: string } {
  const result = spawnSync('git', args, { cwd, encoding: 'utf-8' });
  if (result.error) {
    throw result.error;
  }
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  if (output) {
    console.log(output);
  }
  return { ok: result.status === 0, output };
}

/**
 * Publisherのcommitをpushする。断られたら1回だけ最新のremoteへrebaseしてやり直す。
 *
 * 記事の回の途中に別のpush（利用者のコード変更など）が入ると、最後のpushが
 * 「fetch first」で断られ、その回の記事が公開されなかった（2026-10-18 秋華賞）。
 * Publisherの変更は `frontend/content` などの記事に限られ、利用者の変更と
 * 重なることはほぼないため、rebaseして載せ直せば足りる。
 * rebaseが衝突したら中止して元のcommitに戻し、エラーとして返す。
 * Publisherは `frontend/` から呼ぶため、リポジトリ直下の未commitの変更は
 * `--autostash` で一時的に退避する。
 */
export function pushWithRebaseRetry(cwd = process.cwd(), remote = 'origin', branch = 'main'): void {
  if (runGit(cwd, ['push', remote, branch]).ok) {
    return;
  }

  console.warn(`[Publisher] Git push was rejected. Rebasing onto ${remote}/${branch} once and retrying...`);
  const pull = runGit(cwd, ['pull', '--rebase', '--autostash', remote, branch]);
  if (!pull.ok) {
    runGit(cwd, ['rebase', '--abort']);
    throw new Error(`git pull --rebase ${remote} ${branch} failed; the publish commit was not pushed.\n${pull.output}`);
  }

  const retry = runGit(cwd, ['push', remote, branch]);
  if (!retry.ok) {
    throw new Error(`git push ${remote} ${branch} failed after rebase.\n${retry.output}`);
  }
}
