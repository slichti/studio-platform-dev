# CURSOR-GEMINI.md - Studio Platform Overview & Progress

## 🚀 Application Overview
**Studio Platform** is a high-performance multi-tenant SaaS for dance, yoga, and fitness studios. Built for the **Cloudflare Edge**, it delivers sub-50ms latency for global operations while providing a premium, integrated experience for both studio owners and students.

## 🏗️ Architecture & Stack
| Layer | Technology |
|-------|------------|
| **Frontend** | React Router v7 (SSR), TypeScript, TailwindCSS v4 |
| **Backend** | Cloudflare Workers (Edge), Hono Framework |
| **Database** | Cloudflare D1 (SQLite), Drizzle ORM |
| **Real-time** | Cloudflare Durable Objects (WebSockets) |
| **Storage** | Cloudflare R2 & Cloudflare Stream (Video) |
| **Auth** | Clerk |
| **Payments** | Stripe Connect (Multi-tenant) |

## 📦 Monorepo Structure
- `apps/web`: Primary React Router platform app.
- `apps/mobile`: Universal Expo app (binds dynamically to studio slugs).
- `packages/api`: Core business logic service.
- `packages/db`: Schema definitions and migrations.
- `packages/ui`: Shared component library.

## 🔥 Core Features
1. **Studio Management**: Intelligent scheduling, room conflict detection, and instructor payroll.
2. **Advanced LMS (Course Builder)**:
   - **Interactive Player**: Supports Video (Stream/R2), Articles (Rich Text), and Discussions.
   - **Quiz Engine**: Real-time grading, passing score enforcement, and answer breakdowns.
   - **Assignment System**: Student submissions with instructor grading and feedback loop.
   - **Progress Tracking**: Tier 2 per-lesson completion records and course-wide analytics.
3. **Unified Roster**: Centralized management of all students across all services.
4. **Commerce & POS**: Retail checkout, gift card balances, and subscription dunning.
5. **Marketing Automations**: Event-driven SMS/Email triggers (Twilio/Resend).

## 🛠️ Build & Development
- **Install**: `npm install`
- **Dev**: `npm run dev` (Turbo-orchestrated)
- **Deploy**: `npm run deploy -w web` (Cloudflare Pages)
- **Database**: `npx wrangler d1 migrations apply studio-db --local`

## 📈 Recent Progress (Feb 2026)

### Session 1 — LMS v2 + UI
- **LMS v2 Launch**:
  - Implemented the `courseItemCompletions` system for atomic lesson tracking.
  - Added full **Quiz Submission** logic with automated scoring.
  - Launched **Assignment Grading** tab in Course Editor with feedback capability.
  - Added **Lesson Discussions** (Comments) with batch-fetching optimizations to eliminate N+1 API patterns.
- **UI/UX Refinements**:
  - **Discrete Time Picker**: Custom 3-column selection (Hour/Min/AM-PM) with strict 5-minute increments.
  - **Compact Design System**: Reduced padding and gaps in scheduling modals for better visibility.
  - **Sidebar Overhaul**: Improved navigation for "Course Management" and operations.
- **Documentation**: Updated `schema_diagram.md`, `architecture.md`, `api_blueprint.md`, `README.md`. Created `docs/features/memberships.md`.

### Session 2 — RBAC & Security Hardening
- **Deep capability audit** of 92+ API routes and 8+ portal pages identified **34 permission bugs**.
- **Fixed bugs across 8 route files**: `courses.ts` (14 guards), `analytics.ts` (3), `audit-logs.ts` (1), `tags.ts` (6 including IDOR), `custom-fields.ts` (3 including IDOR), `tasks.ts` (4, fixed missing `can()`), `import.ts` (1, fixed missing `can()`).
- **Portal security**: Enforced tenant membership check in `portal.$slug.tsx`; replaced hardcoded stats in `portal.$slug.profile.tsx` with live API data.

### Session 3 — Student Portal Gaps
- **New API endpoints**:
  - `GET /bookings/history` — past bookings paginated, SQL-filtered by `startTime < unixepoch()`
  - `GET /members/me/packs` — purchased class packs with `remainingCredits` and definition details
  - `PATCH /users/me` — update `firstName`, `lastName`, `phone`, `bio` in profile JSON
- **New portal pages**:
  - `portal.$slug.history` — class attendance history grouped by month with Attended/Cancelled/Waitlisted badges
  - `portal.$slug.packs` — credit summary, per-pack progress bars, available packs to purchase
