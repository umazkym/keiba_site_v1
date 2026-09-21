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
