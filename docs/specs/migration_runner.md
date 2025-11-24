# Database Migration Strategy

## Overview

This document defines the migration execution strategy for the Everything Market platform. All database schema changes must follow these procedures to ensure safety, traceability, and reproducibility.

## Migration Tooling

### Recommended Tools

1. **node-pg-migrate** (Recommended for Node.js projects)
   ```bash
   npm install node-pg-migrate
   ```
   - Pros: TypeScript support, programmatic migrations, automatic rollback generation
   - Cons: Library dependency

2. **db-migrate** (Alternative)
   ```bash
   npm install db-migrate db-migrate-pg
   ```
   - Pros: Multi-database support, mature ecosystem
   - Cons: More configuration overhead

3. **Raw SQL + Version Tracking** (Current approach - Phase 1)
   - Pros: Maximum control, no dependencies, clear SQL audit trail
   - Cons: Manual rollback management, no automatic versioning
   - **Status**: Using this for Phase 1; will evaluate migration library for Phase 2+

## Migration Naming Convention

```
<version>_<description>.sql
```

**Examples**:
- `001_create_jobs.sql`
- `002_create_core_schema.sql`
- `003_add_markets_index.sql`
- `004_alter_events_add_impact_score.sql`

**Rules**:
- Version numbers are sequential, zero-padded to 3 digits
- Description in snake_case, concise but descriptive
- One migration per file
- Each migration includes rollback instructions in comments

## Migration File Structure

Every migration SQL file must include:

```sql
-- Migration: <version>_<description>.sql
-- Purpose: <one-line description>
-- Phase: <project phase>
-- Checklist: <checklist reference>

-- ============================================================================
-- <SECTION NAME>
-- ============================================================================
-- <detailed documentation>

<SQL statements>

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- To rollback this migration:
--   <rollback SQL statements>
```

## Migration Execution Process

### Phase 1: Manual Execution (Current)

**Environment**: Staging only

**Steps**:
1. Review migration SQL in PR
2. Human approval required
3. Connect to staging database
   ```bash
   psql $NEON_DATABASE_URL
   ```
4. Execute migration
   ```sql
   \i src/infra/migrations/<version>_<description>.sql
   ```
5. Verify tables/columns created
   ```sql
   \dt
   \d <table_name>
   ```
6. Run smoke tests (see migration_checklist.md)
7. Document execution in `docs/decisions.md`

### Phase 2+: Automated Execution (Future)

**TODO**: Integrate migration tool into CI/CD

**Planned approach**:
- Migrations run automatically in preview deployments
- Require manual trigger for staging
- Require manual approval + audit_event for production
- Automatic rollback on failure in preview environments

## Rollback Requirements

Every migration must include:

1. **Rollback SQL** in comments at end of file
2. **Rollback test** in staging before production deployment
3. **Data preservation strategy** if migration involves data transformation

**Example**:
```sql
-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- To rollback this migration:
--   DROP TRIGGER IF EXISTS trg_jobs_updated_at ON jobs;
--   DROP FUNCTION IF EXISTS update_updated_at_column();
--   DROP TABLE IF EXISTS jobs CASCADE;
--
-- WARNING: This will delete all job data. Backup before rollback.
```

## Staging Validation Checklist

Before applying any migration to production:

- [ ] Migration applied successfully in staging
- [ ] All indexes created
- [ ] All constraints enforced (test with invalid data)
- [ ] Triggers functioning correctly
- [ ] Performance acceptable (run EXPLAIN ANALYZE on key queries)
- [ ] Rollback tested and verified
- [ ] No breaking changes to existing API contracts
- [ ] Documentation updated (ER diagrams, API specs)

## CI Integration

### Current (Phase 1)
- No automated migration execution
- CI validates SQL syntax only (future)

### Planned (Phase 2+)
```yaml
# .github/workflows/migrations.yml
name: Database Migrations

on:
  pull_request:
    paths:
      - 'src/infra/migrations/**'
      - 'src/infra/idempotency/migrations/**'

jobs:
  validate-migrations:
    runs-on: ubuntu-latest
    steps:
      - name: SQL Lint
        run: sqlfluff lint src/infra/migrations/
      
      - name: Check rollback scripts
        run: ./scripts/validate-rollback.sh
      
      - name: Apply to preview DB
        run: npm run migrate:preview
      
      - name: Run integration tests
        run: npm test -- --grep="migration"
```

## Migration Versioning Table (Future)

When migration tool is integrated, track applied migrations:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(10) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_by VARCHAR(255),  -- User or CI system
  checksum VARCHAR(64)  -- SHA256 of migration file
);
```

## Safety Rules

1. **Never modify applied migrations** - Create new migration to alter schema
2. **Always test rollback** - Verify rollback works before merging PR
3. **No data loss migrations without backup** - Require explicit backup step in PR
4. **Breaking changes require API versioning** - Coordinate with backend team
5. **Production migrations require audit_event** - Human approval recorded

## Emergency Rollback Procedure

If a migration causes production issues:

1. **Immediate**: Rollback using documented SQL in migration file
2. **Document**: Create incident in `ops/postmortems/`
3. **Fix**: Create new migration to fix issue (do not modify original)
4. **Review**: Post-mortem within 72 hours

## References

- `docs/runbooks/migration_checklist.md` - Step-by-step execution guide
- `docs/decisions.md` - Migration-related architecture decisions
- `checklist.txt` - Project phases and migration schedule