- **Profile editing**: Inline edit form in `portal.$slug.profile` with save/cancel via `PATCH /users/me`
- **Portal nav updated**: Added "Class History" and "My Packs" items to sidebar and mobile menu

## 🎯 Design Philosophy
- **Edge Native**: Minimize round-trips via `D1.batch()` and SARGable queries.
- **Brand Dynamic**: Single mobile binary and web shell that rebrands on-the-fly via tenant metadata.
- **Compliance First**: Integrated CAN-SPAM and TCPA guardrails in core communication services.

---

## 🔐 RBAC & Security Hardening (Feb 2026 — Session 2)

### Comprehensive Capability Audit
Audited all 92+ API routes and 8+ portal UI routes for improper student/customer access. **34 permission bugs identified and fixed.**

### Student Capability Matrix (what students CAN do)
| Domain | Allowed |
|--------|---------|
| Classes | Book, cancel own booking, view schedule |
| Courses | Enroll, complete lessons, submit quizzes/assignments |
| Memberships | View plans, subscribe, cancel own subscription |
| Commerce | Purchase packs, validate gift cards |
| Profile | View own profile (name, email, streak, history) |
| Bookings | View upcoming, view history, cancel own |
| Family | Add/switch family profiles |

### What Students Cannot Do (enforced via `can()` guards)
- Create/edit/delete courses, modules, curriculum items
- Access studio analytics (`view_reports`)
- View audit logs (`manage_settings`)
- Create/modify/delete tags or read tag assignments on arbitrary entities (`manage_members`)
- Create custom field definitions or read arbitrary field values (`manage_members`)
- Create/modify/delete CRM tasks or read all tasks (`manage_marketing`)
- Bulk import members/subscriptions (`manage_members`)

### Fixed Bugs by Category
- **courses.ts**: 14 mutation + analytics routes now require `manage_courses`
- **analytics.ts**: 3 report routes now require `view_reports`
- **audit-logs.ts**: GET / now requires `manage_settings`
- **tags.ts**: 6 routes (CRUD + assign/unassign + targetId IDOR) now require `manage_members`
- **custom-fields.ts**: 3 routes (create def, upsert values, IDOR read) now require `manage_members`
- **tasks.ts**: Fixed local `Variables` type (missing `can`), 3 mutation routes + GET / unless `?mine=true` require `manage_marketing`
- **import.ts**: Fixed local `Variables` type, POST /csv requires `manage_members`
- **portal.$slug.tsx**: Enforced tenant membership check — non-members redirected to `/studio/:slug/join`
- **portal.$slug.profile.tsx**: Replaced hardcoded stats with live API data

---

## 📱 Student Portal Gaps Resolved (Feb 2026 — Session 3)

### New API Endpoints
| Endpoint | Description |
|----------|-------------|
| `GET /bookings/history` | Past bookings for current member, paginated, filtered by `startTime < now()` |
| `GET /members/me/packs` | Student's purchased class packs with remaining credits and definition details |
| `PATCH /users/me` | Update displayable profile fields: `firstName`, `lastName`, `phone`, `bio` |

### New Portal Pages
| Route | Description |
|-------|-------------|
| `portal.$slug.history` | Paginated past class attendance, grouped by month, with status badges (Attended/Cancelled/Waitlisted) |
| `portal.$slug.packs` | Credit summary banner, active pack progress bars, used/expired pack history, available packs to purchase |

### Updated Portal Pages
- **`portal.$slug.profile.tsx`**: Added inline edit form (firstName, lastName, phone) with `PATCH /users/me` via `useFetcher`. Save/Cancel toggle, success confirmation.
- **`portal.$slug.tsx`**: Added "Class History" and "My Packs" nav items with `History` and `Package` icons.

### Confirmed Public (No Auth Required)
- `GET /appointments/services` — for public booking widgets
- `GET /appointments/availability` — for public scheduling embeds
- `GET /gift-cards/validate/:code` — for public checkout gift card validation

### TypeScript Fix
- `tags.ts` `GET /assignments/:targetId`: Changed `403 as any` to `c.json(..., 403) as any` to correctly suppress Hono OpenAPI strict response union type error.

---

## 🎯 Tier 1 Feature Completion (Feb 2026 — Session 4)

All five Tier 1 items from the prior recommendation backlog have been completed.

### 1. Dynamic Portal Dashboard
**File**: `apps/web/app/routes/portal.$slug._index.tsx`

