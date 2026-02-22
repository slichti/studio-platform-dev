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
- **LMS v2 Launch**:
  - Implemented the `courseItemCompletions` system for atomic lesson tracking.
  - Added full **Quiz Submission** logic with automated scoring.
  - Launched **Assignment Grading** tab in Course Editor with feedback capability.
  - Added **Lesson Discussions** (Comments) with batch-fetching optimizations to eliminate N+1 API patterns.
- **UI/UX Refinements**:
  - **Discrete Time Picker**: Custom 3-column selection (Hour/Min/AM-PM) with strict 5-minute increments.
  - **Compact Design System**: Reduced padding and gaps in scheduling modals for better visibility.
  - **Sidebar Overhaul**: Improved navigation for "Course Management" and operations.
- **Infrastructure**:
  - Stabilized D1 migrations involving complex `FOREIGN KEY` constraints.
  - Overhauled `schema_diagram.md` to reflect the latest membership (Trial Days) and LMS tracking entities.

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
