from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Xmarket API",
    description="Everything Market - Reality Engine + Orderbook",
    version="0.1.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Run on application startup"""
    logger.info("Starting Xmarket Backend...")
    logger.info(f"Database: {os.getenv('DATABASE_URL', 'sqlite:///./data.db')[:20]}...")
    logger.info(f"LLM Mode: {os.getenv('LLM_MODE', 'heuristic')}")
    
    # Initialize database tables
    from app.models import Base, engine
    Base.metadata.create_all(engine)
    logger.info("Database tables created/verified")


@app.on_event("shutdown")
async def shutdown_event():
    """Run on application shutdown"""
    logger.info("Shutting down Xmarket Backend...")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "xmarket-backend",
        "status": "running",
        "version": "0.1.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health():
    """Health check endpoint for Railway"""
    return {
        "status": "healthy",
        "service": "xmarket-backend"
    }


# Import and include API routes
from app.api import routes
app.include_router(routes.router, prefix="/api/v1", tags=["API"])

logger.info("Xmarket Backend initialized successfully")
