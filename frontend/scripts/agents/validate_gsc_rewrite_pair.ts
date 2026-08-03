import fs from 'fs';
import path from 'path';
import { validateGscRewrite } from './gsc_rewrite_guard';

function readArgument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : '';
  if (!value) throw new Error(`${name}は必須です。`);
  return path.resolve(value);
}

function main(): void {
  const beforePath = readArgument('--before');
  const afterPath = readArgument('--after');
  const before = fs.readFileSync(beforePath, 'utf8');
  const after = fs.readFileSync(afterPath, 'utf8');
  const result = validateGscRewrite(before, after);
  if (!result.passed) {
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log('GSC限定改稿ガード: OK');
}

main();
