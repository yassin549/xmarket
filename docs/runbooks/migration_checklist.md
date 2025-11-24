# Migration Execution Checklist

## Overview

This runbook provides a step-by-step checklist for safely applying database migrations to staging environments. **Every migration must follow this process before being applied.**

> [!WARNING]
> This checklist is for **STAGING ONLY**. Production migrations require additional approvals and are covered in Phase 13+.

---

## Pre-Migration Review (Review Phase)

### Step 1: Code Review

- [ ] PR created with migration file
- [ ] Migration follows naming convention (`<version>_<description>.sql`)
- [ ] SQL syntax validated (manual review)
- [ ] Rollback instructions present in comments
- [ ] Migration includes comprehensive inline documentation
- [ ] No hard-coded values (use variables where appropriate)
- [ ] Indexes defined for foreign keys and frequent query patterns
- [ ] Constraints properly named (for easier debugging)

### Step 2: Schema Validation

- [ ] Review against ER diagram (if exists)
- [ ] Check table/column naming follows conventions (snake_case)
- [ ] Verify foreign key relationships are correct
- [ ] Check data types are appropriate (avoid `TEXT` for constrained fields)
- [ ] Ensure `created_at`/`updated_at` columns exist where needed
- [ ] Verify unique constraints and indexes won't cause conflicts

### Step 3: Impact Analysis

- [ ] Identify affected tables
- [ ] Check for breaking changes to existing API contracts
- [ ] List dependent services that may need updates
- [ ] Estimate migration execution time (for large tables)
- [ ] Verify no downtime-causing operations (e.g., `ALTER TABLE` with lock)
- [ ] Check if data migration/transformation is needed

**Document findings in PR comments**

---

## Pre-Execution Preparation (Before Applying)

### Step 4: Environment Check

- [ ] Confirm target environment is **staging** (not production)
- [ ] Verify database connection string is correct
  ```bash
  echo $NEON_DATABASE_URL | grep staging
  ```
- [ ] Check current schema version (if versioning implemented)
- [ ] Verify sufficient disk space (if large migration)

### Step 5: Backup Database

Even though staging, create backup before major migrations:

```bash
# Option 1: Neon built-in backup
# Navigate to Neon dashboard → Backups → Create manual backup

# Option 2: pg_dump (for local backup)
pg_dump $NEON_DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup size
ls -lh backup_*.sql
```

- [ ] Backup created
- [ ] Backup size verified (non-zero)
- [ ] Backup location documented

### Step 6: Dry Run (If Applicable)

For complex migrations, test on local database first:

```bash
# Create local test database
createdb xmarket_migration_test

# Restore current staging schema
pg_dump $NEON_DATABASE_URL --schema-only | psql xmarket_migration_test

# Apply migration
psql xmarket_migration_test < src/infra/migrations/<version>_<description>.sql

# Verify
psql xmarket_migration_test -c "\dt"

# Cleanup
dropdb xmarket_migration_test
```

- [ ] Dry run completed (if applicable)
- [ ] No errors during dry run
- [ ] Schema looks correct

---

## Migration Execution (Apply Migration)

### Step 7: Connect to Staging Database

```bash
# Connect to Neon staging database
psql $NEON_DATABASE_URL

# Verify connection
SELECT current_database(), current_user;
```

- [ ] Connected to correct database
- [ ] User has sufficient privileges

### Step 8: Apply Migration

```sql
-- Start transaction (for rollback safety)
BEGIN;

-- Apply migration
\i src/infra/idempotency/migrations/001_create_jobs.sql
-- OR
\i src/infra/migrations/002_create_core_schema.sql

-- Review changes (before commit)
\dt
\d <table_name>

-- If everything looks good, commit
COMMIT;

-- If issues found, rollback
-- ROLLBACK;
```

- [ ] Migration executed without errors
- [ ] Transaction committed (or rolled back if issues)
- [ ] Execution time recorded: __________ seconds

### Step 9: Verify Schema Changes

