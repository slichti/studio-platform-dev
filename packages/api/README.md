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

## Mobile App Strategy
The platform uses a "Shared Container" model.
1.  All users download the same app.
2.  Users enter a **Studio Code** (Tenant Slug) or scan a **QR Code**.
3.  The app fetches config via `/:id/mobile-config` and themes itself.

