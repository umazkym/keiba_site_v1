# C:\Users\tnszk\program\keiba-ai-site\backend\database\models.py
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
    course_type = Column(String, nullable=False) # 芝 or ダート
    distance = Column(Integer, nullable=False)
    
    predictions = relationship("Prediction", back_populates="race")
    results = relationship("Result", back_populates="race")

class Horse(Base):
    __tablename__ = "horses"
    id = Column(String, primary_key=True, index=True) # netkeibaのhorse_id
    name = Column(String, nullable=False, index=True)

    results = relationship("Result", back_populates="horse")

class Result(Base):
    __tablename__ = "results"
    id = Column(Integer, primary_key=True, autoincrement=True)
    race_id = Column(String, ForeignKey("races.id"), nullable=False, index=True)
    horse_id = Column(String, ForeignKey("horses.id"), nullable=False, index=True)
    
    rank = Column(Integer)
    gate_number = Column(Integer)
    horse_number = Column(Integer)
    finish_time_sec = Column(Float)
    # その他必要な過去成績データをカラムとして追加（コーナー通過順位、上がり3Fなど）
    corner_positions = Column(JSON) #例: [1, 2, 2, 3]

    race = relationship("Race", back_populates="results")
    horse = relationship("Horse", back_populates="results")
    
class Prediction(Base):
    __tablename__ = "predictions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    race_id = Column(String, ForeignKey("races.id"), nullable=False, index=True)
    horse_id = Column(String, nullable=False)
    horse_name = Column(String, nullable=False)
    horse_number = Column(Integer, nullable=False)

    deviation_score = Column(Float, nullable=False)
    mark = Column(String, nullable=False) # ◎, 〇, ▲, △, ☆
    
    # 1Cスタート指標
    start_1c_indicator = Column(Float)

    race = relationship("Race", back_populates="predictions")