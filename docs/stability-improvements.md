# Stability Improvements Tracker

This document tracks planned and in-progress work to improve platform stability. Items are grouped by category and status.

---

## 1. Testing (Item 1)

| Task | Status | Notes |
|------|--------|------|
| Auth middleware unit tests (`auth.ts`) | Done | Missing/invalid Bearer → 401; TEST-AUTH; expired JWT; malformed Bearer (e.g. Basic) → 401. |
| Optional auth middleware unit tests | Done | No auth → continue; valid Bearer (mocked RS256) → auth set. |
| API key integration test | Done | Valid `Bearer sp_*` → 200; invalid key → 401. |
| Impersonation JWT integration test | Done | HS256 JWT with IMPERSONATION_SECRET → 200; wrong secret → 401. |
| Multi-tenant isolation expansion | Done | Scenario 5b: member of tenant A cannot list tenant B via X-Tenant-Slug; 403/404. |
| Integration test DB schema | Done | Aligned `tenant_members` (stripe_customer_id, invited_at, accepted_at) and `bookings` (reminder_sent_at) in test-utils. |
| E2E: smoke (public schedule, sign-in/sign-up) | Done | Added public schedule (embed calendar) smoke; sign-in/sign-up and docs redirect already covered. |
| E2E: a11y (axe on key routes) | Done | Added axe on public schedule (embed). Sign-in, create-studio, dashboard, admin schedule already covered. |
| E2E: documentation + chat widget | Done | Docs: redirects when not logged in + authenticated load (E2E bypass) for /documentation and /documentation/platform/architecture. Chat widget: public page + open panel already in `chat-widget.spec.ts`. |

---

## 2. Error Handling & Resilience

| Task | Status | Notes |
|------|--------|------|
| Route-level error boundaries | Done | Schedule already wrapped (calendar + list view); checkout page wrapped in `ComponentErrorBoundary`. |
| Consistent API error shape | Done | Standardized: `{ error, code, requestId? }`; 500 uses `INTERNAL_ERROR`. Documented in `docs/api-error-shape.md`. |
| Critical loaders: catch and return 4xx/5xx | Done | Studio layout, $pageSlug (public schedule), embed calendar loaders already catch and return 404 or safe payload. |

---

## 3. API & Data

| Task | Status | Notes |
|------|--------|------|
| Guest schedule: filter cancelled/archived | Done | API `GET /guest/schedule/:slug` now filters by `status = 'active'` only. |
| Input validation on all public/mutating routes | Done | Guest: booking, chat/start, token. Commerce: checkout/session. Bookings: POST /. All use Zod; 400 with VALIDATION_FAILED + issues. |
| Idempotency for payments/booking | Done | Guest booking implements Idempotency-Key via D1 (idempotency_keys table, 24h TTL). See `docs/api-idempotency.md`. |

---

## 4. Frontend

| Task | Status | Notes |
|------|--------|------|
| Query client retry/backoff for critical queries | Done | Default retry: up to 2 retries with exponential backoff (1s, 2s, 4s cap); no retry on 4xx. `lib/query-client.ts`. |
| Clear offline/failure UX | Done | Root ErrorBoundary: "Something went wrong" + "Try again" (reload) and "Go home" buttons. |

---

## 5. Infrastructure & Ops

| Task | Status | Notes |
|------|--------|------|
| Public health endpoint `GET /health` | Done | Returns 200 + `{ status: 'ok', db: 'ok' }`; 503 if DB check fails. |
| Structured logging | Done | Global onError logs with traceId, code, tenantId, userId; auth middleware uses request-scoped logger (with code) instead of console. |
| Cron/backup alerting and runbook | Done | disaster-recovery.md already has restore runbook and backup alerts; added "If the backup cron did not run" check and manual backup steps. |

---

## 6. Quick Wins

| Task | Status | Notes |
|------|--------|------|
| Filter guest schedule by status in API or UI | Done | Guest schedule API returns only `active` classes. |
| Add `GET /health` (200 + optional DB check) | Done | `GET /health` returns 200 when DB ok, 503 when DB error. |
| Wrap schedule and checkout in `ComponentErrorBoundary` | Done | Schedule already wrapped; checkout page wrapped. |
| Standardize API error JSON and document | Done | See `docs/api-error-shape.md` and API README. |

