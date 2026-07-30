from typing import List, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from crud import growth_crud
from database.database import get_db
from schemas import growth_schema


router = APIRouter()


def _set_cache(response: Response, max_age: int, stale: int = 300) -> None:
    response.headers["Cache-Control"] = (
        f"public, max-age={max_age}, stale-while-revalidate={stale}"
    )


@router.get("/summary", response_model=growth_schema.GrowthSummaryResponse)
def read_growth_summary(
    response: Response,
    db: Session = Depends(get_db),
):
    result = growth_crud.get_growth_summary(db)
    _set_cache(response, 21600, 1800)
    return result


@router.get("/search", response_model=growth_schema.SearchResponse)
def read_entity_search(
    response: Response,
    q: str = Query(..., min_length=1, max_length=60),
    limit: int = Query(20, ge=1, le=40),
    db: Session = Depends(get_db),
):
    result = growth_crud.search_entities(db, q, limit=limit)
    _set_cache(response, 600, 60)
    return result


@router.get(
    "/directories/{entity_type}",
    response_model=growth_schema.EntityDirectoryResponse,
)
def read_entity_directory(
    entity_type: Literal["course", "horse", "jockey", "trainer"],
    response: Response,
    limit: int = Query(24, ge=1, le=100),
    offset: int = Query(0, ge=0, le=100000),
    indexable_only: bool = Query(False),
    db: Session = Depends(get_db),
):
    result = growth_crud.list_entities(
        db,
        entity_type,
        limit=limit,
        offset=offset,
        indexable_only=indexable_only,
    )
    _set_cache(response, 3600, 300)
    return result


@router.get(
    "/courses/{venue_slug}/{course_slug}",
    response_model=growth_schema.CourseDetailResponse,
)
def read_course_detail(
    venue_slug: str,
    course_slug: str,
    response: Response,
    db: Session = Depends(get_db),
):
    result = growth_crud.get_course_detail(db, venue_slug, course_slug)
    if result is None:
        response.headers["Cache-Control"] = "no-store"
        raise HTTPException(status_code=404, detail="Course data not found")
    _set_cache(response, 21600, 1800)
    return result


@router.get(
    "/horses/{entity_id}",
    response_model=growth_schema.EntityDetailResponse,
)
def read_horse_detail(
    entity_id: str,
    response: Response,
    db: Session = Depends(get_db),
):
    result = growth_crud.get_entity_detail(db, "horse", entity_id)
    if result is None:
        response.headers["Cache-Control"] = "no-store"
        raise HTTPException(status_code=404, detail="Horse data not found")
    _set_cache(response, 3600, 300)
    return result


@router.get(
    "/jockeys/{entity_id}",
    response_model=growth_schema.EntityDetailResponse,
)
def read_jockey_detail(
    entity_id: str,
    response: Response,
    db: Session = Depends(get_db),
):
    result = growth_crud.get_entity_detail(db, "jockey", entity_id)
    if result is None:
        response.headers["Cache-Control"] = "no-store"
        raise HTTPException(status_code=404, detail="Jockey data not found")
    _set_cache(response, 3600, 300)
    return result


@router.get(
    "/trainers/{entity_id}",
    response_model=growth_schema.EntityDetailResponse,
)
def read_trainer_detail(
    entity_id: str,
    response: Response,
    db: Session = Depends(get_db),
):
    result = growth_crud.get_entity_detail(db, "trainer", entity_id)
    if result is None:
        response.headers["Cache-Control"] = "no-store"
        raise HTTPException(status_code=404, detail="Trainer data not found")
    _set_cache(response, 3600, 300)
    return result


@router.get(
    "/race-series",
    response_model=growth_schema.RaceSeriesResponse,
)
def read_race_series(
    response: Response,
    name: str = Query(..., min_length=2, max_length=80),
    db: Session = Depends(get_db),
):
    result = growth_crud.get_race_series(db, name)
    if result is None:
        response.headers["Cache-Control"] = "no-store"
        raise HTTPException(status_code=404, detail="Race series data not found")
    _set_cache(response, 21600, 1800)
    return result


@router.get(
    "/races/{race_id}/features",
    response_model=growth_schema.RaceFeatureResponse,
)
def read_race_features(
    race_id: str,
    response: Response,
    db: Session = Depends(get_db),
):
    result = growth_crud.get_race_features(db, race_id)
    if result is None:
        response.headers["Cache-Control"] = "no-store"
        raise HTTPException(status_code=404, detail="Race data not found")
    _set_cache(response, 3600, 300)
    return result


@router.get(
    "/sitemap",
    response_model=List[growth_schema.DataSitemapEntry],
)
def read_data_sitemap(
    response: Response,
    db: Session = Depends(get_db),
):
    result = growth_crud.get_data_sitemap(db)
    _set_cache(response, 21600, 1800)
    return result
