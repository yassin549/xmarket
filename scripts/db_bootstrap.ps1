#!/usr/bin/env pwsh
# Bootstrap script for Everything Market database
# Applies Alembic migrations and validates schema

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "Everything Market - Database Bootstrap" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Check if DATABASE_URL is set
if (-not $env:DATABASE_URL) {
    Write-Host "ERROR: DATABASE_URL environment variable is not set!" -ForegroundColor Red
    Write-Host "Please set it to your PostgreSQL connection URL:" -ForegroundColor Yellow
    Write-Host '  $env:DATABASE_URL="postgresql://user:password@localhost:5432/xmarket"' -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ DATABASE_URL is set" -ForegroundColor Green
Write-Host ""

# Apply migrations
Write-Host "Applying database migrations..." -ForegroundColor Cyan
alembic upgrade head

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Migration failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Migrations applied successfully" -ForegroundColor Green
Write-Host ""

# Show current migration version
Write-Host "Current migration version:" -ForegroundColor Cyan
alembic current

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "Database bootstrap complete!" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To validate the schema, run:" -ForegroundColor Yellow
Write-Host "  pytest tests/test_db_schema.py -v" -ForegroundColor Yellow
Write-Host ""
