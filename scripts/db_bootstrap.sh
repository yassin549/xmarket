#!/bin/bash
# Bootstrap script for Everything Market database
# Applies Alembic migrations and validates schema

echo "==============================================="
echo "Everything Market - Database Bootstrap"
echo "==============================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL environment variable is not set!"
    echo "Please set it to your PostgreSQL connection URL:"
    echo '  export DATABASE_URL="postgresql://user:password@localhost:5432/xmarket"'
    exit 1
fi

echo "✓ DATABASE_URL is set"
echo ""

# Apply migrations
echo "Applying database migrations..."
alembic upgrade head

if [ $? -ne 0 ]; then
    echo "ERROR: Migration failed!"
    exit 1
fi

echo "✓ Migrations applied successfully"
echo ""

# Show current migration version
echo "Current migration version:"
alembic current

echo ""
echo "==============================================="
echo "Database bootstrap complete!"
echo "==============================================="
echo ""
echo "To validate the schema, run:"
echo "  pytest tests/test_db_schema.py -v"
echo ""