---

## 7. Recommended Next Improvements

Ideas for further performance, stability, and resiliency work (not yet scheduled).

### Performance

| Idea | Effort | Impact | Notes |
|------|--------|--------|-------|
| **Enable cache for public/guest schedule** | Low | Medium | `cacheMiddleware` exists but is commented out in `classes.schedules.ts`. Enable with short `maxAge` (e.g. 60s) and `staleWhileRevalidate` to cut D1 load on high-traffic public schedule. |
| **Request timeouts (frontend)** | Low | Medium | `apiRequest` in `apps/web/app/utils/api.ts` has no timeout. Add `AbortSignal.timeout(30000)` (or configurable) so slow API doesn’t hang the UI. |
| **Request timeouts (API outbound)** | Medium | Medium | External calls (Stripe, Cloudflare API, Zoom) have no explicit timeout. Use `AbortSignal.timeout()` on `fetch` so a stuck dependency doesn’t consume full Worker CPU. |
| **Query client tuning** | Low | Low | Consider per-route `staleTime` for heavy dashboards (longer) vs. schedule (shorter). Optional `gcTime` to control cache retention. |

### Stability

| Idea | Effort | Impact | Notes |
|------|--------|--------|-------|
| **429 response shape** | Low | Low | Rate limit currently returns `{ error: 'Too Many Requests' }`. Use consistent shape: `{ error, code: 'RATE_LIMIT_EXCEEDED', requestId? }` and add to `docs/api-error-shape.md`. Optional: `Retry-After` header from `X-RateLimit-Reset`. |
| **Idempotency for checkout session** | Medium | High | POST `/commerce/checkout/session` can create duplicate sessions on retry. Add `Idempotency-Key` support (same pattern as guest booking) to return existing session when key is reused. |
| **Rate limit fail-open behavior** | Medium | Low | When the RateLimiter DO is unavailable, middleware fails open. For critical routes (e.g. checkout), consider fail-closed or per-isolate fallback limit so abuse doesn’t slip through. |
| **Webhook retry documentation** | Low | Low | Document that Stripe webhooks return 500 on processing failure (so Stripe retries) and that `processedWebhooks` makes handling idempotent. Add to runbook or API docs. |

### Resiliency

| Idea | Effort | Impact | Notes |
|------|--------|--------|-------|
| **Health deep checks** | Low | Medium | Optional admin-only endpoint (e.g. `GET /diagnostics/health?deep=1`) that checks D1 + R2 + optional Stripe connectivity; use for runbooks and escalation. |
| **Circuit breaker for external services** | High | Medium | If Stripe or another dependency is slow/failing, optionally fail fast with 503 instead of long timeouts. Requires state per isolate or DO. |
| **Structured 429 with Retry-After** | Low | Low | Set `Retry-After` (seconds until `X-RateLimit-Reset`) on 429 responses so clients can back off correctly. |
| **E2E / load tests in CI** | Medium | High | Run k6 load tests when `LOAD_TEST_BASE_URL` is set; add E2E for critical flows (e.g. booking → checkout) to catch regressions. |

### Observability

| Idea | Effort | Impact | Notes |
|------|--------|--------|-------|
| **SLO alerts** | Medium | High | `docs/observability.md` defines latency/error/availability targets; wire alerts (e.g. p95 &gt; 500ms, error rate &gt; 1%) in your monitoring stack. |
| **Rate limit metrics** | Low | Low | Expose count of 429s or rate-limit hits in `GET /diagnostics/golden-signals` or logs for dashboards. |

---

### Detailed rationale: five high-priority items

Expanded description and need for the items that most often come up next.

#### 1. Idempotency for checkout session (Medium effort, High impact)

**What it is**  
Support an `Idempotency-Key` header on `POST /commerce/checkout/session`. If the same key is sent again within the TTL window (e.g. 24h), return the same checkout session (or session URL) instead of creating a new one.

