#!/usr/bin/env python3
"""無料データ機能向けの読み取り専用品質監査を生成する。"""

from __future__ import annotations

import argparse
import json
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from crud import growth_crud
from database import models
from database.database import SessionLocal


def _scalar_count(db: Session, model: Any) -> int:
    return int(db.query(func.count(model.id)).scalar() or 0)


def run_audit(db: Session, *, today: date | None = None) -> dict[str, Any]:
    audit_date = today or datetime.now(timezone.utc).date()
    latest_race_date = db.query(func.max(models.Race.race_date)).scalar()
    stale_days = (
        (audit_date - latest_race_date).days
        if latest_race_date is not None
        else None
    )

    invalid_rank_count = int(
        db.query(func.count(models.Result.id))
        .join(models.Race, models.Result.race_id == models.Race.id)
        .filter(
            models.Result.rank.isnot(None),
            or_(
                models.Result.rank < 1,
                (
                    models.Race.total_horses.isnot(None)
                    & (models.Result.rank > models.Race.total_horses)
                ),
            ),
        )
        .scalar()
        or 0
    )
    missing_horse_name_count = int(
        db.query(func.count(models.Horse.id))
        .filter(or_(models.Horse.name.is_(None), func.trim(models.Horse.name) == ""))
        .scalar()
        or 0
    )
    affiliation_filters = [
        models.Horse.name.startswith(prefix)
        for prefix in growth_crud._TRAINER_AFFILIATIONS
    ]
    suspicious_horses = (
        db.query(models.Horse.id, models.Horse.name)
        .filter(or_(*affiliation_filters))
        .order_by(models.Horse.name)
        .limit(50)
        .all()
        if affiliation_filters
        else []
    )
    trainer_rows = db.query(models.Trainer.name).all()
    separated_trainer_affiliations = sum(
        1
        for (name,) in trainer_rows
        if growth_crud._person_display_name("trainer", name)[1]
    )

    horse_samples = (
        db.query(
            models.Result.horse_id.label("horse_id"),
            func.count(models.Result.id).label("sample_size"),
        )
        .filter(models.Result.rank.isnot(None))
        .group_by(models.Result.horse_id)
        .subquery()
    )
    insufficient_horse_count = int(
        db.query(func.count(horse_samples.c.horse_id))
        .filter(horse_samples.c.sample_size < 5)
        .scalar()
        or 0
    )

    findings: list[dict[str, Any]] = []
    if latest_race_date is None:
        findings.append({
            "severity": "critical",
            "code": "dataset_empty",
            "message": "レースデータの基準日を確認できません。",
        })
    elif stale_days is not None and stale_days > 14:
        findings.append({
            "severity": "critical",
            "code": "dataset_stale",
            "message": f"最新レース日から{stale_days}日経過しています。",
        })
    elif stale_days is not None and stale_days > 7:
        findings.append({
            "severity": "warning",
            "code": "dataset_stale",
            "message": f"最新レース日から{stale_days}日経過しています。",
        })
    if invalid_rank_count:
        findings.append({
            "severity": "critical",
            "code": "invalid_rank",
            "message": f"着順の範囲外データが{invalid_rank_count}件あります。",
        })
    if missing_horse_name_count:
        findings.append({
            "severity": "critical",
            "code": "missing_horse_name",
            "message": f"馬名欠損が{missing_horse_name_count}件あります。",
        })
    if suspicious_horses:
        findings.append({
            "severity": "warning",
            "code": "horse_affiliation_mixture",
            "message": f"所属接頭辞に見える馬名が{len(suspicious_horses)}件以上あります。",
        })

    critical_count = sum(
        1 for finding in findings if finding["severity"] == "critical"
    )
    warning_count = sum(
        1 for finding in findings if finding["severity"] == "warning"
    )
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "audit_date": audit_date.isoformat(),
        "status": "critical" if critical_count else "warning" if warning_count else "ok",
        "counts": {
            "races": _scalar_count(db, models.Race),
            "results": _scalar_count(db, models.Result),
            "horses": _scalar_count(db, models.Horse),
            "jockeys": _scalar_count(db, models.Jockey),
            "trainers": _scalar_count(db, models.Trainer),
            "insufficient_horses": insufficient_horse_count,
            "trainer_names_with_separated_affiliation": separated_trainer_affiliations,
        },
        "dataset": {
            "latest_race_date": latest_race_date.isoformat() if latest_race_date else None,
            "stale_days": stale_days,
        },
        "anomalies": {
            "invalid_rank_count": invalid_rank_count,
            "missing_horse_name_count": missing_horse_name_count,
            "suspicious_horse_affiliation_count": len(suspicious_horses),
            "suspicious_horses": [
                {"horse_id": str(horse_id), "horse_name": horse_name}
                for horse_id, horse_name in suspicious_horses
            ],
        },
        "findings": findings,
        "approval_required": {
            "data_repair": True,
            "price_change": True,
            "publishing": True,
            "ad_change": True,
        },
    }


def render_markdown(report: dict[str, Any]) -> str:
    counts = report["counts"]
    dataset = report["dataset"]
    lines = [
        "# UMA-FREE データ価値 日次品質監査",
        "",
        f"- 状態: `{report['status']}`",
        f"- 監査日: {report['audit_date']}",
        f"- 最新レース日: {dataset['latest_race_date'] or '確認できません'}",
        f"- レース: {counts['races']:,}件 / 結果: {counts['results']:,}件 / 競走馬: {counts['horses']:,}頭",
        f"- 5走未満の競走馬: {counts['insufficient_horses']:,}頭",
        f"- 所属を氏名から分離表示する調教師名: {counts['trainer_names_with_separated_affiliation']:,}件",
        "",
        "## 検出結果",
        "",
    ]
    if report["findings"]:
        for finding in report["findings"]:
            lines.append(
                f"- `{finding['severity']}` `{finding['code']}`: {finding['message']}"
            )
    else:
        lines.append("- 重大・警告レベルの異常は検出されませんでした。")
    lines.extend([
        "",
        "この監査は読み取り専用です。修復、公開、価格、広告設定は変更しません。",
        "",
    ])
    return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="データ価値の日次品質監査を生成します。")
    parser.add_argument("--output-json", type=Path, required=True)
    parser.add_argument("--summary", type=Path, required=True)
    parser.add_argument(
        "--fail-on-critical",
        action="store_true",
        help="critical検出時に終了コード2を返します。既定は報告のみです。",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    args.output_json.parent.mkdir(parents=True, exist_ok=True)
    args.summary.parent.mkdir(parents=True, exist_ok=True)
    db = SessionLocal()
    try:
        report = run_audit(db)
    finally:
        db.close()
    args.output_json.write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    args.summary.write_text(render_markdown(report), encoding="utf-8")
    if args.fail_on_critical and report["status"] == "critical":
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
