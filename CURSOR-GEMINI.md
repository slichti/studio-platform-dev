# CURSOR-GEMINI.md - Project Overview & Status

> **IDE Sync File** — Updated by Cursor (Gemini session). Append updates here whenever features land so other IDEs stay in sync.

## Application Overview
**Studio Platform** is a modern, all-in-one multi-tenant SaaS platform designed for dance, yoga, and fitness studios. It provides studio owners with tools for management, commerce, and student engagement while providing students with a seamless booking and learning experience.

## Architecture & Technology Stack
Built on top of the **Cloudflare Edge Network** for sub-50ms latency globally.

| Layer | Technology |
|-------|------------|
| **Frontend (Web)** | React Router v7 (SSR), TypeScript, TailwindCSS v4 |
| **Mobile App** | Expo v54 (React Native), Expo Router, NativeWind |
| **API Backend** | Cloudflare Workers, Hono Framework |
| **Database** | Cloudflare D1 (SQLite), Drizzle ORM |
| **Real-time State** | Cloudflare Durable Objects (WebSockets) |
| **File Storage** | Cloudflare R2 |
| **Authentication** | Clerk |
| **Payments** | Stripe Connect (Multi-tenant) |
| **Communication** | Resend (Email), Twilio (SMS), Expo (Push) |
| **Workflow** | Cloudflare Cron Triggers |

## Project Structure (Monorepo)
- `apps/web`: React Router v7 application hosted on Cloudflare Pages.
- `apps/mobile`: Universal mobile app (iOS/Android) built with Expo.
- `packages/api`: Edge-optimized backend handling core business logic.
- `packages/db`: Drizzle ORM schemas and migrations for D1.
- `packages/emails`: React-email templates for marketing and alerts.
- `packages/ui`: Shared React and Native component library.

## Core Features
1. **Studio Management**: Class scheduling, check-ins, instructor payroll, and room conflict detection.
2. **Course Management (LMS)**: Hybrid courses with live sessions, VOD curricula, quizzes, and automated completion certificates.
3. **Unified Roster**: A centralized view for studio owners to manage all student enrollments across classes, workshops, and courses.
4. **Commerce & POS**: Integrated retail checkout, Stripe Terminal support, gift card balances, and subscription management.
5. **Marketing Automations**: Event-driven SMS/Email triggers (Birthdays, Win-backs, No-show alerts).
6. **Mobile Platform App**: A single app store binary that dynamically rebrands based on the studio "slug" or QR code binder.
7. **Security & Compliance**: RBAC (Admin, Owner, Instructor, Student), IDOR prevention, CAN-SPAM/TCPA compliant services, and SOC 2-ready audit logging.

## Build-out & Requirements
- **Runtime**: Node.js 18+
- **Commands**:
  - `npm install`: Install dependencies
  - `npm run dev`: Start local development (Turbo-orchestrated)
  - `npm run deploy -w web`: Deploy to Cloudflare Pages
  - `npm run test`: Run playwright and vitest suites

## Development Progress (Recent)
- **Infrastructure**: Fixed major migration issues related to `FOREIGN KEY` constraints and duplicate columns in Drizzle migrations.
- **Enhanced Testing**: Established full API integration test suites for courses and E2E Playwright tests for student/instructor flows.
- **LMS Upgrades**: Redesigned the Course Builder and Student Player for a premium, responsive experience.
- **Unified Roster**: Launched the centralized enrollment management view at `/studio/:slug/roster`.
- **UX Refinement**: Replaced native browser date pickers with a custom **Discrete 3-Column Time Picker** enforcing 5-minute increments across all scheduling forms.
- **Dependency Refresh**: All packages updated to latest stable versions. Stripe SDK upgraded to v20 (API `2026-01-28.clover`). Wrangler at v4. Web migrated to ESLint 10 flat config.
- **POS/Retail Enhancements**: Stripe PaymentIntent ID persisted on orders for terminal refunds; transaction history endpoint (`GET /pos/transactions`) with refund status; customer update (`PUT /pos/customers/:id`); refund-by-PaymentIntent (`POST /pos/refund`); product price changes create new Stripe Price objects. All calls include `X-Tenant-Slug` for tenant resolution.
- **Security Hardening**: Sanitized Stripe search query injection; replaced raw SQL `IN` with `inArray()`; added DOMPurify to all `dangerouslySetInnerHTML` renders; removed debug auth logging; restricted CORS `allowHeaders`; narrowed root health endpoint; added gym_id format validation in Gympass webhook.
- **Performance Improvements**: Eliminated N+1 queries in courses route (5 parallel batch queries + in-memory maps); reduced tenant middleware from 3 sequential DB round-trips to 2 via Drizzle relations.

---

## Recent Changes (Cursor / Gemini Session — Feb 2026, Part 2)

### Memberships Overhaul (research-driven)

