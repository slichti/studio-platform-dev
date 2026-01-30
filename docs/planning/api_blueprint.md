# API Blueprint: Studio Platform

This document provides a structural overview of the Studio Platform API, its domains, and key architectural patterns.

## Base URL & Infrastructure
- **Entry Point**: `packages/api/src/index.ts`
- **Framework**: Hono
- **Hosting**: Cloudflare Workers
- **Database**: D1 (SQLite)
- **Object Storage**: R2

## Technical Context

### Environment Bindings (`Bindings`)
These keys must be configured in `wrangler.toml` or the Cloudflare Dashboard.

| Key | Type | Description |
| :--- | :--- | :--- |
| `DB` | `D1Database` | Primary SQLite storage. |
| `R2` | `R2Bucket` | Media and asset storage. |
| `CLERK_*` | `string` | Auth secrets (Secret Key, PEM, Webhook Secret). |
| `STRIPE_*` | `string` | Billing integration (Secret Key, Client ID). |
| `ZOOM_*` | `string` | Virtual class meetings management. |
| `CLOUDFLARE_*` | `string` | Account ID and API Token for Workers/R2/Stream. |
| `RESEND_API_KEY` | `string` | Transactional email delivery. |
| `LIVEKIT_*` | `string` | Real-time audio/video infrastructure. |
| `GOOGLE_*` | `string` | Calendar and OAuth credentials. |
| `ENCRYPTION_SECRET`| `string` | Used for BYOK credential storage. |

### Request Context (`Variables`)
Shared state accessible via `c.get()` in handlers.

- **`tenant`**: The current studio object (from `tenantMiddleware`).
- **`member`**: The authenticated user's member profile in the current studio.
- **`roles`**: Array of roles (e.g., `['owner', 'instructor', 'student']`).
- **`auth`**: `{ userId: string, claims: any }` (Clerk User ID).
- **`features`**: `Set<string>` of enabled feature flags for this tenant.

---

## 1. Public API (`/public`, `/guest`)
Endpoints accessible without authentication (for landing pages, registration, and anonymous widgets).

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/public/tenant/:slug` | GET | Fetch public studio branding/info by slug. |
| `/public/classes` | GET | List public classes for a tenant. |
| `/guest/book` | POST | Anonymous booking or lead capture. |
| `/website/pages/:slug` | GET | Fetch website builder content for a page. |

## 2. Platform Admin API (`/admin`)
Restricted to users with `isPlatformAdmin: true`.

| Group | Route | Description |
| :--- | :--- | :--- |
| **Tenants** | `/admin/tenants` | Manage all studio accounts. |
| **Users** | `/admin/users` | Global user directory and permissions. |
| **Billing** | `/admin/billing` | Monitor SaaS revenue and platform costs. |
| **Stats** | `/admin/stats` | Platform-wide health and usage metrics. |
| **Config** | `/admin/config` | Global feature flags (e.g., `enable_sms`). |

## 3. Studio Management API (`/tenant`, `/*`)
Context-aware routes that require both `authMiddleware` and `tenantMiddleware`.

### Core Studio Logic (`/tenant`)
| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/tenant/info` | GET | Get current studio settings and feature status. |
| `/tenant/me` | GET | Get current user's profile and roles in this studio. |
| `/tenant/settings`| PATCH | Update branding, mobile app config, and studio settings. |
| `/tenant/usage` | GET | View current usage vs limits (SMS, Email, Storage). |

### Functional Domains
- **Classes**: `/classes` (Schedules, Bookings, Recordings)
- **Members**: `/members` (Profile, History, Packs, Memberships)
- **Commerce**: `/commerce`, `/pos`, `/refunds`
- **Operations**: `/payroll`, `/locations`, `/tasks`, `/waivers`
- **Growth**: `/marketing`, `/leads`, `/referrals`, `/coupons`
- **Support**: `/chat`, `/faqs`

## 4. System & Integration API (`/webhooks`, `/uploads`, `/telemetry`)
| Route | Description |
| :--- | :--- |
| `/webhooks/stripe` | Inbound payment event handling. |
| `/webhooks/clerk` | User lifecycle event handling. |
| `/uploads/sign` | Generate R2 presigned URLs. |
| `/telemetry` | Client-side error/usage reporting. |

---

## Design Patterns
- **Success Responses**: Standard JSON objects.
- **Error Responses**: `{ error: string, message?: string }`.
- **RBAC**: Handled via `c.get('roles')` in route handlers.
- **Traceability**: All requests logged with `traceId`.
