from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SOP_DIR = ROOT / "agent-sops"
REQUIRED_SECTIONS = ("## Overview", "## Parameters", "## Steps")
NEGATIVE_PATTERNS = (
    re.compile(r"You MUST NOT (?P<body>.+)", re.IGNORECASE),
    re.compile(r"You SHOULD NOT (?P<body>.+)", re.IGNORECASE),
)
REASON_MARKERS = (" because ", " because　", "理由", "ため", "ので")


def validate_sop(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    errors: list[str] = []

    if not re.search(r"^# .+", text, re.MULTILINE):
        errors.append("H1タイトルがありません")

    for section in REQUIRED_SECTIONS:
        if section not in text:
            errors.append(f"{section} セクションがありません")

    if "**Constraints:**" not in text:
        errors.append("**Constraints:** ブロックがありません")

    for line_number, line in enumerate(text.splitlines(), start=1):
        stripped = line.strip()
        for pattern in NEGATIVE_PATTERNS:
            match = pattern.search(stripped)
            if match and not any(marker in stripped for marker in REASON_MARKERS):
                errors.append(
                    f"{line_number}行目の禁止制約に理由がありません: {stripped}"
                )

    return errors


def main() -> int:
    sop_files = sorted(SOP_DIR.glob("*.sop.md"))
    if not sop_files:
        print("agent-sops に .sop.md ファイルがありません", file=sys.stderr)
        return 1

    failures: dict[Path, list[str]] = {}
    for path in sop_files:
        errors = validate_sop(path)
        if errors:
            failures[path] = errors

    if failures:
        for path, errors in failures.items():
            print(f"[NG] {path.relative_to(ROOT)}")
            for error in errors:
                print(f"  - {error}")
        return 1

    print(f"[OK] {len(sop_files)} SOP files validated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