```sql
-- List all tables
\dt

-- Describe specific tables
\d jobs
\d users
\d markets
\d audit_event
\d events
\d snapshots
\d channel_counters

-- Verify indexes
\di

-- Check constraints
SELECT conname, contype, conrelid::regclass 
FROM pg_constraint 
WHERE conrelid::regclass::text LIKE '%jobs%';

-- Verify triggers
SELECT tgname, tgrelid::regclass 
FROM pg_trigger 
WHERE tgrelid::regclass::text LIKE '%jobs%';
```

- [ ] All expected tables exist
- [ ] Columns have correct types
- [ ] Indexes created successfully
- [ ] Constraints active
- [ ] Triggers functioning

---

## Post-Migration Validation (Verify Correctness)

### Step 10: Test Constraints

Test that constraints are enforced:

```sql
-- Test 1: Jobs idempotency constraint
INSERT INTO jobs (idempotency_key, job_type, payload)
VALUES ('test-001', 'manual_test', '{"test": true}');

-- Should FAIL (duplicate key)
INSERT INTO jobs (idempotency_key, job_type, payload)
VALUES ('test-001', 'manual_test', '{"different": true}');
-- Expected error: duplicate key violates unique constraint

-- Different job_type should SUCCEED
INSERT INTO jobs (idempotency_key, job_type, payload)
VALUES ('test-001', 'different_type', '{"test": true}');

-- Cleanup
DELETE FROM jobs WHERE job_type IN ('manual_test', 'different_type');
```

```sql
-- Test 2: Markets require human approval
INSERT INTO users (email, password_hash, role)
VALUES ('test@example.com', 'fake_hash', 'admin')
RETURNING user_id;
-- Save user_id: ___________

INSERT INTO audit_event (action, actor_type, actor_id)
VALUES ('market_creation', 'human', '<user_id>')
RETURNING audit_id;
-- Save audit_id: ___________

-- Should SUCCEED with approval
INSERT INTO markets (symbol, type, title, created_by, human_approval_audit_id)
VALUES ('TEST-MKT', 'political', 'Test Market', '<user_id>', '<audit_id>');

-- Should FAIL without approval
INSERT INTO markets (symbol, type, title, created_by, human_approval_audit_id)
VALUES ('TEST-MKT-2', 'economic', 'Test Market 2', '<user_id>', NULL);
-- Expected error: NOT NULL constraint violation

-- Cleanup
DELETE FROM markets WHERE symbol LIKE 'TEST%';
DELETE FROM audit_event WHERE action = 'market_creation';
DELETE FROM users WHERE email = 'test@example.com';
```

```sql
-- Test 3: Audit event is append-only
INSERT INTO audit_event (action, actor_type)
VALUES ('test_action', 'human')
RETURNING audit_id;
-- Save audit_id: ___________

-- Should FAIL (UPDATE forbidden)
UPDATE audit_event SET action = 'modified' WHERE audit_id = '<audit_id>';
-- Expected error: audit_event table is append-only

-- Should FAIL (DELETE forbidden)
DELETE FROM audit_event WHERE audit_id = '<audit_id>';
-- Expected error: audit_event table is append-only

-- Manual cleanup (disable trigger temporarily for test cleanup only)
ALTER TABLE audit_event DISABLE TRIGGER trg_prevent_audit_delete;
DELETE FROM audit_event WHERE action = 'test_action';
ALTER TABLE audit_event ENABLE TRIGGER trg_prevent_audit_delete;
```

- [ ] Idempotency constraint working
- [ ] Human approval constraint enforced
- [ ] Append-only audit working
- [ ] All test data cleaned up

### Step 11: Performance Check

```sql
-- Check index usage
EXPLAIN ANALYZE 
SELECT * FROM jobs 
WHERE status = 'pending' AND next_attempt_at < NOW() 
ORDER BY created_at 
LIMIT 10;
-- Verify "Index Scan" is used, not "Seq Scan"

-- Check foreign key lookups
EXPLAIN ANALYZE 
SELECT m.*, u.email 
FROM markets m 
JOIN users u ON m.created_by = u.user_id 
LIMIT 10;
-- Verify index usage on foreign keys
```

