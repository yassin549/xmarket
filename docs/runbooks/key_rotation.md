# HMAC Key Rotation Runbook

## Overview

This runbook details procedures for rotating HMAC secrets used for inter-service request signing. Regular key rotation is a security best practice to limit the impact of potential key compromise.

---

## Key Generation

### Generate New Key

```bash
# On Windows (PowerShell)
python -c "import secrets; print(secrets.token_hex(32))"

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or using OpenSSL
openssl rand -hex 32
```

**Requirements**:
- Minimum 32 bytes (64 hex characters)
- Cryptographically secure random generation
- Store in password manager immediately

### Key Format

```bash
HMAC_SECRET_DEFAULT=a1b2c3d4...  # 64 hex chars
HMAC_SECRET_V1=e5f6g7h8...       # 64 hex chars  
HMAC_SECRET_V2=i9j0k1l2...       # 64 hex chars
```

---

## Rotation Schedule

**Standard Rotation**: Every 90 days (quarterly)  
**Emergency Rotation**: Immediately upon suspected compromise  
**Testing**: Verify rotation procedure quarterly in staging

---

## Rotation Procedure

### Phase 1: Add New Key (Day 1)

1. **Generate new key**:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Add to Vercel (staging first)**:
   - Go to Vercel → Project → Settings → Environment Variables
   - Add `HMAC_SECRET_V2=<new_key>`
   - Scope: Preview + Development
   - Save

3. **Redeploy staging**:
   ```bash
   vercel --prod=false
   ```

4. **Verify new key works**:
   ```bash
   # Test signing with new key
   curl -X POST http://staging.example.com/api/test \
     -H "X-HMAC-KeyId: v2" \
     ...
   ```

### Phase 2: Dual-Key Period (Days 2-7)

**Both keys active**:
- Old key (`v1` or `default`): Still accepted
- New key (`v2`): Newly issued requests use this
- Monitor logs for any signature failures

**Update clients**:
- Agent code updated to use `keyId: 'v2'`
- Old clients still work with `v1`

**Monitoring**:
```sql
-- Check which keys are being used
SELECT 
  headers->>'X-HMAC-KeyId' as key_id,
  COUNT(*) as request_count
FROM request_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY key_id;
```

### Phase 3: Deprecate Old Key (Day 8)

1. **Remove old key from Vercel**:
   - Delete `HMAC_SECRET_V1` (or `HMAC_SECRET_DEFAULT`)
   - Keep `HMAC_SECRET_V2` only

2. **Update default**:
   - Optionally rename `V2` to `DEFAULT`
   - Or keep versioning: `V2` → `V3` next rotation

3. **Verify**:
   - All requests should now use `v2`
   - Old key requests should fail (expected)

4. **Document**:
   - Update `docs/decisions.md` with rotation date
   - Note any issues encountered

---

## Emergency Revocation

**If key is compromised:**

1. **Immediate**:
   ```bash
   # Remove compromised key from Vercel NOW
   vercel env rm HMAC_SECRET_V1 --environment preview
   ```

2. **Generate and deploy new key** (within 1 hour):
   ```bash
   # Generate
   NEW_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
   
   # Add to Vercel
   vercel env add HMAC_SECRET_V2 $NEW_KEY --environment preview
   
   # Redeploy
   vercel --force
   ```

3. **Notify team**:
   - Post in #security Slack channel
   - Document in incident log
   - Update post-mortem

4. **Audit**:
   ```sql
   -- Check for suspicious requests with old key
   SELECT *
   FROM audit_event
   WHERE created_at > '<compromise_time>'
     AND payload->>'key_id' = '<compromised_key_id>'
   ORDER BY created_at DESC;
   ```

---

## Multi-Key Support

The system supports multiple active keys simultaneously for zero-downtime rotation.

### Configuration

```typescript
// signer.ts
signRequest('POST', '/api/test', {}, 'v2'); // Use specific key

// verifier.ts  
// Automatically checks HMAC_SECRET_${keyId.toUpperCase()}
// Accepts any configured key
```

### Key ID Naming Convention

- `default` - Current primary key
- `v1`, `v2`, `v3` - Versioned keys for rotation
- `emergency` - Emergency backup key (stored offline)

---

## Monitoring & Alerts

### Metrics to Track

1. **Signature verification failures**:
   ```
   Metric: hmac.verify.failure
   Alert: >100/hour
   ```

2. **Key age**:
   ```
   Alert: Key older than 90 days
   ```

3. **Key usage distribution**:
   ```
   Monitor: % requests per key-id
   Alert: Old key still >10% after 7 days
   ```

### Log Queries

```sql
-- Recent signature failures
SELECT COUNT(*), headers->>'X-HMAC-KeyId'
FROM request_logs
WHERE status = 403
  AND error LIKE '%signature%'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY headers->>'X-HMAC-KeyId';
```

---

## Rollback Procedure

If rotation causes issues:

1. **Re-add old key**:
   ```bash
   vercel env add HMAC_SECRET_V1 <old_key_from_password_manager>
   ```

2. **Redeploy**:
   ```bash
   vercel --force
   ```

3. **Investigate**:
   - Check logs for root cause
   - Fix issue before attempting rotation again

---

## Testing Rotation (Staging)

**Quarterly drill** (non-production):

1. Generate test key
2. Add as `HMAC_SECRET_TEST`
3. Update test agent to use `test` key-id
4. Verify signatures work
5. Remove test key
6. Document any issues

**Test checklist**:
- [ ] New key generated correctly
- [ ] Added to Vercel without typos
- [ ] Requests with new key succeed
- [ ] Requests with old key fail after removal
- [ ] Monitoring alerts triggered appropriately
- [ ] Documentation updated

---

## Security Considerations

### Key Storage

- ✅ **DO**: Store in Vercel environment variables (encrypted at rest)
- ✅ **DO**: Keep backup in password manager (1Password, LastPass)
- ❌ **DON'T**: Commit keys to Git
- ❌ **DON'T**: Share keys in Slack/email
- ❌ **DON'T**: Reuse keys across environments

### Access Control

- Only security team has access to production keys
- Staging keys accessible to developers
- Key rotation requires 2-person approval (production)

### Audit Trail

Every key rotation must be documented:
- Date rotated
- Person who performed rotation
- Reason (scheduled vs. emergency)
- Any issues encountered

---

## Checklist: Quarterly Rotation

**Preparation (Day 0)**:
- [ ] Review last rotation notes
- [ ] Generate new key
- [ ] Store in password manager
- [ ] Notify team of rotation window

**Execution (Day 1-8)**:
- [ ] Add new key to staging
- [ ] Test in staging
- [ ] Add new key to production
- [ ] Monitor for 7 days
- [ ] Remove old key
- [ ] Verify all requests use new key
- [ ] Update documentation

**Post-Rotation (Day 9)**:
- [ ] Confirm no errors
- [ ] Archive old key securely
- [ ] Schedule next rotation (90 days)
- [ ] Post-rotation review meeting

---

## Contact

**Security Team**: security@example.com  
**On-Call**: #security-oncall Slack  
**Escalation**: See incident response runbook

---

**Last Updated**: [Current Date]  
**Next Scheduled Rotation**: [Date + 90 days]  
**Key Version**: V2 (Current)