**Research basis:** Benchmarked against Glofox/Mindbody best practices — retention-first design, self-service cancellation, trial periods, plan browsing, and archived plan management.

#### API (`packages/api/src/routes/memberships.ts`) — 5 new endpoints
| Endpoint | Description |
|---|---|
| `PATCH /memberships/plans/:id` | Update plan fields (was missing — Edit Plan was silently broken) |
| `DELETE /memberships/plans/:id` | Soft-archive if active subscribers exist, hard-delete otherwise |
| `PATCH /memberships/plans/:id/status` | Toggle active/archived without deleting |
| `GET /memberships/my-active` | Current user's active/trialing subscriptions with full plan detail (was missing — profile always empty) |
| `POST /memberships/subscriptions/:id/cancel` | Cancel at period end via Stripe; students can cancel their own, admins can cancel any |

Also: `GET /memberships/plans` now accepts `?includeArchived=true` for admin views.

#### DB Schema + Migration
- Added `trial_days integer DEFAULT 0` to `membership_plans` table (`packages/db/src/schema.ts`)
- Migration `0072_membership_plans_trial_days.sql`

#### Portal — Student Membership Browser (`portal.$slug.memberships._index.tsx`)
- New route: students can browse all active plans with images, pricing, perks (VOD, trial, cancel-anytime)
- Shows "Current Plan" badge on already-owned plans
- "Start Free Trial" / "Join Now" / "Join Free" CTA routes to studio checkout
- Active membership summary banner at top
- Added **Memberships** nav item to portal sidebar (`portal.$slug.tsx`)

#### Portal Profile Page (`portal.$slug.profile.tsx`)
- Wired "Active Memberships" section to real `GET /memberships/my-active` data (was always empty)
- Added inline **Cancel** button per subscription: two-step confirmation → `POST /memberships/subscriptions/:id/cancel`
- Status badges (Active / Trial / Past Due) with color coding
- Past-due warning banner prompts user to update payment method
- "Browse plans →" link when no active memberships

#### Admin Plan Detail (`studio.$slug.memberships.$planId.tsx`)
- **Archive / Restore** toggle in the dropdown (replaces silent "delete with active subscribers" behavior)
- Fixed "Checkout Link" promotion URL (was broken `/buy/product/:id` → now `/studio/:slug/checkout?planId=:id`)
- Fixed "Product Page" URL (now routes to portal memberships browser)
- Replaced hardcoded "$0 Total Revenue" with **Est. Annual Revenue** computed from subscriber count × plan price × billing frequency

#### Admin Plan List (`studio.$slug.memberships._index.tsx`)
- **"Show Archived" toggle** — loads inactive plans via `?includeArchived=true`; filters locally

#### PlanModal (`apps/web/app/components/PlanModal.tsx`)
- Added **Free Trial (days)** field — `0` disables trial, any positive value enables it
- `trialDays` passed to both create and update payloads

#### Hook (`apps/web/app/hooks/useMemberships.ts`)
- `usePlans()` now accepts `options.includeArchived` — queries `?includeArchived=true` when set
- Added `trialDays?: number` to `Plan` type

---

## Recent Changes (Cursor / Gemini Session — Feb 2026)

### LMS Tier 1–3 Enhancements
- **Quiz Player** (`portal.$slug.courses.$courseSlug.tsx`): Interactive quiz UI — renders questions, captures student answers, submits to `POST /quiz/{id}/submit`, displays score/pass-fail/per-question breakdown and retake option.
- **Assignment Submission & Grading**:
  - `AssignmentSection` component: shows submission status, instructor grade and feedback (sanitized via `SafeHtml`), and a re-submission form.
  - New instructor **Grading tab** in `CourseEditorPage` with filter by status (submitted / graded / all) and a grade + feedback modal (`PATCH /assignments/submissions/:id/grade`).
- **Per-Lesson Completion Tracking**:
  - New `course_item_completions` DB table (`packages/db/src/schema.ts`, migration `0071`).
  - `POST /{courseId}/curriculum/{itemId}/complete` marks individual items complete and recalculates overall progress.
  - `GET /{courseId}/my-completions` returns the student's completed item IDs; "Mark Complete" button on the player is now per-lesson.
- **Course Catalog UX** (`portal.$slug.courses._index.tsx`): client-side search by title/description, enrollment-status filter (All / Enrolled / Not Enrolled), and sort options (A–Z / Price / Progress).
- **Comments Section**: per-lesson comment thread and post form wired to the API.
- **New API routes** (all in `packages/api/src/routes/courses.ts`):
  - `POST /quiz/{id}/submit` — score a student submission
  - `GET /quiz/{id}/my-submission` — fetch latest quiz result
  - `GET /assignments/{id}/my-submission` / `GET /assignments/{id}/submissions` — student & instructor views
  - `GET /{courseId}/all-submissions` — all assignment submissions for a course
  - `PATCH /assignments/submissions/{id}/grade` — instructor grading