**Why it's needed**  
- Users (or the frontend) often retry when the first request is slow or the response is lost. Without idempotency, each retry creates a **new** Stripe Checkout Session.
- Multiple sessions for the same intent can cause double charges, confused UX ("which link do I use?"), and extra Stripe usage. Idempotency makes "create checkout" safe to retry.
- We already do this for guest booking (`POST /guest/booking` with D1 `idempotency_keys`); checkout is the same pattern applied to a payment flow.

**What "done" looks like**  
- API accepts optional `Idempotency-Key` on `POST /commerce/checkout/session`.
- First request with a key: create session, store key → session id (or URL) in D1 (reuse or extend `idempotency_keys`), return session.
- Duplicate request with same key within TTL: return stored response (same session id/URL) with 200, no new Stripe call.
- Document in `docs/api-idempotency.md` and API README.

---

#### 2. Rate limit fail-closed for critical routes (Medium effort, Low impact)

**What it is**  
Today, if the RateLimiter Durable Object is unavailable (e.g. timeout, error), the rate-limit middleware **fails open**: the request proceeds and is not counted. For high-value or abuse-prone routes (e.g. checkout, guest booking, password reset), we could **fail closed** instead: if we can't check the limit, reject the request (e.g. 503) or apply a strict per-request fallback (e.g. in-memory cap per isolate).

**Why it's needed**  
- Fail-open avoids blocking traffic when the DO is down but allows unlimited traffic during that window. For checkout or guest booking, that can mean a burst of duplicate or abusive requests.
- Fail-closed (or a conservative fallback) trades availability of those routes during DO issues for stricter protection. The choice is policy: "never block legitimate users" vs "never allow unthrottled payment/booking when we can't enforce limits."

**What "done" looks like**  
- Define which routes are "critical" (e.g. checkout, guest booking, accept-invite).
- When the rate-limit check fails (catch block in middleware), either: return 503 with a clear code (e.g. `RATE_LIMIT_UNAVAILABLE`), or apply a very low in-memory limit per Worker (e.g. 5 req/min per key) so some traffic is still allowed but abuse is capped.
- Document behavior in API docs and runbook.

---

#### 3. Enable cache for public/guest schedule (Low effort, Medium impact)

**What it is**  
Use the existing `cacheMiddleware` (Cache API / Cloudflare cache) for the **guest** schedule endpoint or the routes that serve it. Today it's commented out in `classes.schedules.ts` (which may be the studio schedule, not guest). The goal is to cache responses for `GET /guest/schedule/:slug` (or the equivalent path that serves the public schedule) with a short `maxAge` (e.g. 60s) and optional `staleWhileRevalidate` so repeat views don't hit D1 every time.

**Why it's needed**  
- The public schedule is often the most viewed page (guests, crawlers, embeds). Every view without cache means a D1 query and serialization. That drives latency and load under traffic spikes.
- Schedule data is tolerant of short staleness (e.g. 60s). Caching at the edge reduces D1 load and improves p95 latency for that endpoint.

