"""
Admin CLI Tool
==============

Command-line utility for admin operations:
- Create stocks
- List stocks
- View pending audits
- Approve/reject audits

Usage:
    python scripts/admin_cli.py create-stock TECH "Technology Sector" --weights 0.6 0.4
    python scripts/admin_cli.py list-stocks
    python scripts/admin_cli.py list-audits
    python scripts/admin_cli.py approve-audit <audit-id> <admin-name>
"""

import requests
import argparse
import sys
import os
from typing import Optional

# Configuration
DEFAULT_BACKEND_URL = "http://localhost:8000"
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "your-admin-key-here")

def create_stock(
    symbol: str,
    name: str,
    description: Optional[str] = None,
    market_weight: float = 0.5,
    reality_weight: float = 0.5,
    min_price: float = 0.0,
    max_price: float = 100.0,
    backend_url: str = DEFAULT_BACKEND_URL
):
    """Create a new stock."""
    url = f"{backend_url}/api/v1/admin/stocks"
    headers = {"X-Admin-Key": ADMIN_API_KEY}
    payload = {
        "symbol": symbol.upper(),
        "name": name,
        "description": description,
        "market_weight": market_weight,
        "reality_weight": reality_weight,
        "min_price": min_price,
        "max_price": max_price
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()
        
        print(f"✅ Stock created successfully!")
        print(f"   Symbol: {data['symbol']}")
        print(f"   Name: {data['name']}")
        print(f"   Market Weight: {data['market_weight']}")
        print(f"   Reality Weight: {data['reality_weight']}")
        print(f"   Price Range: {data['min_price']} - {data['max_price']}")
        print(f"   Created: {data['created_at']}")
        
    except requests.exceptions.HTTPError as e:
        print(f"❌ Failed to create stock: {e}")
        print(f"   Response: {e.response.text}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

def list_stocks(backend_url: str = DEFAULT_BACKEND_URL):
    """List all stocks."""
    url = f"{backend_url}/api/v1/admin/stocks"
    headers = {"X-Admin-Key": ADMIN_API_KEY}
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        stocks = response.json()
        
        if not stocks:
            print("No stocks found. Create one with:")
            print('  python scripts/admin_cli.py create-stock TECH "Technology"')
            return
        
        print(f"\n📊 Stocks ({len(stocks)}):\n")
        for stock in stocks:
            print(f"  {stock['symbol']:10s} | {stock['name']:30s} | M:{stock['market_weight']:.1f} R:{stock['reality_weight']:.1f}")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

def list_audits(backend_url: str = DEFAULT_BACKEND_URL):
    """List pending audits."""
    url = f"{backend_url}/api/v1/admin/audits"
    headers = {"X-Admin-Key": ADMIN_API_KEY}
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        audits = response.json()
        
        if not audits:
            print("No pending audits.")
            return
        
        print(f"\n⚠️  Pending Audits ({len(audits)}):\n")
        for audit in audits:
            print(f"  ID: {audit['id']}")
            print(f"  Symbol: {audit['symbol']}")
            print(f"  Impact: {audit['impact']:+.1f}")
            print(f"  Summary: {audit['summary'][:80]}...")
            print(f"  Created: {audit['created_at']}")
            print()
            
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

def approve_audit(audit_id: str, approved_by: str, reject: bool = False, backend_url: str = DEFAULT_BACKEND_URL):
    """Approve or reject an audit."""
    url = f"{backend_url}/api/v1/admin/audits/{audit_id}/approve"
    headers = {"X-Admin-Key": ADMIN_API_KEY}
    payload = {
        "approved": not reject,
        "approved_by": approved_by
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()
        
        action = "rejected" if reject else "approved"
        print(f"✅ Audit {action} by {approved_by}")
        print(f"   Status: {data['status']}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Xmarket Admin CLI")
    parser.add_argument("--backend", default=DEFAULT_BACKEND_URL, help="Backend URL")
    
    subparsers = parser.add_subparsers(dest="command", help="Command to run")
    
    # Create stock
    create_parser = subparsers.add_parser("create-stock", help="Create a new stock")
    create_parser.add_argument("symbol", help="Stock symbol (e.g., TECH)")
    create_parser.add_argument("name", help="Stock name")
    create_parser.add_argument("--description", help="Stock description")
    create_parser.add_argument("--weights", nargs=2, type=float, metavar=("MARKET", "REALITY"),
                              help="Market and reality weights (default: 0.5 0.5)")
    create_parser.add_argument("--price-range", nargs=2, type=float, metavar=("MIN", "MAX"),
                              help="Min and max price (default: 0 100)")
    
    # List stocks
    subparsers.add_parser("list-stocks", help="List all stocks")
    
    # List audits
    subparsers.add_parser("list-audits", help="List pending audits")
    
    # Approve audit
    approve_parser = subparsers.add_parser("approve-audit", help="Approve an audit")
    approve_parser.add_argument("audit_id", help="Audit ID")
    approve_parser.add_argument("approved_by", help="Your admin name/ID")
    approve_parser.add_argument("--reject", action="store_true", help="Reject instead of approve")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    # Execute command
    if args.command == "create-stock":
        market_weight = 0.5
        reality_weight = 0.5
        if args.weights:
            market_weight, reality_weight = args.weights
            
        min_price = 0.0
        max_price = 100.0
        if args.price_range:
            min_price, max_price = args.price_range
            
        create_stock(
            args.symbol,
            args.name,
            args.description,
            market_weight,
            reality_weight,
            min_price,
            max_price,
            args.backend
        )
        
    elif args.command == "list-stocks":
        list_stocks(args.backend)
        
    elif args.command == "list-audits":
        list_audits(args.backend)
        
    elif args.command == "approve-audit":
        approve_audit(args.audit_id, args.approved_by, args.reject, args.backend)

if __name__ == "__main__":
    main()
