from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database.database import get_db
from crud import race_crud
from schemas import race_schema
from datetime import date
# ▼▼▼▼▼ 【修正点】typingからDictとAnyをインポート ▼▼▼▼▼
from typing import Optional, List, Dict, Any
# ▲▲▲▲▲ 修正ここまで ▲▲▲▲▲

router = APIRouter()


@router.get("/weekly-grade-races", response_model=List[race_schema.WeeklyGradeRace])
def read_weekly_grade_races(db: Session = Depends(get_db)):
    """
    近日開催の中央・地方重賞を返すエンドポイント。

    ⚠️ 重要: この定義は /{target_date} より前に置くこと。
    FastAPI はルートを定義順に評価するため、
    /{target_date} が先にあると "weekly-grade-races" を
    日付としてパースしようとして 422 エラーになる。
    """
    return race_crud.get_weekly_grade_races(db=db)


@router.get("/stats/accuracy", response_model=race_schema.PredictionAccuracySummary)
def read_prediction_accuracy_summary(
    days: int = Query(30, ge=7, le=180, description="集計対象日数"),
    db: Session = Depends(get_db),
):
    """
    AI偏差値上位馬の実測成績を返す。

    的中率だけを強調せず、上位馬の複勝傾向、条件別の得意不得意、
    外れたレースの確認材料を同じレスポンスで扱う。
    """
    return race_crud.get_prediction_accuracy_summary(db=db, days=days)


@router.get("/{target_date}", response_model=race_schema.RaceDayPrediction)
def read_predictions_for_date(target_date: date, db: Session = Depends(get_db)):
    """
    指定された日付のJRAおよびNARのレース予測を取得するエンドポイント。

    ▼▼▼【修正: 日付形式エラーをキャッチして適切なレスポンスを返す】▼▼▼
    FastAPIの日付パース失敗時に自動的に422エラーが返されますが、
    より詳細なエラーハンドリングのためにバリデーションロジックを追加します
    ▲▲▲【修正ここまで】▲▲▲
    """
    # ▼▼▼【修正: HTTPExceptionを除く予期しないエラーをキャッチ】▼▼▼
    try:
        predictions = race_crud.get_predictions_by_date(db=db, target_date=target_date)
        if not predictions["jra"] and not predictions["nar"]:
            raise HTTPException(status_code=404, detail=f"Predictions for date {target_date} not found")
        return predictions
    except HTTPException:
        # HTTPExceptionはそのまま再発生（404など）
        raise
    except Exception as e:
        # その他の予期しないエラーをログして500を返す
        import traceback
        print(f"Error fetching predictions for date {target_date}:", traceback.format_exc())
        raise HTTPException(status_code=500, detail="Internal server error while fetching predictions")
    # ▲▲▲【修正ここまで】▲▲▲

@router.get("/hits/top-payouts", response_model=List[race_schema.TopPayoutHit])
def read_top_payout_hits(db: Session = Depends(get_db)):
    """
    過去1週間のAI予測による高配当的中トップ5を取得する。
    """
    top_hits = race_crud.get_top_payout_hits(db=db, days=7, limit=5)
    return top_hits

@router.get("/hits/high-payouts/{target_date}", response_model=List[race_schema.TopPayoutHit])
def read_high_payout_hits_for_date(target_date: date, db: Session = Depends(get_db)):
    """
    指定された日付のAI予測による高配当（10,000円以上）の的中をすべて取得する。
    """
    high_payout_hits = race_crud.get_high_payout_hits_for_date(db=db, target_date=target_date)
    return high_payout_hits

@router.get("/special-pick/{target_date}", response_model=Optional[race_schema.SpecialPick])
def read_special_pick(target_date: date, db: Session = Depends(get_db)):
    """
    指定された日付の「注目馬」を取得するエンドポイント
    """
    pick = race_crud.get_special_pick_for_date(db=db, target_date=target_date)
    if not pick or not pick.race:
        return None
    
    commentary = f"AI偏差値 {pick.deviation_score:.2f}！{pick.race.venue_name}{pick.race.race_number}R の {pick.horse_name} を詳しく見る →"
    
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
    start_date: date = Query(date(2000, 1, 1), description="集計開始日"),
    end_date: date = Query(date.today(), description="集計終了日"),
    db: Session = Depends(get_db)
):
    """
    指定されたレースIDと期間に基づいて、フィルタリングされた対戦成績を動的に計算して返す。
    """
    matchup_data = race_crud.get_filtered_matchups_for_race(
        db=db, 
        race_id=race_id, 
        start_date=start_date, 
        end_date=end_date
    )
    if matchup_data is None:
        raise HTTPException(status_code=404, detail=f"Matchup data for race {race_id} not found")

    return race_schema.Matchup(matchup_data=matchup_data)

@router.get("/sitemap/all-race-urls", response_model=List[Dict[str, Any]])
def get_all_race_urls_for_sitemap(db: Session = Depends(get_db)):
    """
    サイトマップ生成のために、全レースのURL情報を取得するエンドポイント。
    """
    urls = race_crud.get_all_race_urls(db=db)
    return urls

@router.get("/sitemap/heavy-stakes-urls", response_model=List[Dict[str, Any]])
def get_heavy_stakes_race_urls_for_sitemap(db: Session = Depends(get_db)):
    """
    サイトマップ生成のために、重賞レースのURL情報を取得するエンドポイント。
    """
    urls = race_crud.get_heavy_stakes_race_urls(db=db)
    return urls
