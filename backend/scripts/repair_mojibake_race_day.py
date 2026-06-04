import argparse
import datetime
import os
import sys
from pathlib import Path
from typing import Dict, Iterable, Optional

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

load_dotenv(ROOT_DIR / ".env")
load_dotenv(BACKEND_DIR / ".env", override=False)

from database.database import SessionLocal
from database import models
from scripts import parser, scraper


BAD_MARKERS = ("\ufffd", "縺", "繧", "譁", "蜈", "荳", "ï¿½")


def has_mojibake(value: Optional[str]) -> bool:
    return bool(value and any(marker in value for marker in BAD_MARKERS))


def replace_known_terms(text: Optional[str], replacements: Dict[str, str]) -> Optional[str]:
    if not text:
        return text

    repaired = text
    for old, new in sorted(replacements.items(), key=lambda item: len(item[0]), reverse=True):
        if old and new and old != new:
            repaired = repaired.replace(old, new)
    return repaired


def score_text(score: Optional[float]) -> str:
    if score is None:
        return "算出対象"
    return f"{score:.1f}"


def build_clean_analysis(race: models.Race, predictions: Iterable[models.Prediction]) -> str:
    ordered = sorted(
        [p for p in predictions if p.horse_name],
        key=lambda p: p.deviation_score if p.deviation_score is not None else -999.0,
        reverse=True,
    )

    course = "条件未取得"
    if race.course_type and race.distance:
        course = f"{race.course_type}{race.distance}m"

    title = race.race_name or "レース"
    lines = [
        f"{race.venue_name}{race.race_number}R「{title}」は、{course}で行われる一戦です。"
    ]

    if not ordered:
        lines.append("出走馬データをもとに、枠順、近走内容、脚質傾向を総合して確認したいレースです。")
        return "\n\n".join(lines)

    top = ordered[0]
    lines.append(
        f"AIは{top.horse_number}番{top.horse_name}を最上位に評価しました。"
        f"偏差値は{score_text(top.deviation_score)}で、同条件の比較では中心候補として扱いやすい評価です。"
    )

    if len(ordered) >= 2:
        second = ordered[1]
        lines.append(
            f"相手候補は{second.horse_number}番{second.horse_name}。"
            f"偏差値{score_text(second.deviation_score)}で、上位評価との差を見ながら相手関係を確認したい存在です。"
        )

    if len(ordered) >= 3:
        third = ordered[2]
        lines.append(
            f"3番手は{third.horse_number}番{third.horse_name}。"
            f"偏差値{score_text(third.deviation_score)}で、展開や馬場次第では評価を上げられる余地があります。"
        )

    lines.append(
        "当日の馬場状態、馬体重、直前気配で評価が動く可能性があります。"
        "AI偏差値だけで結論を固定せず、上位馬の位置取りとレース条件を合わせて確認してください。"
    )
    return "\n\n".join(lines)


def update_person(db, model, person_id: Optional[str], name: Optional[str]) -> int:
    if not person_id or not name:
        return 0

    record = db.query(model).filter(model.id == person_id).first()
    if record:
        if record.name != name:
            record.name = name
            return 1
        return 0

    db.add(model(id=person_id, name=name))
    return 1


