"""
Everything Market Backend - Main FastAPI Application

This is the central backend service that:
- Receives reality events from reality-engine
- Validates and persists events
- Enforces anti-manipulation rules
- (Future) Coordinates with orderbook and broadcasts updates
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.ingest import router as ingest_router
from backend.admin import router as admin_router
from backend.public_api import router as public_router

# Create FastAPI application
app = FastAPI(
    title="Everything Market Backend",
    version="0.5.0",
    description="Reality event ingestion and market coordination service",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS (adjust for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(ingest_router)
app.include_router(admin_router)
app.include_router(public_router)


# ============================================================================
# Health & Status Endpoints
# ============================================================================

@app.get(
    "/health",
    tags=["health"],
    summary="Health check endpoint",
    description="Returns service health status"
)
async def health_check():
    """
    Health check endpoint for monitoring and load balancers.
    
    Returns:
        dict: Health status
    """
    return {
        "status": "healthy",
        "service": "backend",
        "version": "0.3.0"
    }


@app.get(
    "/",
    tags=["info"],
    summary="API information",
    description="Returns API information and available endpoints"
)
async def root():
    """
    Root endpoint with API information.
    
    Returns:
        dict: API info and links
    """
    return {
        "service": "Everything Market Backend",
        "version": "0.3.0",
        "docs": "/docs",
        "health": "/health",
        "endpoints": {
            "reality_ingest": "POST /api/v1/reality/ingest"
        }
    }


# ============================================================================
# Startup & Shutdown Events
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Run on application startup."""
    print("🚀 Everything Market Backend starting...")
    print("📡 Reality ingest endpoint: POST /api/v1/reality/ingest")
    print("📚 API docs: http://localhost:8000/docs")


@app.on_event("shutdown")
async def shutdown_event():
    """Run on application shutdown."""
    print("🛑 Everything Market Backend shutting down...")


# ============================================================================
# Run with: uvicorn backend.main:app --reload
# ============================================================================
