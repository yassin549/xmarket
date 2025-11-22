# Everything Market - Deployment Runbook

## Emergency Procedures

### Rollback Procedure

If deployment fails or critical issues are detected:

1. **Immediate Rollback**:
   ```bash
   # Railway CLI
   railway rollback
   
   # Or via Railway dashboard:
   # Go to Deployments → Select previous working deployment → Redeploy
   ```

2. **Database Rollback** (if migrations applied):
   ```bash
   # SSH into backend service
   railway run bash
   
   # Rollback migration
   alembic downgrade -1
   ```

3. **Verify Services**:
   ```bash
   # Check all services are healthy
   curl https://your-backend.railway.app/health
   curl https://your-orderbook.railway.app/
   ```

### Service Health Checks

**Backend**:
```bash
curl https://your-backend.railway.app/health
# Expected: {"status":"healthy","database":"connected","websocket_clients":N}
```

**Orderbook**:
```bash
curl https://your-orderbook.railway.app/
# Expected: {"service":"everything-market-orderbook","status":"healthy"}
```

**Frontend**:
```bash
curl https://your-frontend.railway.app/
# Expected: HTML response
```

### Common Issues & Solutions

#### Issue: Backend won't start
**Symptoms**: Service crashes on startup
**Check**:
```bash
railway logs backend
```
**Solutions**:
- Verify `DATABASE_URL` is set
- Verify `REALITY_API_SECRET` is set
- Check database connection
- Review migration status

#### Issue: Reality Engine not publishing events
**Symptoms**: No events appearing in dashboard
**Check**:
```bash
railway logs reality-engine
```
**Solutions**:
- Verify `BACKEND_URL` is correct
- Verify `REALITY_API_SECRET` matches backend
- Check scraping logs for errors
- Verify sources.yaml is accessible

#### Issue: WebSocket connections failing
**Symptoms**: Frontend shows "Loading..." indefinitely
**Check**: Browser console for WebSocket errors
**Solutions**:
- Verify `VITE_WS_URL` is correct
- Check CORS settings in backend
- Verify backend is running

#### Issue: Orders not matching
**Symptoms**: Orders placed but no trades executed
**Check**:
```bash
railway logs orderbook
```
**Solutions**:
- Verify orderbook service is running
- Check order parameters (price, quantity)
- Review matching engine logs

### Performance Monitoring

**Key Metrics to Watch**:
- Backend response time: <100ms
- Orderbook matching latency: <10ms
- Reality Engine events/hour: 10-20
- LLM calls/hour: <10 (rate limited)
- WebSocket connections: Monitor for leaks

**Alerts to Set**:
- Backend 5xx errors > 10/min
- Database connection failures
- LLM rate limit exceeded
- SUSPICIOUS_DELTA events > 5/hour
- Memory usage > 80%

### Database Backup

**Automated Backups** (Railway):
- Railway Postgres automatically backs up daily
- Retention: 7 days on Hobby plan, 30 days on Pro

**Manual Backup**:
```bash
# Export snapshot
railway run python scripts/export_snapshot.py

# Download from Railway
railway run pg_dump $DATABASE_URL > backup.sql
```

**Restore from Backup**:
```bash
# Upload backup
railway run psql $DATABASE_URL < backup.sql
```

### Scaling Procedures

**Horizontal Scaling** (add more instances):
```bash
# Railway dashboard: Service → Settings → Instances
# Increase replica count
```

**Vertical Scaling** (more resources):
```bash
# Railway dashboard: Service → Settings → Resources
# Upgrade plan or adjust limits
```

**Database Scaling**:
```bash
# Railway dashboard: Database → Settings
# Upgrade to larger plan
```

### Security Incident Response

**If secrets are compromised**:

1. **Rotate Secrets Immediately**:
   ```bash
   # Generate new secrets
   python scripts/generate_secrets.py
   
   # Update Railway env vars
   railway variables set REALITY_API_SECRET=<new-secret>
   railway variables set ADMIN_API_KEY=<new-key>
   railway variables set JWT_SECRET=<new-secret>
   
   # Redeploy all services
   railway up
   ```

2. **Invalidate Sessions**:
   - New JWT_SECRET will invalidate all existing tokens
   - Users will need to re-login

3. **Audit Logs**:
   - Check `llm_audit` table for suspicious approvals
   - Check `events` table for unusual activity
   - Review `score_changes` for manipulation

**If unauthorized access detected**:

1. **Disable Admin Access**:
   ```bash
   # Temporarily change admin key
   railway variables set ADMIN_API_KEY=<temporary-random-key>
   ```

2. **Review Audit Trail**:
   ```sql
   SELECT * FROM llm_audit WHERE approved_by IS NOT NULL ORDER BY approved_at DESC LIMIT 100;
   SELECT * FROM score_changes ORDER BY timestamp DESC LIMIT 100;
   ```

3. **Restore from Snapshot** (if needed):
   ```bash
   python scripts/export_snapshot.py  # Current state
   # Review and restore from earlier snapshot if needed
   ```

### Maintenance Windows

**Recommended Schedule**:
- Database maintenance: Sunday 2-4 AM UTC
- Service updates: Rolling deployment (no downtime)
- Major upgrades: Announce 24h in advance

**Maintenance Procedure**:

1. **Announce Maintenance**:
   - Update frontend with banner
   - Notify users via email/Discord

2. **Enable Maintenance Mode** (optional):
   ```bash
   # Set env var
   railway variables set MAINTENANCE_MODE=true
   
   # Backend will return 503 for non-health endpoints
   ```

3. **Perform Maintenance**:
   - Apply database migrations
   - Update dependencies
   - Deploy new versions

4. **Verify Health**:
   - Run smoke tests
   - Check all endpoints
   - Monitor logs for errors

5. **Disable Maintenance Mode**:
   ```bash
   railway variables set MAINTENANCE_MODE=false
   ```

### Disaster Recovery

**Complete System Failure**:

1. **Restore Database**:
   ```bash
   # From Railway backup
   railway run pg_restore <backup-file>
   
   # Or from snapshot
   python scripts/import_snapshot.py snapshot_YYYYMMDD_HHMMSS.json
   ```

2. **Redeploy Services**:
   ```bash
   railway up --service backend
   railway up --service orderbook
   railway up --service reality-engine
   railway up --service frontend
   ```

3. **Verify Data Integrity**:
   ```bash
   python scripts/test_backend.py
   python scripts/test_orderbook.py
   ```

4. **Resume Operations**:
   - Monitor logs for 1 hour
   - Verify WebSocket connections
   - Test order placement
   - Verify reality events

### Contact & Escalation

**On-Call Rotation**:
- Primary: [Your Name]
- Secondary: [Backup Person]
- Database: Railway Support

**Escalation Path**:
1. Check runbook for solution
2. Review logs and metrics
3. Attempt rollback if critical
4. Contact Railway support if infrastructure issue
5. Post-mortem after resolution

### Post-Incident Checklist

After resolving an incident:

- [ ] Document what happened
- [ ] Document what was done
- [ ] Update runbook with new solutions
- [ ] Add monitoring/alerts to prevent recurrence
- [ ] Schedule post-mortem meeting
- [ ] Update disaster recovery procedures

---

**Last Updated**: 2025-11-22
**Version**: 1.0
