# API Improvements & Critical Gaps Implementation Plan

This plan outlines the implementation of critical features and architectural improvements identified during the API audit. The focus is on enhancing operational safety, financial accuracy, and data flexibility.

## Proposed Changes

### 1. Schema Extensions & Data Integrity
Supporting new flexible data structures and improved auditing.

#### [MODIFY] [schema.ts](file:///Users/slichti/GitHub/studio-platform-dev/packages/db/src/schema.ts)
- [NEW] `memberTags` table for structured member categorization.
- [NEW] `customFields` table for defining tenant-specific schema keys.
- [NEW] `customFieldValues` table for storing actual data against members/entities.
- [MODIFY] `payrollConfig`: Add `payoutBasis` (Gross vs Net) for percentage models.
- [MODIFY] `auditLogs`: Add `targetType` explicitly to support indexed filtering.

---

### 2. Operational Safety: Conflict Detection
Preventing room and staff double-bookings.

#### [NEW] `ConflictService` (`packages/api/src/services/conflicts.ts`)
- `checkInstructorConflict(instructorId, startTime, duration)`: Returns overlapping classes/appointments.
- `checkRoomConflict(locationId, startTime, duration)`: Returns overlapping events in the same space.

#### [MODIFY] [classes.schedules.ts](file:///Users/slichti/GitHub/studio-platform-dev/packages/api/src/routes/classes.schedules.ts)
- Integrate `ConflictService` into Class Creation (`POST /`) and Update (`PATCH /:id`).
- Return 409 Conflict if overlap detected (unless explicitly overridden).

#### [MODIFY] [substitutions.ts](file:///Users/slichti/GitHub/studio-platform-dev/packages/api/src/routes/substitutions.ts)
- Integrate `ConflictService` into Substitution Claim (`POST /:id/claim`).

---

### 3. Financial Integrity: Payroll & Refunds
Advanced business logic for payouts and reconciliation.

#### [MODIFY] [payroll.ts](file:///Users/slichti/GitHub/studio-platform-dev/packages/api/src/routes/payroll.ts)
- Implement `percentage` logic in `/generate` using the `posOrders` and `payoutBasis` settings.

#### [MODIFY] [webhooks.ts](file:///Users/slichti/GitHub/studio-platform-dev/packages/api/src/routes/webhooks.ts)
- Enhance Stripe `charge.refunded` event handling.
- Automatically reverse loyalty points and class credits associated with the refunded transaction.

---

### 4. Bulk Operations & DX
Efficiency improvements for studio management.

#### [MODIFY] [classes.bookings.ts](file:///Users/slichti/GitHub/studio-platform-dev/packages/api/src/routes/classes.bookings.ts)
- [NEW] `POST /:id/bulk-check-in`: Check-in all confirmed attendees at once.

#### [MODIFY] [tenant-integrations.ts](file:///Users/slichti/GitHub/studio-platform-dev/packages/api/src/routes/tenant-integrations.ts)
- [NEW] `GET /webhooks/logs`: Retrieve recent delivery attempts for debugging.

---

### 5. Documentation & UI
Exposing and explaining new features to users.

#### Internal Documentation
- Update `SYSTEM_OVERVIEW.md` with Conflict Detection and Tagging system details.

#### Admin & Tenant Portal
- Add "Conflicts" warnings in Management Dashboard.
- Add "Tags" management in Studio Settings.
- Add "Custom Fields" configuration in Studio Settings.

## Verification Plan

### Automated Tests
- `npm run test`: Verify conflict detection logic with overlapping sample data.
- Payload validation for percentage-based payroll generation.

### Manual Verification
- Attempt to schedule an instructor for two overlapping classes in the Dev environment.
- Process a mock refund in Stripe dashboard and verify logic point reversal.
- Use the "Check-in All" button on a class with multiple students.
