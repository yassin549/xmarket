import sqlalchemy as sa
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime, timezone

Base = declarative_base()

class Event(Base):
    __tablename__ = 'events'
    id = sa.Column(sa.String, primary_key=True)
    url = sa.Column(sa.String)
    title = sa.Column(sa.String)
    published = sa.Column(sa.DateTime(timezone=True))
    source_id = sa.Column(sa.String)
    summary = sa.Column(sa.Text)
    impact = sa.Column(sa.Float)
    created_at = sa.Column(sa.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class Score(Base):
    __tablename__ = 'scores'
    stock_id = sa.Column(sa.String, primary_key=True)
    score = sa.Column(sa.Float)
    confidence = sa.Column(sa.Float)
    last_updated = sa.Column(sa.DateTime(timezone=True))

class LLMCall(Base):
    __tablename__ = 'llm_calls'
    id = sa.Column(sa.Integer, primary_key=True, autoincrement=True)
    timestamp = sa.Column(sa.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    mode = sa.Column(sa.String(20))  # 'heuristic', 'railway', 'api'
    input_hash = sa.Column(sa.String(64))
    event_ids = sa.Column(sa.Text)  # JSON array of event IDs
    summary = sa.Column(sa.Text)
    impact_points = sa.Column(sa.Float)
    rationale = sa.Column(sa.Text)
    model_name = sa.Column(sa.String(100))
    tokens_used = sa.Column(sa.Integer)
    cost_usd = sa.Column(sa.Float)
