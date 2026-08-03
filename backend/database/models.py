# C:\Users\tnszk\program\GitHub\backend\database\models.py
from sqlalchemy.orm import relationship
from .database import Base
from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, JSON, UniqueConstraint, DateTime, Index
from datetime import datetime, timezone


def _utcnow_naive():
    """既存のtimestamp without time zone列へ保存するUTC時刻を返す。"""

    return datetime.now(timezone.utc).replace(tzinfo=None)

class Race(Base):
    __tablename__ = "races"
    id = Column(String, primary_key=True, index=True)
    race_date = Column(Date, nullable=False, index=True)
    venue_name = Column(String, nullable=False, index=True)
    race_number = Column(Integer, nullable=False)
    race_name = Column(String, nullable=False)
    race_type = Column(String, nullable=False)
    course_type = Column(String)
    distance = Column(Integer)
    weather = Column(String)
    ground_condition = Column(String)
    total_horses = Column(Integer)
    ai_analysis_text = Column(String, nullable=True) # AIによるレース展開・展望等の自動生成テキスト
    
    results = relationship("Result", back_populates="race")
    predictions = relationship("Prediction", back_populates="race")
    matchup = relationship("Matchup", back_populates="race", uselist=False)
    returns = relationship("RaceReturn", back_populates="race")

class Horse(Base):
    __tablename__ = "horses"
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    sex = Column(String)
    age = Column(Integer)
    results = relationship("Result", back_populates="horse")

class Jockey(Base):
    __tablename__ = "jockeys"
    id = Column(String, primary_key=True, index=True)
    name = Column(String, index=True)

class Trainer(Base):
    __tablename__ = "trainers"
    id = Column(String, primary_key=True, index=True)
    name = Column(String, index=True)

class Result(Base):
    __tablename__ = "results"
    id = Column(Integer, primary_key=True, autoincrement=True)
    race_id = Column(String, ForeignKey("races.id"), nullable=False, index=True)
    horse_id = Column(String, ForeignKey("horses.id"), nullable=False, index=True)
    jockey_id = Column(String, ForeignKey("jockeys.id"), index=True)
    trainer_id = Column(String, ForeignKey("trainers.id"), index=True)
    rank = Column(Integer, index=True)
    waku_number = Column(Integer)
    horse_number = Column(Integer)
    finish_time_sec = Column(Float)
    time_diff = Column(Float)
    weight_carried = Column(Float)
    horse_weight = Column(Integer)
    horse_weight_diff = Column(Integer)
    popularity = Column(Integer)
    odds = Column(Float)
    agari_3f = Column(Float)
    corner_positions = Column(JSON)
    __table_args__ = (UniqueConstraint('race_id', 'horse_id', name='_race_horse_uc'),)
    race = relationship("Race", back_populates="results")
    horse = relationship("Horse", back_populates="results")
    
class Prediction(Base):
    __tablename__ = "predictions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    race_id = Column(String, ForeignKey("races.id"), nullable=False, index=True)
    horse_id = Column(String, nullable=False, index=True)
    horse_name = Column(String, nullable=False)
    horse_number = Column(Integer, nullable=False)
    waku_number = Column(Integer, nullable=True)
    deviation_score = Column(Float, nullable=True) 
    mark = Column(String, nullable=False)
    start_1c_indicator = Column(Float, nullable=True)
    # ==============================================================================
    # ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼ ここから修正 ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
    unpredictable_reason = Column(String, nullable=True) # 予測不能な理由を格納するカラム
    # ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲ ここまで修正 ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
    # ==============================================================================
    race = relationship("Race", back_populates="predictions")

class Matchup(Base):
    __tablename__ = "matchups"
    id = Column(Integer, primary_key=True, autoincrement=True)
    race_id = Column(String, ForeignKey("races.id"), nullable=False, unique=True, index=True)
    matchup_data = Column(JSON, nullable=False)
    race = relationship("Race", back_populates="matchup")

