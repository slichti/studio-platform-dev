# Security Hardening Guide

This document describes the security controls implemented across the Studio Platform API and web application.

## Authentication

- **Provider**: Clerk (JWT-based, verified server-side on every request via `authMiddleware`).
- **Impersonation**: Admin-to-tenant impersonation uses short-lived `HS256` tokens. Token presence is tracked in `isImpersonating` context; impersonating admins are exempt from MFA enforcement.
- **MFA Enforcement**: Owners must have completed MFA (`amr` claim contains `mfa`, `otp`, or `totp`). Checked per-request in tenant middleware.
- **E2E Bypass**: `TEST-AUTH` header only accepted when `ENVIRONMENT === 'test'`. Blocked in all other environments.
- **No Debug Logging**: Auth headers are not logged in any environment.

## Authorization (RBAC)

Permissions are resolved by `PermissionService` on every authenticated request:

| Role | Scope |
|------|-------|
| Platform Admin | All tenants, all data |
| Owner | Full access to own tenant |
| Instructor | Classes, students, bookings |
| Student | Own profile, own bookings |

Custom roles can extend built-in permissions via `customRoles` → `memberCustomRoles`. All custom permissions are merged with base role permissions before `can()` checks.

## Input Sanitization

### Stripe Customer Search
The Stripe Search API uses Lucene-like query syntax. User input is sanitized before interpolation:
```typescript
const safe = query.replace(/["\\]/g, '').trim().slice(0, 200);
```
Prevents quote-based search syntax injection.

### HTML Rendering (XSS Prevention)
All `dangerouslySetInnerHTML` calls pass content through `DOMPurify.sanitize()`:
- Course article content
- Assignment instruction HTML
- Website builder content blocks

### Webhook Payload Validation
External webhook payloads (Gympass, ClassPass) validate IDs against strict format regexes before any DB lookup:
```typescript
/^[a-zA-Z0-9_-]{1,64}$/.test(tenantId)
```

## Safe Database Operations

All array-based `WHERE ... IN (...)` operations use Drizzle's `inArray()` helper to ensure parameterized, type-safe queries. Raw SQL template literals with array interpolation have been removed.

## CORS Policy

Allowed headers are explicitly enumerated — no wildcard:
```
Authorization, Content-Type, X-Tenant-Slug, X-Request-Id,
X-Impersonate-User, Stripe-Signature, Svix-Id, Svix-Timestamp, Svix-Signature
```

Origin allowlist: `*.pages.dev`, `*.slichti.org`, `localhost`.

## Rate Limiting

Implemented via Cloudflare Durable Objects with cost-based weighting:
- **Global**: 300 req/min/IP
- **Authenticated**: 600 req/min/user
- **Isolated buckets**: Public routes (onboarding, booking widget) have separate counters

## Stripe Security

- **API Version**: `2026-01-28.clover` pinned consistently across all SDK initializations.
- **Webhook Verification**: All Stripe webhooks use `stripe.webhooks.constructEvent()` signature verification before processing.
- **Connect Isolation**: All Stripe API calls for tenant operations use the tenant's `stripeAccountId` via `stripeAccount` option — no cross-tenant Stripe operations possible.
- **No Card Data**: Platform never stores PAN, CVV, or bank account numbers. Stripe is the financial system of record.

## Webhook Security

| Webhook Source | Verification Method |
|---------------|---------------------|
| Stripe | HMAC signature (`stripe-signature` header) |
| Clerk | Svix signature (`svix-id`, `svix-timestamp`, `svix-signature`) |
| Gympass | HMAC signature (`X-Gympass-Signature`) + format validation on `gym_id` |
| ClassPass | HMAC signature (`X-ClassPass-Signature`) |
| Zoom | HMAC validation with challenge-response for URL verification |

All webhooks use idempotency via `processedWebhooks` table to prevent duplicate processing.

## Data Minimization & Compliance

- **Encryption at rest**: Sensitive integration credentials (Zoom, Resend) encrypted with AES-GCM-256.
- **No sensitive PII stored**: No SSN, driver's license, or financial account numbers.
- **Audit logging**: All administrative actions logged to `auditLogs` (365-day retention).
- **CAN-SPAM**: Physical address and unsubscribe link in all marketing emails.
- **TCPA**: SMS consent tracked; time-of-day restrictions enforced; STOP/START keywords handled.

## Health Endpoint

`GET /` returns only:
```json
{ "status": "OK" }
```
No environment variable names, secret presence, or infrastructure details are disclosed.

## Known Residual Risks

| Risk | Status | Notes |
|------|--------|-------|
| npm audit vulnerabilities (43) | Open | All in dev/build tools only (`expo`, `jest`, `eslint-plugin-react`, `drizzle-kit`). None run in the Cloudflare Worker at runtime. All require major breaking upgrades. |
| Mobile `color` prop deprecation (Lucide) | Open | Type errors in `apps/mobile` from Lucide React Native version upgrade. UI functional, types incorrect. |
| CSRF tokens for state-changing API calls | Mitigated | Clerk JWTs serve as implicit CSRF protection for authenticated routes. Stripe Connect OAuth uses signed state tokens. |
