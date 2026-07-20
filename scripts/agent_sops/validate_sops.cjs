const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const sopDir = path.join(root, "agent-sops");
const requiredSections = ["## Overview", "## Parameters", "## Steps"];
const negativePatterns = [/You MUST NOT .+/i, /You SHOULD NOT .+/i];
const reasonMarkers = [" because ", " because　", "理由", "ため", "ので"];

function validateSop(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const errors = [];

  if (!/^# .+/m.test(text)) {
    errors.push("H1タイトルがありません");
  }

  for (const section of requiredSections) {
    if (!text.includes(section)) {
      errors.push(`${section} セクションがありません`);
    }
  }

  if (!text.includes("**Constraints:**")) {
    errors.push("**Constraints:** ブロックがありません");
  }

  text.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!negativePatterns.some((pattern) => pattern.test(trimmed))) return;
    if (reasonMarkers.some((marker) => trimmed.includes(marker))) return;
    errors.push(`${index + 1}行目の禁止制約に理由がありません: ${trimmed}`);
  });

  return errors;
}

function main() {
  if (!fs.existsSync(sopDir)) {
    console.error("agent-sops ディレクトリがありません");
    return 1;
  }

  const files = fs
    .readdirSync(sopDir)
    .filter((name) => name.endsWith(".sop.md"))
    .sort()
    .map((name) => path.join(sopDir, name));

  if (files.length === 0) {
    console.error("agent-sops に .sop.md ファイルがありません");
    return 1;
  }

  const failures = [];
  for (const file of files) {
    const errors = validateSop(file);
    if (errors.length > 0) {
      failures.push([file, errors]);
    }
  }

  if (failures.length > 0) {
    for (const [file, errors] of failures) {
      console.log(`[NG] ${path.relative(root, file)}`);
      for (const error of errors) {
        console.log(`  - ${error}`);
      }
    }
    return 1;
  }

  console.log(`[OK] ${files.length} SOP files validated`);
  return 0;
}

process.exitCode = main();