**What "done" looks like**  
- Identify the exact route(s) that serve public/guest schedule (e.g. guest route in API, or the path used by the web app's loader).
- Apply `cacheMiddleware({ maxAge: 60, staleWhileRevalidate: 300 })` (or similar) to that path only. Ensure cache key includes tenant slug (and optionally `start`/`end` if query params are used).
- Confirm Cache API is available in the Worker environment (Cloudflare supports it). Re-enable or add the middleware; do not cache authenticated or tenant-private schedule endpoints.

---

#### 4. Request timeouts on API outbound calls (Medium effort, Medium impact)

**What it is**  
Every outbound `fetch` from the API to an external service (Stripe, Cloudflare API, Zoom, Resend, etc.) should use a timeout (e.g. `AbortSignal.timeout(15000)`) so a hung connection doesn't hold the Worker until the platform kills it.

**Why it's needed**  
- If Stripe or another provider is slow or stuck, a request without a timeout can run for the full Worker CPU limit (e.g. 30s+). That consumes capacity and can cause cascading slowdowns or 5xx for other requests on the same Worker.
- Failing fast (e.g. after 15s) returns a clear error to the client and frees the Worker. Clients can retry; the system stays responsive.

**What "done" looks like**  
- Audit all external `fetch` and SDK calls (Stripe, Cloudflare, Zoom, Resend, etc.). Where the client supports it, pass `signal: AbortSignal.timeout(N)` (N e.g. 15000 ms). Where only callback-style or no signal is supported, wrap in `Promise.race` with a timeout that rejects or aborts.
- Prefer a shared constant (e.g. `OUTBOUND_TIMEOUT_MS`) and use it consistently. Optionally log timeouts with a distinct code (e.g. `UPSTREAM_TIMEOUT`) for observability.
- Document in API/runbook that outbound calls are time-bounded.

---

#### 5. SLO alerts in your monitoring stack (Medium effort, High impact)

**What it is**  
`docs/observability.md` already defines target SLOs (e.g. read latency p95 &lt; 500ms, write p95 &lt; 1s, error rate &lt; 1%, availability 99%+). "SLO alerts" means configuring your monitoring system (e.g. Grafana, Datadog, Cloudflare Analytics) to **alert** when those targets are breached (e.g. p95 &gt; 500ms, error rate &gt; 1%, or health check failing).

**Why it's needed**  
- SLOs are only useful if someone is notified when we miss them. Without alerts, regressions (e.g. a slow dependency, a bad deploy) can go unnoticed until users complain.
- Alerts drive incident response, capacity planning, and prioritization of stability work. They close the loop between "we want p95 &lt; 500ms" and "we know when we're not meeting it."

**What "done" looks like**  
- In the tool that ingests your API logs or metrics (e.g. from `durationMs`, status, or golden-signals endpoint), define alerts such as: p95 latency (e.g. for GET /classes or key paths) &gt; 500ms (read) or &gt; 1s (write); error rate (5xx or 4xx as you define) &gt; 1% over a window (e.g. 5m); availability: health or golden-signals endpoint failing or returning 5xx for &gt; 1% of checks.
- Route alerts to the right channel (e.g. PagerDuty, Slack, email) and document in the runbook how to interpret and respond. Keep `docs/observability.md` as the single source of truth for target values and what each signal means.

---

## Changelog

- **2025-03-14**: Created tracker; started Item 1 testing (auth unit tests, optionalAuth, API key, impersonation, tenant isolation).
  - Auth unit: added expired JWT and malformed-Bearer cases in `auth.test.ts`. OptionalAuth: added “valid Bearer sets auth” in `optionalAuth.test.ts`. All 15 unit tests pass.
  - Impersonation: added `test/integration/impersonation.integration.test.ts` (valid HS256 JWT → 200, wrong secret → 401); added `IMPERSONATION_SECRET` to integration bindings.
  - Tenant isolation: added Scenario 5b in `security.integration.test.ts` (member of tenant A cannot list tenant B’s `/classes` or `/members` via X-Tenant-Slug).
- **2025-03-15**: Fixed integration test DB schema so auth, impersonation, and security tests pass.
  - `test-utils.ts`: added `stripe_customer_id`, `invited_at`, `accepted_at` to `tenant_members`; added `reminder_sent_at` to `bookings`. All integration tests (auth, api-key, impersonation, security) now pass.
- **2025-03-15**: E2E expansions (Item 1).
  - Smoke: added "public schedule (embed calendar) loads" in `smoke.spec.ts` (mocks guest/schedule; requires API or mock when loader runs server-side).
  - A11y: added "public schedule (embed)" axe scan in `accessibility.spec.ts`.
  - Documentation: added "documentation and platform architecture load when authenticated (E2E bypass)" in `documentation.spec.ts`. Chat widget already covered in `chat-widget.spec.ts`.
- **2025-03-15**: Quick wins and infra.
  - **GET /health**: Added public `GET /health` in API (no auth). Returns `{ status: 'ok', db: 'ok' }` with 200, or `{ status: 'ok', db: 'error' }` with 503 if DB check fails. Integration test: `health.integration.test.ts`.
  - **Guest schedule**: `packages/api/src/routes/guest.ts` — filter classes by `status = 'active'` so cancelled/archived do not appear on public schedule.
  - **Error boundaries**: Wrapped checkout page (`studio.$slug.checkout.tsx`) in `ComponentErrorBoundary`. Schedule already had boundaries (calendar + list view).
- **2025-03-15**: API error shape and loader resilience.
  - **Error shape**: Global `onError` now returns `{ error, code, requestId }` for all errors; 500 responses use `code: 'INTERNAL_ERROR'`. Added `docs/api-error-shape.md` (codes, status mapping, examples) and linked from API README.
  - **Critical loaders**: Verified studio layout, public schedule ($pageSlug), and embed calendar loaders already catch errors and return 404 or safe payloads; no unhandled throws.
- **2025-03-15**: Frontend resilience.
  - **Query client**: Default retry up to 2 times with exponential backoff; skip retry on 4xx. Applied to all queries (tenant info, schedule, etc.) via `lib/query-client.ts`.
  - **Root ErrorBoundary**: Copy updated to "Something went wrong" / "We couldn't load this page. Try again or go home." with "Try again" and "Go home" buttons.
- **2025-03-15**: Structured logging and cron runbook.
  - **API logging**: Global onError now logs with traceId, code, tenantId, userId (and fallback JSON when logger missing). Auth middleware and optionalAuth use `c.get('logger')` for errors/warnings/debug instead of console; log payloads include a `code` (e.g. IMPERSONATION_FAILED, JWT_VERIFY_FAILED, MISSING_PUBLIC_KEY).
  - **Cron/backup**: Added "If the backup cron did not run" subsection to `docs/disaster-recovery.md` (how to check, verify trigger, run manual backup, investigate).
- **2025-03-15**: Input validation and idempotency.
  - **Guest routes**: POST `/guest/booking` and POST `/guest/chat/start` now validate request body with Zod; invalid JSON or schema returns 400 with `{ error, code: 'VALIDATION_FAILED', issues }`.
  - **Idempotency**: Added `docs/api-idempotency.md` (Idempotency-Key header, recommended endpoints, server behavior). Linked from API README.
- **2025-03-15**: Incremental validation and idempotency implementation.
  - **Validation**: POST `/guest/token` (Zod: email, optional name). POST `/commerce/checkout/session` (Zod: at least one of packId/planId/recordingId/giftCardAmount, optional coupon/gift card/recipient fields). POST `/bookings` (Zod: classId, optional attendanceType, memberId).
  - **Idempotency**: POST `/guest/booking` now honors `Idempotency-Key`; uses D1 table `idempotency_keys` (migration 0083), 24h TTL; duplicate key returns stored 200 without creating a second booking. Test schema in test-utils includes idempotency_keys.
- **2026-03-14**: Idempotency for checkout and rate limit fail-closed.
  - **Checkout idempotency:** `POST /commerce/checkout/session` now honors `Idempotency-Key`. Same key within 24h returns stored response (200) without creating a second Stripe session. Uses D1 `idempotency_keys` table. Documented in `docs/api-idempotency.md`.
  - **Rate limit fail-closed:** Added `failClosed` option to rate limit middleware. When the RateLimiter DO is unavailable, critical routes return 503 with `code: 'RATE_LIMIT_UNAVAILABLE'` instead of failing open. Applied to: `POST /commerce/checkout/session`, `POST /guest/booking`, `GET/POST /members/accept-invite`. Documented in `docs/api-error-shape.md`.
- **2026-03-14**: Stability and observability improvements (from Recommended Next).
  - **429 response shape**: Rate limit middleware now returns `{ error, code: 'RATE_LIMIT_EXCEEDED', requestId? }` and sets `Retry-After` (seconds until reset). Documented in `docs/api-error-shape.md`.
  - **Webhook retry**: Added `docs/api-webhooks.md` (Stripe retry behavior, idempotency via `processed_webhooks`). Linked from API README.
  - **Health deep checks**: `GET /diagnostics/health?deep=1` (platform admin only) checks D1, R2 (if bound), and Stripe connectivity; returns per-component status and 503 if any check fails.
  - **Rate limit metrics**: `GET /diagnostics/golden-signals` now includes `rateLimitExceeded` (count of 429s in last 24h).
  - **Frontend request timeout**: `apiRequest` in `apps/web/app/utils/api.ts` uses `AbortSignal.timeout(30000)` when no custom signal is passed.
