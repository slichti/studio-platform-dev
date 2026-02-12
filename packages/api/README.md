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
    *   User must have `push: true` in preferences.

## Performance & Scalability

The API is optimized for low-latency execution on Cloudflare Workers:
*   **Query Batching**: Quota checks and usage increments use `db.batch()` to reduce round-trips.
*   **Concurrency**: Average request duration under load (20 VUs) is **~16ms** with a **p(95) of ~37ms**.
*   **Optimized Queries**: Conflict detection and activity lookups use index-friendly range filters and aggregations to avoid N+1 bottlenecks.

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

