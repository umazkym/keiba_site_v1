from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from database.database import get_db
from crud import race_crud
from schemas import race_schema
from datetime import date, timedelta, datetime, timezone
# ▼▼▼▼▼ 【修正点】typingからDictとAnyをインポート ▼▼▼▼▼
from typing import Optional, List, Dict, Any
# ▲▲▲▲▲ 修正ここまで ▲▲▲▲▲

router = APIRouter()

# ▼▼▼ Cache-Control制御ヘルパー ▼▼▼
_JST = timezone(timedelta(hours=9))
_RESULTS_DONE_HOUR_JST = 6  # JST 06:00以降は前日結果確定扱い


def _cache_control_for_date(target_date: date) -> str:
    """
    日付・時刻に応じた Cache-Control ヘッダー値。
    CDN（Google Frontend）・Vercel・ブラウザに伝わる。
    race_crud の in-memory TTL と整合させること。

    - 2日以上前: 4時間（結果確定済み・変化なし）
    - 昨日結果確定後（JST 06:00以降）: 4時間
    - 昨日結果未確定（JST 06:00前）: 5分
    - 当日: 15分 + stale-while-revalidate=60（レース更新を素早く反映）
    - 翌日以降: 30分 + stale-while-revalidate=60（データ投入前の段階）
    """
    today = datetime.now(_JST).date()

    if target_date < today - timedelta(days=1):
        return "public, max-age=14400"  # 2日以上前: 4時間

    if target_date == today - timedelta(days=1):
        now_jst = datetime.now(_JST)
        if now_jst.hour >= _RESULTS_DONE_HOUR_JST:
            return "public, max-age=14400"  # 昨日・結果確定後: 4時間
        else:
            return "public, max-age=300"    # 昨日・結果未確定: 5分

    if target_date == today:
        return "public, max-age=900, stale-while-revalidate=60"  # 当日: 15分

    return "public, max-age=1800, stale-while-revalidate=60"  # 翌日以降: 30分
# ▲▲▲ Cache-Control制御ヘルパー ▲▲▲


@router.get("/weekly-grade-races", response_model=List[race_schema.WeeklyGradeRace])
def read_weekly_grade_races(response: Response, db: Session = Depends(get_db)):
    """
    近日開催の中央・地方重賞を返すエンドポイント。

    ⚠️ 重要: この定義は /{target_date} より前に置くこと。
    FastAPI はルートを定義順に評価するため、
    /{target_date} が先にあると "weekly-grade-races" を
    日付としてパースしようとして 422 エラーになる。
    """
    races = race_crud.get_weekly_grade_races(db=db)
    response.headers["Cache-Control"] = "public, max-age=1800, stale-while-revalidate=60"
    return races


@router.get("/stats/accuracy", response_model=race_schema.PredictionAccuracySummary)
def read_prediction_accuracy_summary(
    response: Response,
    days: int = Query(30, ge=7, le=180, description="集計対象日数"),
    db: Session = Depends(get_db),
):
    """
    AI偏差値上位馬の実測成績を返す。

    的中率だけを強調せず、上位馬の複勝傾向、条件別の得意不得意、
    外れたレースの確認材料を同じレスポンスで扱う。
    """
    result = race_crud.get_prediction_accuracy_summary(db=db, days=days)
    response.headers["Cache-Control"] = "public, max-age=1800"
    return result


@router.get(
    "/article-preview/{target_date}",
    response_model=race_schema.ArticleRacePreviewResponse,
)
def read_article_race_preview(
    target_date: date,
    response: Response,
    race_name: str = Query(..., min_length=2, max_length=80, description="記事が対象とする正式レース名"),
    db: Session = Depends(get_db),
):
    """検証済み記事導線に必要なレース情報と上位3頭だけを返す。"""
    result = race_crud.get_article_race_preview(db=db, target_date=target_date, race_name=race_name)
    max_age = 3600 if target_date < datetime.now(_JST).date() else 300
    response.headers["Cache-Control"] = f"public, max-age={max_age}, stale-while-revalidate=60"
    return result


