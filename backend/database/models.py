# C:\Users\tnszk\program\GitHub\backend\database\models.py
from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from .database import Base

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
    results = relationship("Result", back_populates="race")
    predictions = relationship("Prediction", back_populates="race")
    matchup = relationship("Matchup", back_populates="race", uselist=False) # ★★★ Matchupとのリレーションを追加 ★★★

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
    race = relationship("Race", back_populates="predictions")

# ★★★ 新しいテーブル定義を追加 ★★★
class Matchup(Base):
    __tablename__ = "matchups"
    id = Column(Integer, primary_key=True, autoincrement=True)
    race_id = Column(String, ForeignKey("races.id"), nullable=False, unique=True, index=True)
    matchup_data = Column(JSON, nullable=False)

    race = relationship("Race", back_populates="matchup")