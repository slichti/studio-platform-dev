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
- [ ] **Stripe Connect (Subscriptions):**
  - [ ] Connect a test studio owner to a Stripe test account.
  - [ ] Start a new subscription from the web app using Stripe test cards.
  - [ ] Verify the subscription appears correctly in both Studio Platform and Stripe Dashboard.
  - [ ] Cancel the subscription and confirm webhooks update status + access.
- [ ] **Stripe Connect (One‑time / Packs & POS):**
  - [ ] Purchase a class pack or retail item in staging using Stripe test cards.
  - [ ] Confirm the charge lands on the connected account, not the platform account.
  - [ ] Verify gift card / pack balances and receipts in the student portal.
- [ ] **Critical paths:** Book a class, cancel, check-in; create a class; run a report (e.g. at-risk, churn, payroll preview/export).
- [ ] **Cron:** If cron triggers are time-sensitive, confirm next run time or trigger a test run and check logs (`wrangler tail`).

---

## Rollback

If a deploy causes issues:

1. Revert the deployment (Cloudflare Dashboard: Workers & Pages → previous deployment → “Rollback” or redeploy prior version).
2. If DB migrations were applied, coordinate with [Disaster Recovery](./disaster-recovery.md) before reverting schema changes.
3. Notify stakeholders and document in post-incident review.

---

## Rate Limiting

- **Global:** 300 req/min per user (or IP/token) via Durable Object-backed counter.
- **Authenticated app traffic:** 600 req/min per user for most `/members`, `/classes`, `/payroll`, etc. (see `authenticatedPaths` in `packages/api/src/index.ts`).
- **Cost-based limits:** Expensive operations (exports, payroll generation, bulk mutations, imports, analytics) are weighted with `cost: 10` so a few heavy calls can saturate a minute’s budget faster than light reads.
- **Booking:** 20 req/min (POST `/bookings`, POST `/bookings/waitlist`)
- **Gift card validate:** 30 req/min (public brute-force protection)
- **Checkout:** 10 req/min
- **Guest booking & tokens:** 5 req/min for `/guest/booking` and `/guest/token`
- **Public schedule:** 60 req/min for `/classes`, `/public/tenant/:slug`, and public schedule feeds.

See `packages/api/src/middleware/rate-limit.ts` and route-specific overrides. 429 responses include `X-RateLimit-*` headers.

---

## Performance

- **Dashboard (GET /tenant/stats):** Today’s classes use a single batch count query for confirmed bookings (no per-class subqueries).
- **Class list (GET /classes):** Booking and waitlist counts are fetched in one grouped query; “my booking” in one batch by class IDs.
- Prefer `?start`/`?end` and `?limit` on schedule/class list to keep payloads bounded.
