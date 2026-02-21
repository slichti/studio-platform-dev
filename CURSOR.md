# CURSOR.md - Project Overview & Status

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

## Design Philosophy
- **Performance First**: Extensive use of `D1.batch()` and SARGable queries to ensure edge speed.
- **Data Isolation**: Strict application-level tenant isolation enforced via middleware.
- **Premium Aesthetics**: High-quality UI using glassmorphism, smooth animations, and curated typography.
- **Regulatory Guardrails**: Direct implementation of compliance logic in base services (Email/SMS).
