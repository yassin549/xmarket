"""
Database initialization script.
Creates all tables and seeds initial data.
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.app.database import init_db, get_db_context
from backend.app.models import Stock, Score
from config import constants

def seed_initial_data():
    """Seed database with initial stocks."""
    print("Seeding initial data...")
    
    with get_db_context() as db:
        # Check if stocks already exist
        existing = db.query(Stock).first()
        if existing:
            print("Database already seeded. Skipping...")
            return
        
        # Create ELON stock
        elon_stock = Stock(
            symbol="ELON",
            name="Elon Musk Sentiment Index",
            description="Tracks sentiment and news impact around Elon Musk and his companies (Tesla, SpaceX, X)",
            market_weight=constants.DEFAULT_MARKET_WEIGHT,
            reality_weight=constants.DEFAULT_REALITY_WEIGHT,
            initial_score=constants.INITIAL_PRICE
        )
        db.add(elon_stock)
        
        # Create AI_INDEX
        ai_stock = Stock(
            symbol="AI_INDEX",
            name="AI Industry Index",
            description="Composite index tracking AI industry sentiment and developments",
            market_weight=constants.DEFAULT_MARKET_WEIGHT,
            reality_weight=constants.DEFAULT_REALITY_WEIGHT,
            initial_score=constants.INITIAL_PRICE
        )
        db.add(ai_stock)
        
        # Create TECH stock
        tech_stock = Stock(
            symbol="TECH",
            name="Technology Sector Index",
            description="Broad technology sector sentiment tracker",
            market_weight=constants.DEFAULT_MARKET_WEIGHT,
            reality_weight=constants.DEFAULT_REALITY_WEIGHT,
            initial_score=constants.INITIAL_PRICE
        )
        db.add(tech_stock)
        
        # Create initial scores
        for symbol in ["ELON", "AI_INDEX", "TECH"]:
            score = Score(
                symbol=symbol,
                reality_score=constants.INITIAL_PRICE,
                final_price=constants.INITIAL_PRICE,
                confidence=0.5
            )
            db.add(score)
        
        db.commit()
        print("✅ Seeded 3 stocks: ELON, AI_INDEX, TECH")


def main():
    """Initialize database and seed data."""
    print("=" * 60)
    print("Everything Market - Database Initialization")
    print("=" * 60)
    
    print("\n1. Creating database tables...")
    init_db()
    print("✅ Tables created successfully")
    
    print("\n2. Seeding initial data...")
    seed_initial_data()
    
    print("\n" + "=" * 60)
    print("✅ Database initialization complete!")
    print("=" * 60)
    print("\nYou can now start the services:")
    print("  Backend:        cd backend && uvicorn app.main:app --reload --port 8000")
    print("  Orderbook:      cd orderbook && uvicorn app.main:app --reload --port 8001")
    print("  Reality Engine: cd reality-engine && python -m app.main")
    print("  Frontend:       cd frontend && npm run dev")


if __name__ == "__main__":
    main()