class HorseNumberAdvantage(Base):
    __tablename__ = "horse_number_advantages"
    id = Column(Integer, primary_key=True, autoincrement=True)
    venue_name = Column(String, nullable=False, index=True)
    course_type = Column(String, nullable=False, index=True)
    distance = Column(Integer, nullable=False, index=True)
    horse_number = Column(Integer, nullable=False, index=True)
    advantage_score = Column(Float, nullable=False)

    __table_args__ = (UniqueConstraint('venue_name', 'course_type', 'distance', 'horse_number', name='_hnav_uc'),)

class RaceReturn(Base):
    __tablename__ = "race_returns"
    id = Column(Integer, primary_key=True, autoincrement=True)
    race_id = Column(String, ForeignKey("races.id"), nullable=False, index=True)
    bet_type = Column(String, nullable=False)
    number_1 = Column(Integer, nullable=False)
    number_2 = Column(Integer, nullable=True)
    number_3 = Column(Integer, nullable=True)
    payout = Column(Integer, nullable=False)
    popularity = Column(Integer, nullable=True)

    __table_args__ = (UniqueConstraint('race_id', 'bet_type', 'number_1', 'number_2', 'number_3', name='_race_return_uc'),)
    race = relationship("Race", back_populates="returns")

class SnsPost(Base):
    __tablename__ = "sns_posts"
    id = Column(Integer, primary_key=True, autoincrement=True)
    content_hash = Column(String, nullable=False, unique=True, index=True)  # ツイート内容のハッシュ
    post_type = Column(String, nullable=False)  # 'hit', 'pick', 'reminder'
    posted_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    target_date = Column(Date, nullable=False, index=True)  # 対象日（昨日 or 今日）
    tweet_id = Column(String, nullable=True)  # Twitter上のID（引用RTなどで使用）
    
    __table_args__ = (
        UniqueConstraint('content_hash', 'target_date', name='_sns_post_unique'),
    )


class VideoPublication(Base):
    """外部動画プラットフォームへの投稿を段階的に再開するための状態管理。"""

    __tablename__ = "video_publications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    platform = Column(String, nullable=False, index=True)
    target_date = Column(Date, nullable=False, index=True)
    video_type = Column(String, nullable=False)
    stable_id = Column(String, nullable=False)
    status = Column(String, nullable=False, default="planned", index=True)
    remote_video_id = Column(String, nullable=True, index=True)
    scheduled_at = Column(DateTime, nullable=True)
    content_hash = Column(String, nullable=False)
    attempt_count = Column(Integer, nullable=False, default=0)
    last_error = Column(String, nullable=True)
    metadata_json = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint(
            "platform",
            "target_date",
            "video_type",
            "stable_id",
            name="_video_publication_unique",
        ),
    )


class DataPagePublication(Base):
    """データ詳細ページを検索エンジンへ段階公開するための状態管理。"""

    __tablename__ = "data_page_publications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    entity_type = Column(String, nullable=False)
    entity_id = Column(String, nullable=False)
    url = Column(String, nullable=False)
    status = Column(String, nullable=False, default="candidate")
    quality_score = Column(Float, nullable=False, default=0.0)
    score_factors = Column(JSON, nullable=False, default=dict)
    first_eligible_at = Column(DateTime, nullable=True)
    first_published_at = Column(DateTime, nullable=True)
    last_evaluated_at = Column(DateTime, nullable=False, default=_utcnow_naive)
    last_seen_data_at = Column(Date, nullable=True)
    created_at = Column(DateTime, nullable=False, default=_utcnow_naive)
    updated_at = Column(
        DateTime,
        nullable=False,
        default=_utcnow_naive,
        onupdate=_utcnow_naive,
    )

    __table_args__ = (
        UniqueConstraint(
            "entity_type",
            "entity_id",
            name="_data_page_publication_entity_unique",
        ),
        UniqueConstraint("url", name="_data_page_publication_url_unique"),
        Index(
            "ix_data_page_publications_status_score",
            "status",
            "quality_score",
        ),
    )
