import sqlalchemy as sa
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone
import os

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

# Database setup
DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///./data.db')

# Handle Railway PostgreSQL URL format (postgres:// -> postgresql://)
if DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)

engine = sa.create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith('sqlite') else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create tables
Base.metadata.create_all(engine)

def get_db():
    """Dependency for FastAPI endpoints to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
