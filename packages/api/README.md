# Studio Platform API

## Overview
This is the backend API for the Studio Platform, built with Hono and deployed to Cloudflare Workers. It handles multi-tenancy, authentication (Clerk), database access (D1), and third-party integrations (Stripe, Twilio, Expo).

## Recent Updates (Mobile & Notifications)

### Mobile App Configuration
Endpoints to manage branding and feature flags for the single-tenant mobile app.
*   **GET** `/:tenantId/mobile-config`
*   **PUT** `/:tenantId/mobile-config`
    *   Body: `{ enabled, theme: { primaryColor, darkMode }, features: { booking, shop, vod, profile }, links: { ... } }`

### Notification Preferences
Endpoints for users/instructors to manage their alert settings.
*   **GET** `/users/me/settings/notifications`
*   **PUT** `/users/me/settings/notifications`
    *   Body: `{ notifications: { substitutions: { email, sms, push } } }`

### Push Notifications
Uses Expo Push API for sending notifications to the mobile app.
*   **Infrastructure**: `PushService` (services/push.ts) stores logs in `push_logs` table.
*   **Triggers**:
    *   Substitute Requests (notify other instructors)
    *   Substitute Filled (notify requester)
*   **Requirements**:
    *   User must have `pushToken` stored in `users` table.
### SEO Management (Tier 2, 3 & 4)
Advanced multi-tenant SEO infrastructure with automated local search integration.
*   **Google Business Profile**: OAuth-based NAP (Name, Address, Phone) syncing and Review Engine automation.
*   **Indexing Service**: Cloudflare Queue (`seo-indexing-queue`) for real-time Google Indexing API notifications.
*   **Dynamic Metadata**: Edge-rendered AI meta descriptions and rich Schema.org JSON-LD injection (LocalBusiness, Event, VideoObject).
*   **Streaming Sitemaps**: High-performance XML sitemap generation for studios, classes, and LMS videos.
*   **Tier 4: Local Dominance**: Automated SEO-friendly URL slugs for locations, dedicated landing pages, and studio-specific SEO analytics.
*   **Platform SEO Management**: Global oversight for admins to track indexing, sitemap health, and GBP connectivity across all tenants via `GET /admin/seo/*`.

## Performance & Scalability

The API is optimized for low-latency execution on Cloudflare Workers:
*   **Query Batching**: Quota checks and usage increments use `db.batch()` to reduce round-trips.
*   **Concurrency**: Average request duration under load (20 VUs) is **~16ms** with a **p(95) of ~37ms**.
*   **Optimized Queries**: Conflict detection and activity lookups use index-friendly range filters and aggregations to avoid N+1 bottlenecks.
*   **Chunked Fetching**: Mandatory `limit` and `offset` pagination on list endpoints to ensure consistent performance.
*   **Course Curriculum**: Batch-fetches all referenced content (videos, quizzes, articles, assignments, resources) in 5 parallel `inArray()` queries rather than one query per item.
*   **Tenant Middleware**: Member and roles loaded in a single Drizzle relation query, saving one DB round-trip per authenticated request.

## Security

*   **Stripe API Version**: `2026-01-28.clover` (latest) — set consistently across all SDK initializations.
*   **Input Sanitization**: Stripe customer search queries are sanitized before interpolation. Webhook payloads validated for format before DB lookup.
*   **Safe SQL**: Array-based deletes use Drizzle `inArray()` — no raw SQL template interpolation.
*   **CORS**: `allowHeaders` restricted to explicit list (no wildcard).
*   **Health Endpoint**: `GET /` returns only `{ status: 'OK' }` — no environment variable disclosure.

## Testing & Stability

### Integration Tests
The project uses Vitest with `@cloudflare/vitest-pool-workers` for full integration testing against a local D1 instance.
*   **Centralized Setup**: `test/integration/test-utils.ts` provides standardized schema setup and data seeding.
*   **Standardized Timestamps**: All test data uses millisecond-precision timestamps to match production SQLite behavior.
*   **Execution**:
    ```bash
    npm run test:integration
    ```

### Load Testing
Performance is verified using k6 scripts in the `/k6` directory.
*   **Browse Scenario**: Simulates concurrent users viewing class schedules.
*   **Booking Scenario**: Simulates concurrent booking operations.
*   **Execution**:
    ```bash
    npm run load-test
    ```

