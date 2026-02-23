# Data Lifecycle & Retention

This document describes retention expectations, PII locations, and procedures for anonymization and archival to support compliance (e.g. GDPR, CCPA) and operational hygiene.

---

## Retention by Table

| Table / Area | Recommended retention | Notes |
|--------------|------------------------|--------|
| **audit_logs** | 90 days–1 year | Tenant-configurable; older rows can be pruned or exported then deleted. |
| **usage_logs** | 90 days | Aggregated usage; safe to delete older for quota resets. |
| **email_logs** | 1 year | Contains recipient email; consider anonymizing or deleting after 1 year. |
| **sms_logs** | 1 year | Contains phone; same as email_logs. |
| **push_logs** | 90 days | Delivery status; low PII. |
| **webhook_logs** | 30–90 days | Request/response bodies may contain PII; truncate or delete. |
| **automation_logs** | 90 days | Tracks sends; may reference userId. |
| **bookings** | Indefinite (business) | Required for history; consider soft-delete or archive flag for very old. |
| **tenant_members / users** | Indefinite while active | See “Anonymization” below for inactive. |
| **pos_orders, subscriptions, purchased_packs** | Indefinite (financial) | Legal/tax; retain per jurisdiction. |

---

## PII Locations

- **users**: email, profile JSON (firstName, lastName, phone, portraitUrl, bio).
- **tenant_members**: status, role; links to user (above).
- **profiles** (e.g. user.profile): firstName, lastName, phone, bio, portraitUrl.
- **bookings**: memberId → user/member (name, email for display).
- **email_logs / sms_logs**: recipientEmail, phone, message content.
- **audit_logs**: actorId, targetId; details JSON may contain names/emails.
- **webhook_logs**: payload may contain member/booking/customer PII.
- **support / widget**: customerEmail, message content.

---

## Anonymization & Archive Runbook

### When to use

- Member or user has been **inactive** for a defined period (e.g. 2+ years no logins, no bookings).
- Legal or user request for erasure (e.g. “right to be forgotten”) — prefer deletion or full anonymization as required.

### Approach (long-inactive members)

1. **Define “inactive”**: e.g. no booking and no login in last 24 months (query `bookings`, `users.lastLoginAt` or equivalent).
2. **Export for legal** (if needed): export member + user + related rows (bookings summary, subscriptions) before anonymizing.
3. **Anonymize in place** (recommended for referential integrity):
   - **users**: set `email` → `anonymized-<userId>@deleted.local`, `profile` JSON → `{ firstName: 'Deleted', lastName: 'User' }`, clear phone, portraitUrl, bio.
   - **tenant_members**: set `status` → `archived` (if enum allows) or leave status but ensure no PII in related display names.
   - **audit_logs / email_logs**: either leave as-is (actorId still valid but no PII in user) or truncate/delete old rows per retention.
4. **Optional archive table**: copy minimal non-PII summary (memberId, tenantId, lastActivityAt) to an `archived_members` table, then anonymize as above.
5. **Cron**: implement a scheduled job (e.g. monthly) that:
   - Finds members/users matching inactivity threshold.
   - Optionally excludes tenants with “retain indefinitely” policy.
   - Applies anonymization in a transaction; logs to audit_logs.

### Deletion (full erasure)

- If schema and product allow, **delete** rows in order: bookings → tenant_members → user (and any other FKs). This breaks referential integrity for historical bookings; consider soft-delete or anonymization instead for reporting continuity.

---

## Log Retention (Application Logs)

- **Structured logs** (e.g. JSON to stdout): retention is determined by the hosting platform (e.g. Cloudflare Workers analytics, external log sink). Recommend at least 30 days for debugging; 90 days if no separate SIEM.
- **No PII in logs**: avoid logging email, phone, or full names; use IDs and traceId only (see `docs/observability.md`).

---

## Checklist for New Features

- [ ] Document any new table that stores PII in this file.
- [ ] Add retention/archival plan for new log-like tables.
- [ ] Prefer anonymization over hard-delete where referential integrity is required for reporting.
