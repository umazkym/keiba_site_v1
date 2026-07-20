#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from scripts.social_video.visual_assets import validate_asset_library  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="UMA-FREE動画素材ライブラリを検証します")
    parser.add_argument("--asset-root", help="素材ルート。未指定ならsocial_video/assets")
    parser.add_argument("--json-output", help="検証結果JSONの出力先")
    parser.add_argument("--strict", action="store_true", help="警告が1件でもあれば終了コード1にする")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    report = validate_asset_library(Path(args.asset_root) if args.asset_root else None)
    payload = report.to_dict()

    print(f"素材ルート: {report.asset_root}")
    print(
        f"写真: {report.image_count}件 / コース: {report.course_count}件 / "
        f"音声: {report.audio_count}件 / 検査: {report.checked_count}件"
    )
    print(
        "必須素材: "
        f"横写真={'OK' if report.default_wide_available else '未配置'}, "
        f"縦写真={'OK' if report.default_vertical_available else '未配置'}, "
        f"長尺BGM={'OK' if report.long_audio_available else '未配置'}, "
        f"Shorts BGM={'OK' if report.shorts_audio_available else '未配置'}"
    )
    for issue in report.issues:
        marker = "ERROR" if issue.severity == "error" else "WARN"
        location = f" [{issue.path}]" if issue.path else ""
        print(f"{marker} {issue.code}{location}: {issue.message}")

    if args.json_output:
        output_path = Path(args.json_output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"検証結果JSON: {output_path}")

    if report.error_count > 0 or (args.strict and report.warning_count > 0):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
