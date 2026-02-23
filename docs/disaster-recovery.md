# Disaster Recovery Procedures

## Overview
This document outlines the procedures for backing up and restoring the Studio Platform database in the event of data loss or corruption.

**Recovery Objectives:**
- **RTO (Recovery Time Objective):** < 1 hour from incident detection to service restoration
- **RPO (Recovery Point Objective):** 24 hours (daily backups at 2 AM UTC)

---

## Automated Backup System

### Schedule
- **Frequency:** Daily at 2 AM UTC
- **Retention:** 90 days
- **Storage:** Cloudflare R2 bucket (`studio-platform-assets`)
- **Location:** `backups/backup-YYYY-MM-DD.sql`

### Monitoring
- Check last backup timestamp: View R2 bucket in Cloudflare Dashboard
- Check cron execution logs: `npx wrangler tail` during scheduled time
- **Alerts:** Backup failures trigger:
  - **MonitoringService**: Email to `PLATFORM_ADMIN_EMAIL` and, if set, Slack via `SLACK_WEBHOOK_URL`
  - **Optional:** Set `BACKUP_ALERT_WEBHOOK_URL` (e.g. PagerDuty inbound URL or a dedicated Slack webhook) to POST a JSON payload `{ event: 'backup.failed', message, timestamp, source }` on system or tenant backup failure

---

## Restoration Procedures

### Scenario 1: Full Database Restoration

**When to use:** Complete data loss, database corruption, or recovering from catastrophic failure.

#### Step 1: List Available Backups
```bash
# View all available backups
npx wrangler r2 object list studio-platform-assets --prefix backups/

# Expected output:
# backups/backup-2026-02-01.sql
# backups/backup-2026-02-02.sql
# backups/backup-2026-02-03.sql
```

#### Step 2: Download Backup
```bash
# Download the most recent backup (or specific date)
npx wrangler r2 object get studio-platform-assets backups/backup-2026-02-06.sql --file restore.sql

# Verify file downloaded
ls -lh restore.sql
```

#### Step 3: Restore to D1 Database
```bash
# ⚠️  CAUTION: This will OVERWRITE the current database
# Make sure you have confirmed this is necessary

# Restore to remote (production) database
npx wrangler d1 execute studio-platform-db --remote --file restore.sql
```

#### Step 4: Verify Restoration
```bash
# Check record counts to verify data integrity
npx wrangler d1 execute studio-platform-db --remote --command "SELECT COUNT(*) as count FROM tenants"
npx wrangler d1 execute studio-platform-db --remote --command "SELECT COUNT(*) as count FROM users"
npx wrangler d1 execute studio-platform-db --remote --command "SELECT COUNT(*) as count FROM classes"
npx wrangler d1 execute studio-platform-db --remote --command "SELECT COUNT(*) as count FROM bookings"

# Verify recent data exists
npx wrangler d1 execute studio-platform-db --remote --command "SELECT id, name, createdAt FROM tenants ORDER BY createdAt DESC LIMIT 5"
```

#### Step 5: Notify Stakeholders
- Post in #engineering Slack channel with incident summary
- Update status page if applicable: https://status.studio-platform.com (if configured)
- Notify affected customers if necessary via email

---

### Scenario 2: Point-in-Time Recovery (Specific Tenant)

**When to use:** A specific tenant accidentally deleted data, but other tenants are unaffected.

#### Option A: Restore Entire Database to Test Environment
```bash
# 1. Create a separate test D1 database
npx wrangler d1 create studio-platform-db-recovery

# 2. Restore backup to test database
npx wrangler d1 execute studio-platform-db-recovery --remote --file restore.sql

# 3. Export specific tenant data using API
curl -X POST https://studio-platform-api.slichti.workers.dev/admin/tenants/TENANT_ID/export \
  -H "Authorization: Bearer PLATFORM_ADMIN_TOKEN" \
  -o tenant-recovery.json

# 4. Manually restore using SQL or API calls
```

#### Option B: Manual SQL Query from Backup
```bash
# Download backup
npx wrangler r2 object get studio-platform-assets backups/backup-2026-02-06.sql --file backup.sql

# Extract specific tenant's data using grep/sed
grep "tenant_id = 'TARGET_TENANT_ID'" backup.sql > tenant-data.sql

# Manually review and selectively restore
```

---

### Scenario 3: Emergency Backup (Before Risky Operation)

**When to use:** Before performing migrations, major updates, or bulk deletions.

