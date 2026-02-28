# Recommended Test Additions

This doc suggests additional **unit**, **integration**, and **E2E** tests based on current coverage. Existing tests are strong in: bookings, security/IDOR, reports, commerce, courses, VOD, quotas, platform admin, webhooks, resiliency, and several E2E flows (guest booking, checkout, admin, rbac, etc.).

---

## Unit tests

### API (`packages/api`)

| Area | What to add | Why |
|------|-------------|-----|
| **Auth middleware** | `src/middleware/auth.test.ts` | No tests today. Cover: missing/invalid Bearer → 401; `TEST-AUTH` in test env → auth set; `user_*` token in dev/test → auth set; guest WebSocket (`guest_*` + tenantSlug/tenantId) → auth set; invalid/expired JWT → 401. Mock `verify` from hono/jwt and env (CLERK_PEM_PUBLIC_KEY, ENVIRONMENT). |
| **Optional auth middleware** | Same file or `optionalAuth.test.ts` | No auth → no user but continues; valid token → auth set. |
| **API key middleware** | `src/middleware/apiKey.test.ts` | Valid `Bearer sp_*` → identity set; invalid/unknown key → 401. |
| **Pricing / churn / storage** | Expand existing `*.test.ts` | You have reports, bookings, stripe-webhook, pdf, churn, pricing, storage, referrals; add edge cases (e.g. pricing tiers, churn boundaries) as needed. |

### Web app (`apps/web`)

| Area | What to add | Why |
|------|-------------|-----|
| **Utils** | `app/utils/api.test.ts` (if `api.ts` has pure logic) | Any request-building or error-mapping logic worth unit testing. |
| **Subdomain** | Expand `app/utils/subdomain.server.test.ts` | Ensure all branches (subdomain vs path-based, edge cases) are covered. |
| **Components** | `ChatWidget` reconnect/backoff logic | Extract a small “backoff delay” helper and unit test it (e.g. delay for attempt 1, 2, 3 and cap). |
| **Format/date** | Add cases in `format.test.ts` or a date util test | Any new formatters or timezone-sensitive formatting. |

---

## Integration tests (API)

| Area | What to add | Why |
|------|-------------|-----|
| **Auth behavior** | `test/integration/auth.integration.test.ts` | With `ENVIRONMENT=test` and `TEST-AUTH: user_owner`: protected route returns 200 and tenant-scoped data; without header → 401. Optional: call a route that uses `optionalAuth` with and without token. |
| **Guest WebSocket path** | `test/integration/chat-guest.integration.test.ts` (or under auth) | Simulate WS upgrade with `userId=guest_xyz&tenantSlug=test` (no token). Assert 101 or that the chat route receives the request with `c.get('auth')` set to guest. (If WS is hard to drive in Vitest, at least test the auth middleware in isolation with a mock request that has Upgrade + guest query params.) |
| **API key auth** | `test/integration/api-key.integration.test.ts` | Create an API key for a tenant, call a protected endpoint with `Authorization: Bearer sp_<key>`, expect 200 and correct tenant scope; invalid key → 401. |
| **Impersonation token** | In auth or security integration | Issue an HS256 impersonation JWT (using IMPERSONATION_SECRET), call protected endpoint, expect 200 and impersonated user in context. |
| **Multi-tenant isolation** | Expand `security.integration.test.ts` | Add: member of tenant A cannot list or access tenant B’s members/classes/bookings (by ID or by switching X-Tenant-Id). |
| **Clerk JWT (RS256)** | Optional, higher effort | If you can generate a valid Clerk-like JWT (e.g. test key pair), verify middleware accepts it and sets auth; expired or wrong key → 401. |

---

## E2E tests (Playwright, `apps/web/e2e`)

| Area | What to add | Why |
|------|-------------|-----|
| **Documentation** | `documentation.spec.ts` | Log in (or use test user), open `/documentation`, then `/documentation/platform/architecture`. Check “Request Flow” and “Expand”/zoom; optional: search and open Clerk Configuration. |
| **Internal docs – Clerk** | Same or `documentation-clerk.spec.ts` | As platform admin, open `/documentation/platform/clerk`, expect sections (e.g. “Where to configure”, “Checklist”). |
| **Chat widget (public)** | `chat-widget.spec.ts` | On a public site page (e.g. `/site/:slug/about`), expect chat bubble; open panel, expect “Connecting…” or “Write message”. Optionally mock WebSocket or run against dev and assert no uncaught errors after load. |
| **Auth flows** | Expand `auth.spec.ts` | Sign-in page loads and has expected elements; sign-up page loads; after login (if test env allows), redirect to dashboard or create-studio. Keep assertions that don’t depend on Clerk’s full UI unless you use Clerk testing support. |
| **Smoke** | Expand `smoke.spec.ts` | Add: `/sign-in` and `/sign-up` load; `/documentation` redirects to sign-in when not logged in; optional: one membership or pricing page load. |
| **Accessibility** | Expand `accessibility.spec.ts` | Add key routes (e.g. public schedule, one studio dashboard page) and run axe; fix or document known issues. |

---

## Summary table

| Type | Suggested new/expanded tests |
|------|-----------------------------|
| **Unit** | Auth middleware, optional auth, API key middleware; ChatWidget backoff helper; extra util/format cases. |
| **Integration** | Auth (TEST-AUTH, optional auth); guest WS auth path; API key; impersonation JWT; extra tenant isolation. |
| **E2E** | Documentation (architecture + Clerk); chat widget on public page; deeper auth/smoke; a11y on more routes. |

---

## Implementation order

1. **High value, low effort**: Auth middleware unit tests (with mocks), API key integration test, E2E for documentation and smoke.
2. **High value, medium effort**: Auth integration test (TEST-AUTH), tenant isolation expansion, chat widget E2E (with or without WS mock).
3. **When touching chat/auth**: Guest WS auth in integration (or middleware unit test with fake Upgrade request), ChatWidget backoff unit test.

Use existing patterns: `packages/api` integration tests use `setupTestDb(env.DB)` and `SELF.fetch()`; E2E uses Playwright and existing `test.describe`/`test()`; unit tests use Vitest and mocks where needed.
