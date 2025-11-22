"""
Database connection helper and utilities for Everything Market.
"""

from typing import Generator
from contextlib import contextmanager

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import OperationalError

from config.env import get_database_url


# Create engine (lazy - only connects when needed)
def get_engine():
    """Get SQLAlchemy engine from DATABASE_URL."""
    database_url = get_database_url()
    return create_engine(
        database_url,
        pool_pre_ping=True,  # Verify connections before using
        echo=False,  # Set to True for SQL query logging
    )


# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False)


@contextmanager
def get_db_session() -> Generator[Session, None, None]:
    """
    Context manager for database sessions.
    
    Usage:
        with get_db_session() as session:
            result = session.execute(text("SELECT 1"))
    """
    engine = get_engine()
    SessionLocal.configure(bind=engine)
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def check_database_connection() -> bool:
    """
    Check if database connection is working.
    
    Returns:
        True if connection successful, False otherwise
    """
    try:
        engine = get_engine()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except OperationalError:
        return False


def get_table_names() -> list[str]:
    """
    Get list of all table names in the database.
    
    Returns:
        List of table names
    """
    engine = get_engine()
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename
        """))
        return [row[0] for row in result]


def table_exists(table_name: str) -> bool:
    """
    Check if a table exists in the database.
    
    Args:
        table_name: Name of the table to check
        
    Returns:
        True if table exists, False otherwise
    """
    return table_name in get_table_names()