- Loader now fetches `GET /community?type=announcement&limit=3` and `GET /bookings/my-upcoming` in parallel.
- **Next Class widget**: Highlights the student's nearest confirmed upcoming class (title, date/time, instructor). Falls back to "No upcoming classes" with a booking prompt.
- **Live Announcements**: Renders studio-authored posts of type `announcement` from the community feed. Shows pinned badge, content, and creation date.
- Removed all hardcoded placeholder content (Summer schedule copy, Power Yoga promo, etc.).
- Imports: `date-fns/format`, `Calendar`, `Megaphone`, `CalendarX`, `ChevronRight` from lucide-react.

**API**: `packages/api/src/routes/community.ts`
- Added optional `?type=` query parameter to `GET /community` (values: `post|announcement|event|photo`).
- Added optional `?limit=` parameter (default 50, max 100).

### 2. Waitlist Join Button
**File**: `apps/web/app/routes/portal.$slug.classes.tsx`

- Added `join-waitlist` and `leave-waitlist` action intents, each calling `POST /bookings/waitlist` and `DELETE /bookings/:id` respectively.
- Class card UI now has three states beyond "Booked":
  - **Waitlisted**: Shows position badge (e.g., "#3 Waitlist") with "Leave Waitlist" link.
  - **Full class**: Shows amber "Join Waitlist" button (was previously a non-interactive "Waitlist Available" label).
  - **Available**: Standard "Book Class" button unchanged.
- Added `isWaitlisted()` helper and `Clock3` icon.

**API**: `packages/api/src/routes/bookings.ts`
- New `POST /bookings/waitlist` endpoint: verifies membership, checks no duplicate booking, counts current waitlist length, inserts `status: 'waitlisted'` booking with sequential `waitlistPosition`.

### 3. Student Billing History
**File**: `apps/web/app/routes/portal.$slug.memberships._index.tsx`

- Loader now fetches `GET /commerce/invoices` alongside plans and active memberships.
- Added **Billing History** section at the bottom of the memberships page.
- Each invoice row shows: description, date, invoice number, formatted currency amount (color-coded by status: paid/open/uncollectible), and a PDF download link.
- Uses `date-fns/format`; added `Receipt`, `Download` icons.

### 4. Notification Preferences UI
**File**: `apps/web/app/routes/portal.$slug.profile.tsx`

- Loader now fetches `GET /members/me` to obtain `member.settings.notifications`.
- New **"update-notifications"** action intent: reads `notif_*` checkbox fields from `FormData`, maps them to `{ email_bookings, email_reminders, sms_reminders, email_promotions }`, and calls `PATCH /members/me/settings`.
- Added **Notification Preferences** section before the Policies section, with a styled toggle-row for each notification type and a "Save Preferences" button (via `useFetcher`).
- Added `Bell` icon import.

### 5. Integration TODOs — Mailchimp & Google Calendar
**File**: `packages/api/src/routes/integrations.ts`

**Mailchimp** (`POST /integrations/mailchimp/sync-members`):
- Reads `tenant.mailchimpCredentials` (`{ apiKey, listId, serverPrefix }`).
- Derives the Mailchimp data center from the API key suffix (e.g., `abc123-us10` → `us10`).
- Fetches all active tenant members with email + profile.
- Submits a batch `PUT` operation to the Mailchimp `/3.0/batches` API, upserting each member by email MD5 hash with `FNAME`/`LNAME` merge fields.
- Updates `settings.integrations.mailchimp.lastSyncAt` on success.
- Returns `{ success, synced, batchId }`.

**Google Calendar** (`POST /integrations/google-calendar/export`):
- Reads `tenant.googleCalendarCredentials` (encrypted JSON: `{ accessToken, refreshToken, expiryDate }`).
- Decrypts credentials using `EncryptionUtils`.
- Refreshes the access token (via `GoogleCalendarService.refreshAccessToken`) if within 60 seconds of expiry, and persists the new token.
- Fetches all upcoming classes (next 30 days) from D1.
- Creates a Google Calendar event for each class (title, description, ISO 8601 start/end times in UTC).
- Updates `settings.integrations.google_calendar.lastExportAt`.
- Returns `{ success, exported, total }`.

**Generic provider sync** (`POST /integrations/:provider/sync`):
- Replaces the "coming soon" stub with a redirect to the provider-specific endpoint (`mailchimp` → sync-members, `google_calendar` → export).

### Imports Added
- `EncryptionUtils` added to `integrations.ts`.
- `gte` added to drizzle-orm imports in `integrations.ts`.
- `format` (date-fns) added to dashboard index and memberships pages.
- `Receipt`, `Download`, `Bell`, `Clock3`, `Megaphone`, `CalendarX`, `ChevronRight` icons added to portal pages.
