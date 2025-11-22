"""
Export database snapshot for backup/migration.
"""
import json
from datetime import datetime
from backend.app.database import get_db_context
from backend.app.models import Stock, Score, Event

def export_snapshot():
    """Export current database state to JSON."""
    print("Exporting database snapshot...")
    
    snapshot = {
        "timestamp": datetime.utcnow().isoformat(),
        "stocks": [],
        "scores": [],
        "recent_events": []
    }
    
    with get_db_context() as db:
        # Export stocks
        stocks = db.query(Stock).all()
        for stock in stocks:
            snapshot["stocks"].append({
                "symbol": stock.symbol,
                "name": stock.name,
                "description": stock.description,
                "market_weight": stock.market_weight,
                "reality_weight": stock.reality_weight,
                "initial_score": stock.initial_score,
                "is_active": stock.is_active
            })
        
        # Export scores
        scores = db.query(Score).all()
        for score in scores:
            snapshot["scores"].append({
                "symbol": score.symbol,
                "reality_score": score.reality_score,
                "final_price": score.final_price,
                "confidence": score.confidence,
                "last_updated": score.last_updated.isoformat()
            })
        
        # Export recent events (last 100)
        events = db.query(Event).order_by(Event.created_at.desc()).limit(100).all()
        for event in events:
            snapshot["recent_events"].append({
                "id": event.id,
                "symbol": event.symbol,
                "impact_points": event.impact_points,
                "quick_score": event.quick_score,
                "summary": event.summary,
                "created_at": event.created_at.isoformat()
            })
    
    # Save to file
    filename = f"snapshot_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
    with open(filename, "w") as f:
        json.dump(snapshot, f, indent=2)
    
    print(f"✅ Snapshot saved to {filename}")
    print(f"   Stocks: {len(snapshot['stocks'])}")
    print(f"   Scores: {len(snapshot['scores'])}")
    print(f"   Events: {len(snapshot['recent_events'])}")

if __name__ == "__main__":
    export_snapshot()