### Mobile Typecheck Fix
- Replaced deprecated `color` prop with `stroke` on all `lucide-react-native` icon usages across `apps/mobile`.
- Added `apps/mobile/react-native-svg.d.ts` type stub (peer dependency `react-native-svg` not directly installed); included it in `apps/mobile/tsconfig.json`.

### deploy-web Fix (Cloudflare Worker)
- Removed `isomorphic-dompurify` import from `portal.$slug.courses.$courseSlug.tsx`; replaced all `DOMPurify.sanitize()` calls with a new `SafeHtml` component that dynamically imports `dompurify` inside a `useEffect` (client-only), resolving the `TypeError: Cannot read properties of undefined (reading 'bind')` crash in the Cloudflare Worker SSR environment.

### API Typecheck Fix
- Hono OpenAPI strict response typing on `/assignments/:id/submissions` and `/:courseId/all-submissions` — added explicit `403`/`404` response schemas and loosened inner data types to `z.any()`.

### Schedule / DateTimePicker Fixes
- `DateTimePicker` (`components/ui/DateTimePicker.tsx`):
  - Added `popperProps={{ strategy: "fixed" }}` — calendar no longer clips behind the modal's `overflow-hidden` boundary.
  - Added `.react-datepicker__children-container { width: auto; padding: 0; }` — removes extra whitespace to the right of the time columns.
  - Added `shouldCloseOnSelect={false}` — picker stays open after date selection so the user can also set the time.
- `WeeklyCalendar` (`components/schedule/WeeklyCalendar.tsx`):
  - On first load, auto-advances to the week of the next upcoming event if the current week has no future classes (fixes Saturday-night "class is on Sunday" invisibility).

### Sidebar & Navigation
- Renamed sidebar nav item **"Courses" → "Course Management"** (`routes/studio.$slug.tsx`).

### Membership Plans
- **"No plans found" in Schedule modal**: `studio.$slug.schedule.tsx` was not fetching plans. Added `usePlans(slug!)` and passed result as `plans` prop to `CreateClassModal`.
- **Plan Detail Page** (`studio.$slug.memberships.$planId.tsx`):
  - **Edit Plan**: wired to a pre-populated `PlanModal` with `PATCH /memberships/plans/:id`.
  - **Duplicate**: implemented — POSTs a copy with `" (Copy)"` suffix, previously `disabled`.
  - **Delete**: wired to `ConfirmationDialog` with `DELETE /memberships/plans/:id`.
  - **Preview URL**: fixed from `/portal/{slug}/checkout` (no matching route → System Error) to `/studio/{slug}/checkout?planId=...`.
- **PlanModal extracted** to `apps/web/app/components/PlanModal.tsx` (shared by index + detail pages).

---

## Recent Changes (Cursor Session — Feb 21, 2026)

### Documentation Overhaul

Updated all internal and GitHub-facing docs to reflect the memberships overhaul, LMS Tier 1–3, and all Q1 2026 improvements:

| File | Change |
|---|---|
| `docs/schema_diagram.md` | Full ER diagram rewrite — added `membership_plans` (`active`, `trial_days`), `subscriptions` (`canceled_at`, `dunning_state`, `stripe_subscription_id`), `quiz_questions`, `quiz_submissions`, `assignment_submissions`, `course_item_completions`, `webhook_endpoints`, `webhook_logs`; added performance index table and 3NF compliance notes |
| `docs/architecture.md` | Added **Memberships & Subscriptions** section (plan lifecycle diagram, subscription state flow, trial period docs); added **Course Management (LMS)** section (curriculum flowchart, LMS API table); updated **API Layer Structure** diagram to include `/memberships/*` and `/courses/*`; updated 3NF inline diagram to include new tables; cross-linked to full schema doc |
| `docs/planning/api_blueprint.md` | Expanded **Functional Domains** section with full API tables for `/memberships` (5 new endpoints) and `/courses`/`/quiz`/`/assignments` (8 new endpoints) |
| `docs/features/memberships.md` | **New file** — complete membership system reference: data model, plan lifecycle, subscription state flow, full API reference, Stripe integration, admin and portal UX, `PlanModal` fields, hook API, and migration history |
| `README.md` | Updated features list to include memberships self-service and LMS grading; updated 3NF diagram to include `QUIZ_SUBMISSIONS`, `ASSIGNMENT_SUBMISSIONS`, `COURSE_ITEM_COMPLETIONS`; cross-linked to `docs/schema_diagram.md` |

---

## Design Philosophy
- **Performance First**: Extensive use of `D1.batch()` and SARGable queries to ensure edge speed.
- **Data Isolation**: Strict application-level tenant isolation enforced via middleware.
- **Premium Aesthetics**: High-quality UI using glassmorphism, smooth animations, and curated typography.
- **Regulatory Guardrails**: Direct implementation of compliance logic in base services (Email/SMS).
