# API Audit: Gaps & Improvement Plan

Based on a comprehensive audit of the 67 API route files and the database schema, I have identified several key areas where the API can be expanded or improved to better serve studio owners and platform administrators.

## 1. Missing Analytics & Business Intelligence
The current `analytics.ts` provides only utilization, retention, and LTV. Essential BI gaps include:
- **[DONE] Conflict Detection**: Integrated `ConflictService` to cross-check for room and instructor double-bookings during class transitions.
- **[CRITICAL] Percentage Pay Models**: The payroll engine lacks logic for calculating pay as a percentage of *actual* class revenue (Net GMV), which is essential for many boutique studios.
- **[CRITICAL] Partial Refund Reconciliation**: Missing logic to automatically reverse loyalty points or class credits when a Stripe refund is issued.
- **[NEW] Churn Prediction**: Identifying "at-risk" members who haven't booked in 14+ days.

## 2. Operations & Bulk Management
While `/members/bulk` exists, many other areas are missing efficient batch operations:
- **[IMPROVE] Bulk Class Management**: Ability to bulk-cancel, bulk-move, or bulk-update instructors for a range of class instances.
- **[NEW] Bulk Check-in**: A "Check-in All" endpoint for classes to reduce manual overhead.
- **[DONE] Resource Conflict Detection**: Implemented `ConflictService.checkRoomConflict` to prevent space overlaps.

## 3. Data Integrity & Schema Gaps
- **[NEW] Tagging System**: Implement a generic `tags` table and associated API to allow studios to categorize members (e.g., "VIP", "Needs Waiver").
- **[NEW] Custom Fields API**: Allow tenants to define custom schema keys for member profiles (e.g., "Medical Notes") without bloating the base `profile` JSON.
- **[IMPROVE] Audit Logging**: Structure the `audit_logs` table better to support filtered queries by `targetType` (e.g., "Show all changes for Member X").

## 4. Documentation & Developer Experience
- **OpenAPI / Swagger Spec**: The API currently lacks a machine-readable specification. Implementing `@hono/zod-openapi` would allow for auto-generated documentation and typed client generation.
- **Webhooks**: Studio owners can register URLs, but there is no "Test Hook" or "Webhook Attempt Log" API to help them debug their integrations.

## 5. Security Improvements
- **Rate Limiting**: Current global rate limits are static. Implementing per-IP and per-User dynamic limits based on "Cost" (e.g., expensive search queries vs light health checks) would improve resilience.
- **Granular RBAC**: Many routes use `roles.includes('owner')`. Moving to a capability-based system (e.g., `can:manage_billing`) would allow for more flexible staff permissions.