def repair_race(db, race: models.Race, dry_run: bool, use_cache: bool) -> Dict[str, int]:
    is_nar = int(race.id[4:6]) >= 30
    old_race_name = race.race_name
    old_ai_text = race.ai_analysis_text
    old_prediction_names = {
        p.horse_id: p.horse_name
        for p in db.query(models.Prediction).filter(models.Prediction.race_id == race.id).all()
    }

    html = scraper.get_shutuba_html_content(
        race.id,
        is_nar=is_nar,
        force_download=not use_cache,
        target_date=None if use_cache else race.race_date,
    )
    if not html:
        print(f"  -> [WARN] {race.id}: 出馬表HTMLを取得できませんでした")
        return {"races": 0, "horses": 0, "people": 0, "predictions": 0, "texts": 0, "remaining_bad": 1}

    parsed = parser.parse_shutuba_page(html, race.id)
    if not parsed or not parsed.get("horses"):
        print(f"  -> [WARN] {race.id}: 出馬表を解析できませんでした")
        return {"races": 0, "horses": 0, "people": 0, "predictions": 0, "texts": 0, "remaining_bad": 1}

    race_info = parsed.get("race_info", {})
    horses = parsed.get("horses", [])
    replacements: Dict[str, str] = {}
    counts = {"races": 0, "horses": 0, "people": 0, "predictions": 0, "texts": 0, "remaining_bad": 0}

    new_race_name = race_info.get("race_name")
    if new_race_name and new_race_name != old_race_name:
        replacements[old_race_name] = new_race_name
        race.race_name = new_race_name
        counts["races"] += 1

    for field in ("course_type", "distance", "weather", "ground_condition", "total_horses"):
        value = race_info.get(field)
        if value is not None and getattr(race, field) != value:
            setattr(race, field, value)
            counts["races"] += 1

    correct_by_id = {h.get("horse_id"): h for h in horses if h.get("horse_id")}
    correct_by_number = {h.get("horse_number"): h for h in horses if h.get("horse_number") is not None}

    for horse in horses:
        horse_id = horse.get("horse_id")
        horse_name = horse.get("horse_name")
        if horse_id and horse_name:
            horse_record = db.query(models.Horse).filter(models.Horse.id == horse_id).first()
            if horse_record:
                if horse_record.name != horse_name:
                    replacements[horse_record.name] = horse_name
                    horse_record.name = horse_name
                    horse_record.sex = horse.get("sex") or horse_record.sex
                    horse_record.age = horse.get("age") or horse_record.age
                    counts["horses"] += 1
            else:
                db.add(models.Horse(id=horse_id, name=horse_name, sex=horse.get("sex"), age=horse.get("age")))
                counts["horses"] += 1

        counts["people"] += update_person(db, models.Jockey, horse.get("jockey_id"), horse.get("jockey_name"))
        counts["people"] += update_person(db, models.Trainer, horse.get("trainer_id"), horse.get("trainer_name"))

        if horse_id:
            result = (
                db.query(models.Result)
                .filter(models.Result.race_id == race.id, models.Result.horse_id == horse_id)
                .first()
            )
            if result:
                for field in ("waku_number", "horse_number", "weight_carried", "horse_weight", "horse_weight_diff"):
                    value = horse.get(field)
                    if value is not None and getattr(result, field) != value:
                        setattr(result, field, value)

    predictions = db.query(models.Prediction).filter(models.Prediction.race_id == race.id).all()
    for prediction in predictions:
        correct = correct_by_id.get(prediction.horse_id) or correct_by_number.get(prediction.horse_number)
        if not correct:
            continue

        new_name = correct.get("horse_name")
        if new_name and prediction.horse_name != new_name:
            replacements[prediction.horse_name] = new_name
            prediction.horse_name = new_name
            counts["predictions"] += 1

        if correct.get("waku_number") is not None:
            prediction.waku_number = correct.get("waku_number")
        if correct.get("horse_number") is not None:
            prediction.horse_number = correct.get("horse_number")

    for old_name, new_name in old_prediction_names.items():
        correct = correct_by_id.get(old_name)
        if correct and correct.get("horse_name"):
            replacements[new_name] = correct["horse_name"]

    repaired_text = replace_known_terms(old_ai_text, replacements)
    if has_mojibake(repaired_text):
        repaired_text = build_clean_analysis(race, predictions)

    if repaired_text != old_ai_text:
        race.ai_analysis_text = repaired_text
        counts["texts"] += 1

    if has_mojibake(race.race_name) or has_mojibake(race.ai_analysis_text):
        counts["remaining_bad"] += 1
    for prediction in predictions:
        if has_mojibake(prediction.horse_name):
            counts["remaining_bad"] += 1

    if not dry_run:
        db.commit()
    else:
        db.rollback()

    return counts


def main() -> None:
    arg_parser = argparse.ArgumentParser(description="指定日の文字化けしたレースデータを出馬表から修復します")
    arg_parser.add_argument("--date", required=True, help="修復対象日。YYYY-MM-DD形式")
    arg_parser.add_argument("--apply", action="store_true", help="DBへ修復内容を保存します。未指定ならドライラン")
    arg_parser.add_argument("--use-cache", action="store_true", help="既存の出馬表HTMLキャッシュを優先して使います")
    args = arg_parser.parse_args()

    target_date = datetime.datetime.strptime(args.date, "%Y-%m-%d").date()
    dry_run = not args.apply

    db = SessionLocal()
    totals = {"races": 0, "horses": 0, "people": 0, "predictions": 0, "texts": 0, "remaining_bad": 0}
    try:
        races = (
            db.query(models.Race)
            .filter(models.Race.race_date == target_date)
            .order_by(models.Race.venue_name, models.Race.race_number)
            .all()
        )
        print(f"対象日: {target_date} / レース数: {len(races)} / モード: {'DRY-RUN' if dry_run else 'APPLY'}")

        for index, race in enumerate(races, 1):
            print(f"[{index}/{len(races)}] {race.id} {race.venue_name}{race.race_number}R")
            counts = repair_race(db, race, dry_run=dry_run, use_cache=args.use_cache)
            for key in totals:
                totals[key] += counts[key]

        print("修復集計:")
        for key, value in totals.items():
            print(f"  {key}: {value}")

        if dry_run:
            print("ドライランのためDBは更新していません。反映する場合は --apply を付けて再実行してください。")
        elif totals["remaining_bad"]:
            print("[WARN] 修復後も文字化け疑いが残っている項目があります。")
        else:
            print("修復が完了しました。")
    finally:
        db.close()


if __name__ == "__main__":
    main()
