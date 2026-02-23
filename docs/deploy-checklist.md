# Deploy & Staging Checklist

Use this checklist before and after deploying the Studio Platform (API + Web) to production or staging.

---

## Pre-Deploy

- [ ] **Migrations:** All D1 migrations applied locally and tested. No pending migrations that could fail in production.
- [ ] **Backup:** Create an emergency backup before deploy (see [Disaster Recovery](./disaster-recovery.md) — Scenario 3).
  ```bash
  npx wrangler d1 export studio-platform-db --remote --output emergency-backup-$(date +%Y%m%d-%H%M).sql
  ```
- [ ] **Env / Secrets:** Verify production env vars and secrets in Cloudflare (e.g. `wrangler secret list` for API worker). No local-only keys in prod.
- [ ] **Feature flags:** Confirm any new features are gated or enabled as intended for the release.

---

## Deploy Steps

1. **API (Worker)**
   - [ ] From repo root: `npm run deploy -w api` (or equivalent for your Worker name).
   - [ ] Confirm deployment URL and health check if available.
2. **Web (Pages)**
   - [ ] `npm run deploy -w web` (or Pages deploy via Git).
   - [ ] Confirm app loads and tenant slug routing works.
3. **Post-deploy migrations** (if any new migrations in this release)
   - [ ] `npx wrangler d1 migrations apply studio-platform-db --remote` (run from `packages/api` or where migrations live).

---

## Staging Verification

- [ ] **Auth:** Sign-in (Clerk) works for studio owners and students.
- [ ] **Tenant context:** Switching studios / tenant slug works; data is isolated.
- [ ] **Stripe Connect:** If applicable, test a paid flow (subscription or one-time) in staging with test keys.
- [ ] **Critical paths:** Book a class, cancel, check-in; create a class; run a report (e.g. at-risk, churn).
- [ ] **Cron:** If cron triggers are time-sensitive, confirm next run time or trigger a test run and check logs (`wrangler tail`).

---

## Rollback

If a deploy causes issues:

1. Revert the deployment (Cloudflare Dashboard: Workers & Pages → previous deployment → “Rollback” or redeploy prior version).
2. If DB migrations were applied, coordinate with [Disaster Recovery](./disaster-recovery.md) before reverting schema changes.
3. Notify stakeholders and document in post-incident review.

---

## Rate Limiting (Tier 8.3 — Note)

Rate limiting is implemented (cost-based + Durable Object store where applicable). Further tuning (e.g. stricter per-user limits or per-route limits) is deferred; document any production incidents or desired limits in `docs/security.md` or this checklist for future implementation.
