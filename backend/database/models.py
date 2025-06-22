# C:\Users\tnszk\program\GitHub\backend\database\models.py
from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, JSON
from sqlalchemy.orm import relationship
from .database import Base

class Race(Base):
    __tablename__ = "races"
    
    id = Column(String, primary_key=True, index=True) # race_id
    race_date = Column(Date, nullable=False, index=True)
    venue_name = Column(String, nullable=False, index=True)
    race_number = Column(Integer, nullable=False)
    race_name = Column(String, nullable=False)
    race_type = Column(String, nullable=False) # 中央 or 地方
    
    course_type = Column(String) # 芝 or ダート or 障
    distance = Column(Integer)
    weather = Column(String)
    ground_condition = Column(String)
    total_horses = Column(Integer)

    # リレーションシップ
    results = relationship("Result", back_populates="race")
    predictions = relationship("Prediction", back_populates="race")

class Horse(Base):
    __tablename__ = "horses"
    
    id = Column(String, primary_key=True, index=True) # netkeibaのhorse_id
    name = Column(String, nullable=False, index=True)
    sex = Column(String)
    age = Column(Integer)
    
    # リレーションシップ
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
    time_diff = Column(Float) # 着差
    weight_carried = Column(Float) # 斤量
    horse_weight = Column(Integer)
    horse_weight_diff = Column(Integer)
    popularity = Column(Integer)
    odds = Column(Float)
    agari_3f = Column(Float) # 上り
    corner_positions = Column(JSON) # コーナー通過順位 (例: [1, 2, 2, 3])
    
    # リレーションシップ
    race = relationship("Race", back_populates="results")
    horse = relationship("Horse", back_populates="results")
    
class Prediction(Base):
    __tablename__ = "predictions"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    race_id = Column(String, ForeignKey("races.id"), nullable=False, index=True)
    horse_id = Column(String, nullable=False, index=True)
    
    horse_name = Column(String, nullable=False)
    horse_number = Column(Integer, nullable=False)
    
    deviation_score = Column(Float, nullable=False)
    mark = Column(String, nullable=False) # ◎, 〇, ▲, △, ☆
    
    start_1c_indicator = Column(Float)

    # リレーションシップ
    race = relationship("Race", back_populates="predictions")