#### Create Manual Backup
```bash
# Export current state
npx wrangler d1 export studio-platform-db --remote --output emergency-backup-$(date +%Y%m%d-%H%M).sql

# Upload to R2 for safekeeping
npx wrangler r2 object put studio-platform-assets emergency-backups/backup-$(date +%Y%m%d-%H%M).sql --file emergency-backup-*.sql
```

---

## Testing & Drills

### Quarterly DR Drill Checklist
Perform this drill once per quarter to ensure restoration procedures work:

- [ ] Download latest backup from R2
- [ ] Create test D1 database
- [ ] Restore backup to test database
- [ ] Verify data integrity (record counts, sample queries)
- [ ] Document time taken for restoration
- [ ] Update procedures if anything changed

**Last Drill:** _[To be filled in]_  
**Next Scheduled Drill:** _[To be filled in]_

---

## Backup Integrity Checks

### Monthly Verification
Run these checks on the 1st of each month:

```bash
# 1. Verify backups exist for last 30 days
npx wrangler r2 object list studio-platform-assets --prefix backups/ | grep "backup-$(date -d '30 days ago' +%Y-%m)"

# 2. Download and verify a random backup
RANDOM_BACKUP=$(npx wrangler r2 object list studio-platform-assets --prefix backups/ | shuf -n 1)
npx wrangler r2 object get studio-platform-assets $RANDOM_BACKUP --file test-backup.sql

# 3. Verify SQL file is valid
head -20 test-backup.sql
grep "CREATE TABLE" test-backup.sql | wc -l  # Should show 70+ tables
```

---

## Troubleshooting

### Issue: Backup Failed to Run
**Symptoms:** No new backup file in R2 for today's date

**Steps:**
1. Check cron execution logs:
   ```bash
   npx wrangler tail studio-platform-api --format pretty
   ```

2. Look for errors related to backup job

3. Common causes:
   - R2 bucket permissions issue
   - D1 export command failed
   - Worker timeout (unlikely, but check execution duration)

4. Manual backup:
   ```bash
   cd packages/api
   npx wrangler d1 export studio-platform-db --remote --output manual-backup-$(date +%Y%m%d).sql
   ```

### Issue: Restoration Takes Too Long
**Expected time:** 5-10 minutes for typical database size

If restoration takes >30 minutes:
- Check database size (should be <100MB)
- Verify network connectivity
- Consider restoring to local D1 first, then syncing

### Issue: Data Missing After Restoration
**Possible causes:**
- Backup was from before missing data was created
- Backup file corrupted
- SQL import failed silently

**Steps:**
1. Check backup file timestamp in R2 metadata
2. Try an older backup
3. Verify SQL file completeness: `tail -20 restore.sql` should show `COMMIT;`

---

## Incident Response Workflow

```mermaid
flowchart TD
    START[Data Loss Detected] --> ASSESS{Severity?}
    ASSESS -->|Single Tenant| PARTIAL[Partial Recovery]
    ASSESS -->|Platform-Wide| FULL[Full Recovery]
    
    PARTIAL --> EXPORT[Export Tenant from Backup]
    EXPORT --> MANUAL[Manual Restoration]
    
    FULL --> NOTIFY[Notify Stakeholders]
    NOTIFY --> DOWNLOAD[Download Latest Backup]
    DOWNLOAD --> RESTORE[Restore to D1]
    RESTORE --> VERIFY[Verify Data Integrity]
    VERIFY --> MONITOR[Monitor for Issues]
    
    MANUAL --> POSTMORTEM
    MONITOR --> POSTMORTEM[Post-Mortem Report]
```

---

## Post-Incident Review

After any data recovery incident, complete a post-mortem document including:

1. **Incident Summary:** What happened and when
2. **Timeline:** Key events and actions taken
3. **Root Cause:** Why did data loss occur
4. **Recovery Actions:** Steps taken to restore
5. **Impact:** How many users/tenants affected, duration
6. **Lessons Learned:** What can be improved
7. **Action Items:** Specific changes to prevent recurrence

---

## Contact Information

### On-Call Engineer
- **Slack:** #engineering-oncall
- **PagerDuty:** [To be configured]

### Escalation Path
1. **Level 1:** On-call engineer
2. **Level 2:** Engineering lead
3. **Level 3:** CTO

---

## Related

- **[Deploy & Staging Checklist](./deploy-checklist.md)** — Pre-deploy backup step and rollback reference.
- **Rate limiting:** Tuning is deferred; see [Deploy Checklist](./deploy-checklist.md#rate-limiting-tier-83--note) for the note.

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-02-06 | Initial DR procedures document | Antigravity |
| 2026-02-22 | Added Related section (deploy checklist, rate-limit note) | — |
