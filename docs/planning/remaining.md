# Remaining Work (Improvement Plan)

Tracked from API Audit, walkthroughs, and ops. Updated as items are completed.

## Legend
- ⬜ Not started
- 🔄 In progress
- ✅ Done

---

## 1. Bulk Class Move (Reschedule Date Range)
**Source:** `api_improvements.md` — Bulk Class Management  
**Status:** ✅ Completed Feb 2026

- **Scope:** API + Studio UI to reschedule a date range of classes (shift by minutes or to new day/time).
- **Done:** `POST /classes/bulk-move` with `from`, `to`, optional `instructorId`/`locationId`, and `shiftMinutes`; Studio Classes bulk action "Reschedule" with shift input.

---

## 2. Audit Log UI: Activity for Member X
**Source:** `api_improvements.md` — Audit Logging  
**Status:** ✅ Completed Feb 2026

- **Scope:** Studio UI to view "all changes for Member X" (entity-centric audit view). API already supports `targetType` + `targetId` query params.
- **Done:** Audit logs page supports `targetId`; Member detail (or roster) links to "View activity" filtered by that member.

---

## 3. Commerce Wizard Idempotency + Import Validation
**Source:** `.walkthrough.md`  
**Status:** ✅ Completed Feb 2026

- **Scope:** Commerce wizard: no duplicate products when re-running with same selections. Data import: clear error when required headers (e.g. email) are missing.
- **Done:** Wizard skips existing products and returns skipped count; import validates required headers and returns client-side error.

---

## 4. Backup Alerts (Slack/PagerDuty)
**Source:** `docs/disaster-recovery.md`  
**Status:** ✅ Completed Feb 2026

- **Scope:** On backup failure, notify via configurable webhook (e.g. Slack, PagerDuty) instead of console only.
- **Done:** Backup script/cron calls optional `BACKUP_ALERT_WEBHOOK_URL` on failure; doc updated.

---

## 5. StreakCard Backend for Mobile
**Source:** `docs/walkthroughs/mobile_upgrade.md`  
**Status:** ✅ Completed Feb 2026

- **Scope:** Real endpoint for streak (and optional churn) so mobile StreakCard can show live data.
- **Done:** `GET /members/me/streak` (or portal-scoped) returns `{ currentStreak, longestStreak, ... }`; mobile can call it for StreakCard.

---

## 6. Deploy & Staging (Ops — Manual)
**Source:** `.walkthrough.md`  
**Status:** 🔄

- Deploy `api` and `web` with latest changes.
- Test Stripe Connect and paid flows in staging (see expanded "Staging Verification" section in `deploy-checklist.md` for step-by-step flows).
- *No code change; checklist + runbook only. Ops execution remains manual.*

---

## 7. Rate Limiting Tuning (Optional)
**Source:** `api_improvements.md`  
**Status:** ✅

- Per-user and stricter cost-based limits implemented via `rateLimitMiddleware` and a Durable Object store, with higher-cost weights for exports, payroll generation, bulk operations, analytics, and imports. Documented in `deploy-checklist.md` and `api_improvements.md`.
---

## 8. AI Chatbot (Multi-tenant RAG)
**Source:** User request (Feb 2026)  
**Status:** ⬜ Not started

- **Scope:** 
    - **Initial Contact:** Handle general platform questions (support, product docs).
    - **Tenant-specific:** Answer student questions (payment status, class schedules) using tool-calling.
    - **RAG Architecture:** Multi-tenant vector knowledge base (Cloudflare Vectorize) + dynamic function calling (Drizzle DB).
- **Core Components:**
    - `packages/api`: New `POST /chat` endpoint with tenant-filtering and tool-calling.
    - `apps/web`: React Chat Interface with `useChat` hook (Vercel AI SDK).
    - AI-managed context for "Next Class" and "Membership Expiry" verification.
