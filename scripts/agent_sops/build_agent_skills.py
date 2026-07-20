from __future__ import annotations

import argparse
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SOP_DIR = ROOT / "agent-sops"


def slug_from_path(path: Path) -> str:
    return path.name.removesuffix(".sop.md")


def title_from_text(text: str, fallback: str) -> str:
    match = re.search(r"^#\s+(.+)$", text, re.MULTILINE)
    return match.group(1).strip() if match else fallback


def description_from_text(text: str, fallback: str) -> str:
    match = re.search(r"## Overview\s+(.+?)(?:\n## |\Z)", text, re.DOTALL)
    if not match:
        return fallback
    paragraph = " ".join(
        line.strip()
        for line in match.group(1).strip().splitlines()
        if line.strip()
    )
    return paragraph[:240] if paragraph else fallback


def skill_markdown(name: str, title: str, description: str, sop_text: str) -> str:
    return (
        "---\n"
        f"name: {name}\n"
        f"description: {description}\n"
        "---\n\n"
        f"# {title}\n\n"
        "このSkillは `agent-sops/` のSOPから生成された派生物です。"
        "原本を更新した場合は再生成してください。\n\n"
        f"{sop_text.strip()}\n"
    )


def build(output: Path, dry_run: bool) -> list[Path]:
    created: list[Path] = []
    for sop_path in sorted(SOP_DIR.glob("*.sop.md")):
        sop_text = sop_path.read_text(encoding="utf-8")
        name = slug_from_path(sop_path)
        title = title_from_text(sop_text, name)
        description = description_from_text(sop_text, title)
        target = output / name / "SKILL.md"
        created.append(target)
        if not dry_run:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(
                skill_markdown(name, title, description, sop_text),
                encoding="utf-8",
            )
    return created


def main() -> int:
    parser = argparse.ArgumentParser(
        description="agent-sops の .sop.md をAgent Skill形式へ簡易変換します。"
    )
    parser.add_argument(
        "--output",
        default=".claude/skills",
        help="出力先ディレクトリ。既定は .claude/skills",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="書き込まず、生成対象だけを表示します。",
    )
    args = parser.parse_args()

    output = (ROOT / args.output).resolve()
    targets = build(output, args.dry_run)
    mode = "DRY-RUN" if args.dry_run else "WRITE"
    for target in targets:
        print(f"[{mode}] {target}")
    print(f"{len(targets)} skills processed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