- [ ] Queries use indexes (no sequential scans)
- [ ] Query performance acceptable (<100ms for simple queries)

### Step 12: Application Integration Test

If backend code exists:

```bash
# Run integration tests (when implemented)
npm test -- --grep="migration"

# Or manual API test
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"job_type": "test", "idempotency_key": "test-123", "payload": {}}'
```

- [ ] Integration tests pass (or N/A if no backend yet)
- [ ] API can connect to database
- [ ] No runtime errors

---

## Rollback Testing (Verify Rollback Works)

### Step 13: Test Rollback Script

**IMPORTANT**: Do this in a separate test database or transaction

```bash
# Create test database
createdb xmarket_rollback_test

# Restore current schema
pg_dump $NEON_DATABASE_URL --schema-only | psql xmarket_rollback_test

# Test rollback
psql xmarket_rollback_test
```

```sql
-- Execute rollback from migration comments
DROP TRIGGER IF EXISTS trg_jobs_updated_at ON jobs;
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP TABLE IF EXISTS jobs CASCADE;

-- Verify tables dropped
\dt
-- Should not show 'jobs'

-- Exit
\q
```

```bash
# Cleanup test database
dropdb xmarket_rollback_test
```

- [ ] Rollback script executed without errors
- [ ] All migration changes reverted
- [ ] No orphaned objects (tables, functions, triggers)

---

## Documentation & Finalization

### Step 14: Update Documentation

- [ ] Add entry to `docs/decisions.md`:
  ```markdown
  ### [2025-11-24] Migration 001: Jobs Table Created
  **Context**: Need idempotent job processing
  **Decision**: Composite unique constraint on (job_type, idempotency_key)
  **Applied**: Staging on 2025-11-24 by [Your Name]
  **Execution Time**: X seconds
  ```

- [ ] Update migration version in project docs (if applicable)
- [ ] Mark migration as applied in tracking system (future)

### Step 15: Notify Team

- [ ] Post in team chat: "Migration `<version>` applied to staging"
- [ ] Include:
  - Migration description
  - Execution time
  - Any warnings or notes
  - Next steps (e.g., "Ready for backend integration")

### Step 16: Monitor

For 24-48 hours after migration:

- [ ] Monitor database metrics (connections, query time)
- [ ] Check for errors in application logs
- [ ] Watch for unexpected slow queries
- [ ] Verify no connection pool exhaustion

---

## Rollback Procedure (If Issues Found)

If critical issues discovered post-migration:

1. **Immediate**: Execute rollback script from migration comments
2. **Document**: Create incident report in `ops/postmortems/`
3. **Fix**: Create new migration to correct issue (do NOT modify original)
4. **Review**: Post-mortem within 72 hours

**Rollback Command**:
```bash
psql $NEON_DATABASE_URL < rollback_<version>.sql
# Where rollback_<version>.sql contains the rollback commands from migration
```

---

## Checklist Summary

**Review Phase** (Steps 1-3):
- SQL review, schema validation, impact analysis

**Preparation Phase** (Steps 4-6):
- Environment check, backup, dry run

**Execution Phase** (Steps 7-9):
- Connect, apply migration, verify schema

**Validation Phase** (Steps 10-12):
- Test constraints, performance, integration

**Rollback Testing** (Step 13):
- Verify rollback script works

**Finalization** (Steps 14-16):
- Documentation, team notification, monitoring

**Total Estimated Time**: 30-60 minutes per migration

---

## Sign-Off

- **Migration**: `<version>_<description>.sql`
- **Applied By**: ________________________
- **Date**: ________________________
- **Environment**: Staging
- **Execution Time**: ________ seconds
- **Issues Found**: None / [Describe]
- **Rollback Tested**: Yes / No

**Approved for Production**: ☐ (Phase 13+)