@router.get("/{target_date}", response_model=race_schema.RaceDayPrediction)
def read_predictions_for_date(target_date: date, response: Response, db: Session = Depends(get_db)):
    """
    指定された日付のJRAおよびNARのレース予測を取得するエンドポイント。

    ★ Cache-Control を日付に応じて明示付与する。
    ★ 404 時は no-store を付与し CDN がエラーをキャッシュするのを防ぐ。
    """
    try:
        predictions = race_crud.get_predictions_by_date(db=db, target_date=target_date)
        if not predictions["jra"] and not predictions["nar"]:
            response.headers["Cache-Control"] = "no-store"
            raise HTTPException(status_code=404, detail=f"Predictions for date {target_date} not found")
        response.headers["Cache-Control"] = _cache_control_for_date(target_date)
        return predictions
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error fetching predictions for date {target_date}:", traceback.format_exc())
        response.headers["Cache-Control"] = "no-store"
        raise HTTPException(status_code=500, detail="Internal server error while fetching predictions")


@router.get("/hits/top-payouts", response_model=List[race_schema.TopPayoutHit])
def read_top_payout_hits(response: Response, db: Session = Depends(get_db)):
    """
    過去1週間のAI予測による高配当的中トップ5を取得する。
    """
    top_hits = race_crud.get_top_payout_hits(db=db, days=7, limit=5)
    response.headers["Cache-Control"] = "public, max-age=1800"
    return top_hits


@router.get("/hits/high-payouts/{target_date}", response_model=List[race_schema.TopPayoutHit])
def read_high_payout_hits_for_date(target_date: date, response: Response, db: Session = Depends(get_db)):
    """
    指定された日付のAI予測による高配当（10,000円以上）の的中をすべて取得する。
    """
    high_payout_hits = race_crud.get_high_payout_hits_for_date(db=db, target_date=target_date)
    response.headers["Cache-Control"] = _cache_control_for_date(target_date)
    return high_payout_hits


@router.get("/special-pick/{target_date}", response_model=Optional[race_schema.SpecialPick])
def read_special_pick(target_date: date, response: Response, db: Session = Depends(get_db)):
    """
    指定された日付の「注目馬」を取得するエンドポイント
    """
    pick = race_crud.get_special_pick_for_date(db=db, target_date=target_date)
    if not pick or not pick.race:
        response.headers["Cache-Control"] = "no-store"
        return None

    commentary = f"AI偏差値 {pick.deviation_score:.2f}！{pick.race.venue_name}{pick.race.race_number}R の {pick.horse_name} を詳しく見る →"

    response.headers["Cache-Control"] = _cache_control_for_date(target_date)
    return race_schema.SpecialPick(
        horse_id=pick.horse_id,
        horse_name=pick.horse_name,
        race_id=pick.race_id,
        race_name=pick.race.race_name,
        venue_name=pick.race.venue_name,
        race_number=pick.race.race_number,
        deviation_score=pick.deviation_score,
        commentary=commentary
    )


@router.get("/matchups/{race_id}", response_model=race_schema.Matchup)
def read_filtered_matchups_for_race(
    race_id: str,
    response: Response,
    start_date: date = Query(default=None, description="集計開始日（デフォルト: 5年前）"),
    end_date: date = Query(default=None, description="集計終了日（デフォルト: 今日）"),
    db: Session = Depends(get_db)
):
    """
    指定されたレースIDと期間に基づいて、フィルタリングされた対戦成績を動的に計算して返す。
    """
    if start_date is None:
        from datetime import date as _date
        start_date = _date.today() - timedelta(days=365 * 5)
    if end_date is None:
        end_date = date.today()

    matchup_data = race_crud.get_filtered_matchups_for_race(
        db=db,
        race_id=race_id,
        start_date=start_date,
        end_date=end_date
    )
    if matchup_data is None:
        response.headers["Cache-Control"] = "no-store"
        raise HTTPException(status_code=404, detail=f"Matchup data for race {race_id} not found")

    response.headers["Cache-Control"] = "public, max-age=3600"
    return race_schema.Matchup(matchup_data=matchup_data)


@router.get("/sitemap/all-race-urls", response_model=List[Dict[str, Any]])
def get_all_race_urls_for_sitemap(response: Response, db: Session = Depends(get_db)):
    """
    サイトマップ生成のために、全レースのURL情報を取得するエンドポイント。
    """
    urls = race_crud.get_all_race_urls(db=db)
    response.headers["Cache-Control"] = "public, max-age=21600"  # 6時間
    return urls


@router.get("/sitemap/heavy-stakes-urls", response_model=List[Dict[str, Any]])
def get_heavy_stakes_race_urls_for_sitemap(response: Response, db: Session = Depends(get_db)):
    """
    サイトマップ生成のために、重賞レースのURL情報を取得するエンドポイント。
    """
    urls = race_crud.get_heavy_stakes_race_urls(db=db)
    response.headers["Cache-Control"] = "public, max-age=21600"  # 6時間
    return urls
