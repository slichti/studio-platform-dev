# Phase 2: API Resilience & Standardization Implementation Plan

This phase focuses on hardening the API, standardizing internal and external communications, and implementing advanced business intelligence features.

## Proposed Changes

### 1. Platform Hardening: Dynamic Rate Limiting
Implementing a sophisticated rate-limiting strategy beyond static IP-based limits.

- **[NEW] Cost-Based Middleware**: Assign "weights" to endpoints.
  - Basic `GET` = 1 point.
  - Resource-heavy `POST` / export = 10 points.
- **[NEW] Global Rate Limit Store**: Use Cloudflare KV or durable objects if absolute precision is needed, but D1/KV is standard for edge workers.
- **[MODIFY] `index.ts`**: Mount the dynamic limiter globally.

---

### 2. Authorization Evolution: Capability-Based RBAC
Moving from role strings to specific permissions.

- **[COMPLETED] `schema.ts`**: Add `permissions` (JSON array) to `tenant_roles` or a new `role_permissions` join table.
- **[COMPLETED] Auth Utilities**: `can(memberId, 'manage_billing')` helper (Implemented in `tenantMiddleware`).
- **[MODIFY] All Route Files**: Replace `.includes('owner')` with capability checks where appropriate.

---

### 3. API Standardization: OpenAPI / Swagger
Ensuring the API is machine-readable and well-documented.

- **[COMPLETED] Dependency**: Add `@hono/zod-openapi`.
- **[IN PROGRESS] Route Refactoring**: Transition Hono routes to `createRoute` from `@hono/zod-openapi`. (`tenant-integrations` completed)
- **[NEW] Documentation Endpoint**: Expose `GET /api/docs` using Swagger or Scalar UI.

---

### 4. Advanced Intelligence: Churn Prediction
Identifying at-risk members before they leave.

- **[NEW] ChurnService**: 
  - `calculateChurnScore(memberId)`: Analyzes booking frequency trends.
  - `getAtRiskMembers()`: Returns members with declining engagement.
- **[NEW] Automated Nudges**: Link churn scores to the `AutomationsService` to trigger re-engagement emails.

---

### 5. Developer Experience: Webhook Management [COMPLETED]
Exposing the inner workings of integrations to studio owners.

- **[COMPLETED] `tenant-integrations.ts`**:
  - `GET /webhooks/:id/logs`: Expose the `webhook_logs` table data.
  - `POST /webhooks/:id/test`: Send a mock payload to verify endpoint connectivity.

## Verification Plan

### Automated Tests
- Integration tests for rate limiting (ensure 429 is returned after point exhaustion).
- Unit tests for `ChurnService` logic against mock attendance data.

### Manual Verification
- Access `/api/docs` and verify all endpoints are correctly documented.
- Trigger a "Test Webhook" from the Dev portal and verify it appears in the log list.
