# API Audit: Gaps & Improvement Plan

Based on a comprehensive audit of the 67 API route files and the database schema, I have identified several key areas where the API can be expanded or improved to better serve studio owners and platform administrators.

## 1. Missing Analytics & Business Intelligence
The current `analytics.ts` provides only utilization, retention, and LTV. Essential BI gaps include:
- **[DONE] Conflict Detection**: Integrated `ConflictService` to cross-check for room and instructor double-bookings during class transitions.
- **[DONE] Percentage Pay Models**: The payroll engine now supports `payModel: 'percentage'` with `payoutBasis: 'gross' | 'net'` and optional fixed deductions; class and appointment payroll is calculated as a percentage of *actual* realized revenue (Net GMV after refunds/fees) via `PayrollService.calculateClassPay` / `calculateAppointmentPay`.
- **[CRITICAL] Partial Refund Reconciliation**: Missing logic to automatically reverse loyalty points or class credits when a Stripe refund is issued.
- **[NEW] Churn Prediction**: Identifying "at-risk" members who haven't booked in 14+ days.

## 2. Operations & Bulk Management
While `/members/bulk` exists, many other areas are missing efficient batch operations:
- **[DONE] Bulk Class Management**: Bulk-cancel (`POST /classes/bulk-cancel` with `classIds` or `from`/`to` + filters), bulk-move (`POST /classes/bulk-move` with shift in minutes), and bulk-update instructors/locations (`POST /classes/bulk-update`) for a range of class instances, all conflict-checked via `ConflictService`.
- **[DONE] Bulk Check-in**: `POST /classes/:id/check-in-all` checks in (or clears) all confirmed bookings for a class; `POST /classes/:id/bulk-check-in` accepts `{ bookingIds, checkedIn }` for a subset.
- **[DONE] Resource Conflict Detection**: Implemented `ConflictService.checkRoomConflict` to prevent space overlaps.

## 3. Data Integrity & Schema Gaps
- **[NEW] Tagging System**: Implement a generic `tags` table and associated API to allow studios to categorize members (e.g., "VIP", "Needs Waiver").
- **[NEW] Custom Fields API**: Allow tenants to define custom schema keys for member profiles (e.g., "Medical Notes") without bloating the base `profile` JSON.
- **[IMPROVE] Audit Logging**: Structure the `audit_logs` table better to support filtered queries by `targetType` (e.g., "Show all changes for Member X").

## 4. Documentation & Developer Experience
- **OpenAPI / Swagger Spec**: The API currently lacks a machine-readable specification. Implementing `@hono/zod-openapi` would allow for auto-generated documentation and typed client generation.
- **Webhooks**: Studio owners can register URLs, but there is no "Test Hook" or "Webhook Attempt Log" API to help them debug their integrations.

## 5. Security Improvements
- **[DONE] Rate Limiting**: Implemented per-user and token/IP rate limiting backed by a Durable Object (`RATE_LIMITER`), with route-specific overrides and a "cost" parameter so expensive operations (exports, payroll generation, bulk mutations, analytics) consume more of the rate budget than simple reads.
- **Granular RBAC**: Many routes use `roles.includes('owner')`. Moving to a capability-based system (e.g., `can:manage_billing`) would allow for more flexible staff permissions.
