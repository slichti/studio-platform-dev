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

#### Classes & Bookings (`/classes`, `/bookings`)
Schedules, bookings, check-ins, recordings, series management, and conflict detection.

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/classes` | Any | Paginated class schedule (supports `?limit=&offset=`) |
| `POST` | `/bookings` | Student | Book a class |
| `DELETE` | `/bookings/:id` | Student | Cancel own booking |
| `GET` | `/bookings/my-upcoming` | Student | Next 50 upcoming bookings (sorted ascending) |
| `GET` | `/bookings/history` | Student | Past bookings, paginated, filtered `startTime < now()` |
| `GET` | `/bookings/:id` | Owner/Student | Single booking (student can only view own) |

#### Members (`/members`)
Profile management, attendance history, class packs, waiver status, and student notes.

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/members/me` | Member | Current member profile + roles |
| `PATCH` | `/members/me/settings` | Member | Update notification preferences |
| `GET` | `/members/me/packs` | Member | Purchased class packs with `remainingCredits` and definition |

#### Users (`/users`)
User identity and profile management (Clerk-backed). Profile fields (name, phone) are stored in `users.profile` JSON.

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/users/me` | Auth | Current user + tenant memberships |
| `PATCH` | `/users/me` | Auth | Update `firstName`, `lastName`, `phone`, `bio` |
| `GET` | `/users/me/family` | Auth | Family profiles linked to this account |
| `POST` | `/users/me/family` | Auth | Add a family member |
| `PUT` | `/users/me/settings/notifications` | Auth | Update notification settings |

#### Memberships (`/memberships`) — Updated Feb 2026
Self-service subscription management integrated with Stripe.

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/memberships/plans` | Any | List active plans (add `?includeArchived=true` for admin) |
| `POST` | `/memberships/plans` | Owner | Create a new plan (Stripe product + price created) |
| `PATCH` | `/memberships/plans/:id` | Owner | Update plan name / description / trial days |
| `DELETE` | `/memberships/plans/:id` | Owner | Hard-delete (no subs) or soft-archive (has subs) |
| `PATCH` | `/memberships/plans/:id/status` | Owner | Toggle `active` (archive / restore) |
| `GET` | `/memberships/my-active` | Student | Fetch caller's active/trialing/past-due subscriptions |
| `POST` | `/memberships/subscriptions/:id/cancel` | Owner/Student | Cancel at period end via Stripe |

#### Courses & LMS (`/courses`, `/quiz`, `/assignments`) — Updated Feb 2026
Full learning management: enrollment, video curriculum, quizzes, assignments, and per-item progress.

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/courses/:id/curriculum/:itemId/complete` | Student | Mark item complete; recalculates progress % |
| `GET` | `/courses/:id/my-completions` | Student | Returns set of completed item IDs |
| `POST` | `/quiz/:id/submit` | Student | Auto-score submission; stored as `quiz_submissions` |
| `GET` | `/quiz/:id/my-submission` | Student | Latest quiz result for caller |
| `GET` | `/assignments/:id/my-submission` | Student | Latest assignment submission |
| `GET` | `/assignments/:id/submissions` | Instructor | All submissions for an assignment |
| `GET` | `/:courseId/all-submissions` | Instructor | All assignment submissions for a course |
| `PATCH` | `/assignments/submissions/:id/grade` | Instructor | Set `grade` and `feedback` |

#### Commerce (`/commerce`, `/pos`, `/refunds`)
Gift cards, coupons, POS retail, Stripe Terminal integration, and refunds.

#### Operations (`/payroll`, `/locations`, `/tasks`, `/waivers`)
Studio operations and compliance.

#### Growth (`/marketing`, `/leads`, `/referrals`, `/coupons`)
Automations, lead capture, referral tracking.

#### Support (`/chat`, `/faqs`)
Live chat via Durable Objects WebSockets, FAQ management.

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
- **RBAC**: Enforced via `c.get('can')(permission)` early-exit guards in each handler. Returns `403` before any DB access. See [docs/security.md](../security.md) for the full permission key reference.
- **Traceability**: All requests logged with `traceId`.
- **Pagination**: All list endpoints accept `?limit=&offset=` (max enforced per route). Portal uses `useFetcher.load()` for infinite scroll.
- **Tenant Isolation**: Every handler reads `c.get('tenant')` and filters all queries by `tenantId`. Cross-tenant data leakage is not possible via the API layer.
- **OpenAPI Strict Typing**: Routes registered with `app.openapi()` require response types to match declared schemas. Early `403` exits use `c.json({error}, 403) as any` to bypass the Hono union-type constraint while preserving runtime behavior.
