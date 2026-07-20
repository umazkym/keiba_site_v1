const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const sopDir = path.join(root, "agent-sops");

function parseArgs(argv) {
  const args = {
    output: ".claude/skills",
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--output") {
      args.output = argv[i + 1];
      i += 1;
    }
  }

  return args;
}

function slugFromName(name) {
  return name.replace(/\.sop\.md$/, "");
}

function titleFromText(text, fallback) {
  const match = text.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fallback;
}

function descriptionFromText(text, fallback) {
  const match = text.match(/## Overview\s+([\s\S]+?)(?:\n## |\s*$)/);
  if (!match) return fallback;
  const paragraph = match[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
  return paragraph ? paragraph.slice(0, 240) : fallback;
}

function skillMarkdown(name, title, description, sopText) {
  return `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${title}\n\nこのSkillは \`agent-sops/\` のSOPから生成された派生物です。原本を更新した場合は再生成してください。\n\n${sopText.trim()}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputDir = path.resolve(root, args.output);
  const files = fs
    .readdirSync(sopDir)
    .filter((name) => name.endsWith(".sop.md"))
    .sort();

  for (const fileName of files) {
    const sourcePath = path.join(sopDir, fileName);
    const sopText = fs.readFileSync(sourcePath, "utf8");
    const name = slugFromName(fileName);
    const title = titleFromText(sopText, name);
    const description = descriptionFromText(sopText, title);
    const targetPath = path.join(outputDir, name, "SKILL.md");

    if (!args.dryRun) {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, skillMarkdown(name, title, description, sopText), "utf8");
    }

    console.log(`[${args.dryRun ? "DRY-RUN" : "WRITE"}] ${targetPath}`);
  }

  console.log(`${files.length} skills processed`);
}

main();
