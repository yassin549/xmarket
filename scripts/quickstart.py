"""
Quick start script - sets up and runs all services.
"""
import subprocess
import sys
import os
import time

def run_command(cmd, cwd=None, check=True):
    """Run a command and print output."""
    print(f"\n▶ Running: {cmd}")
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            cwd=cwd,
            check=check,
            capture_output=True,
            text=True
        )
        if result.stdout:
            print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Error: {e}")
        if e.stderr:
            print(e.stderr)
        return False

def main():
    """Quick start all services."""
    print("=" * 60)
    print("Everything Market - Quick Start")
    print("=" * 60)
    
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # Step 1: Install Python dependencies
    print("\n📦 Step 1: Installing Python dependencies...")
    
    for service in ["backend", "orderbook", "reality-engine"]:
        service_dir = os.path.join(base_dir, service)
        if not run_command(f"pip install -r requirements.txt", cwd=service_dir, check=False):
            print(f"⚠️  Warning: Failed to install {service} dependencies")
    
    # Step 2: Download spaCy model
    print("\n📦 Step 2: Downloading spaCy model...")
    run_command("python -m spacy download en_core_web_sm", check=False)
    
    # Step 3: Initialize database
    print("\n🗄️  Step 3: Initializing database...")
    scripts_dir = os.path.join(base_dir, "scripts")
    run_command("python init_db.py", cwd=scripts_dir)
    
    # Step 4: Install frontend dependencies
    print("\n📦 Step 4: Installing frontend dependencies...")
    frontend_dir = os.path.join(base_dir, "frontend")
    run_command("npm install", cwd=frontend_dir, check=False)
    
    print("\n" + "=" * 60)
    print("✅ Setup Complete!")
    print("=" * 60)
    print("\n🚀 To start the services, run these commands in separate terminals:")
    print("\n  Terminal 1 (Backend):")
    print("    cd backend")
    print("    uvicorn app.main:app --reload --port 8000")
    print("\n  Terminal 2 (Orderbook):")
    print("    cd orderbook")
    print("    uvicorn app.main:app --reload --port 8001")
    print("\n  Terminal 3 (Reality Engine):")
    print("    cd reality-engine")
    print("    python -m app.main")
    print("\n  Terminal 4 (Frontend):")
    print("    cd frontend")
    print("    npm run dev")
    print("\n📊 Then open http://localhost:3000 in your browser")
    print("=" * 60)

if __name__ == "__main__":
    main()
