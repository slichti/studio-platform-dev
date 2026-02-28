# Memberships & Subscriptions

This document covers the complete membership system — architecture, data model, API surface, and UX flows for both studio admins and students.

## Overview

Studio Platform memberships are Stripe-backed recurring subscriptions. Plans are created by studio owners, synced to Stripe as a Product + Price, and purchased by students via an embedded Stripe Checkout flow. The system is designed around a **retention-first** philosophy: students can self-serve cancel, admins can archive without data loss, and plans with active subscribers are never hard-deleted.

---

## Data Model

```
membership_plans
  id               PK
  tenant_id        FK → tenants
  name
  description
  price            integer (cents)
  currency         default 'usd'
  interval         enum: 'month' | 'year' | 'week'
  image_url
  image_library       JSON  ← Image library for rotation/scheduling
  overlay_title
  overlay_subtitle
  vod_enabled      boolean
  trial_days       integer  default 0   ← Added Feb 2026
  active           boolean  default true
  stripe_product_id
  stripe_price_id
  created_at
  updated_at

subscriptions
  id               PK
  user_id          FK → users
  tenant_id        FK → tenants
  member_id        FK → tenant_members
  plan_id          FK → membership_plans
  status           enum: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete'
  current_period_end
  stripe_subscription_id
  canceled_at
  dunning_state    enum: 'none' | 'email_1' | 'email_2' | 'sms'
  last_dunning_at
  created_at
```

---

## Plan Lifecycle

```
Created → active (purchasable) → archived (hidden, subs intact) → restored → active
                                ↘ hard-deleted (only if no subs)
```

| Admin Action | Has Active Subs? | Result |
|---|---|---|
| `DELETE /plans/:id` | Yes | Soft-archives (`active = false`) |
| `DELETE /plans/:id` | No | Hard-deletes row + Stripe product |
| `PATCH /plans/:id/status` | Any | Toggles `active` without deleting |

---

## Subscription Status Flow

```
incomplete
    ↓  (payment succeeds)
trialing  ←→  active
    ↓              ↓ (payment fails)
active         past_due
    ↓  (cancel)    ↓ (dunning expires or user cancels)
canceled       canceled
```

Updates arrive via **Stripe webhook** (`/webhooks/stripe`) — the platform does not poll Stripe for subscription status.

---

## API Reference

All endpoints require the `X-Tenant-Slug` header and Clerk authentication.

### Plans

| Method | Path | Min Role | Description |
|---|---|---|---|
| `GET` | `/memberships/plans` | Any | List active plans. Accepts `?includeArchived=true` (admin only). |
| `POST` | `/memberships/plans` | Owner | Create plan. Creates Stripe Product + Price. |
| `PATCH` | `/memberships/plans/:id` | Owner | Update name, description, trial days. |
| `DELETE` | `/memberships/plans/:id` | Owner | Soft-archive (active subs) or hard-delete. |
| `PATCH` | `/memberships/plans/:id/status` | Owner | Toggle `active` (archive / restore). |

### Subscriptions

| Method | Path | Min Role | Description |
|---|---|---|---|
| `GET` | `/memberships/my-active` | Student | Caller's active / trialing / past-due subs with full plan detail. |
| `POST` | `/memberships/subscriptions/:id/cancel` | Owner or subscriber | Cancel at period end via `Stripe.subscriptions.update({ cancel_at_period_end: true })`. |

---

## Stripe Integration

### Creating a Plan
1. `POST /memberships/plans` → `StripeService.createProduct(name)` → `StripeService.createPrice(productId, amount, currency, interval)`
2. `stripe_product_id` and `stripe_price_id` stored on the plan.

### Free Trials
Plans with `trial_days > 0` pass `subscription_data: { trial_period_days: plan.trialDays }` to Stripe Checkout. Stripe automatically creates the subscription in `trialing` status.

### Cancellation
`POST /memberships/subscriptions/:id/cancel` calls `stripe.subscriptions.update(stripeSubId, { cancel_at_period_end: true })`, then sets `canceled_at = now()` in the DB. The subscription remains `active` until `current_period_end`.

---

## Frontend (Admin)

### Plan List — `/studio/:slug/memberships`
- Lists all active plans; **"Show Archived"** toggle fetches `?includeArchived=true`.
- **Create Plan** opens `PlanModal` with image upload, pricing, trial days, VOD toggle.

### Plan Detail — `/studio/:slug/memberships/:planId`
- **Edit Plan**: opens pre-populated `PlanModal` → `PATCH /memberships/plans/:id`.
- **Duplicate**: POSTs a copy with `" (Copy)"` suffix.
- **Archive / Restore**: in dropdown → `PATCH /memberships/plans/:id/status`.
- **Delete**: confirmation dialog → `DELETE /memberships/plans/:id`.
- **Est. Annual Revenue**: computed from active subscriber count × price × billing frequency (no Stripe revenue API call required).
- Promotion links: **Checkout Link** → `/studio/:slug/checkout?planId=:id`, **Product Page** → `/portal/:slug/memberships`.

---

## Frontend (Portal / Student)

### Plan Browser — `/portal/:slug/memberships`
- Fetches all active plans + caller's current subscriptions.
- Plan cards display: image, name, price/interval, VOD badge, trial badge, "Cancel Anytime" badge.
- **Current Plan** badge on already-owned plans.
- CTA buttons: "Start Free Trial" (trial_days > 0), "Join Free" (price = 0), "Join Now" (paid).
- Active membership summary banner at top of page.

### Profile — `/portal/:slug/profile`
- "Active Memberships" section wired to real `GET /memberships/my-active`.
- Status badges: **Active** (green), **Trial** (blue), **Past Due** (red).
- Past-due warning banner with link to update payment method.
- Per-subscription **Cancel** button: two-step confirmation → `POST /memberships/subscriptions/:id/cancel`.
- "Browse plans →" link when no active memberships.

---

## PlanModal Component

`apps/web/app/components/PlanModal.tsx` is shared by both the plan list and plan detail pages.

| Field | Notes |
|---|---|
| Name | Required |
| Description | Optional |
| Price | Cents; `0` = free plan |
| Interval | month / year / week |
| Free Trial (days) | `0` disables trial |
| VOD Access | Boolean toggle |
| Image | Uploaded via `CardCreator` (600×450px, 4:3) → R2 |
| Image Library | Multiple images with scheduling for seasonal rotation |
| Overlay Title / Subtitle | Displayed on card image |

---

## Hook — `useMemberships.ts`

```ts
// Fetch active plans (student/public)
const { data: plans } = usePlans(slug);

// Fetch all plans including archived (admin)
const { data: plans } = usePlans(slug, { includeArchived: true });

// Fetch caller's active subscriptions
const { data: subs } = useActiveSubscriptions(slug);
```

`Plan` type includes: `id`, `name`, `description`, `price`, `currency`, `interval`, `imageUrl`, `imageLibrary`, `vodEnabled`, `trialDays`, `active`, `stripeProductId`, `stripePriceId`.

---

## DB Migration History

| Migration | Description |
|---|---|
| `0060_create_membership_plans.sql` | Initial `membership_plans` + `subscriptions` tables |
| `0072_membership_plans_trial_days.sql` | `ALTER TABLE membership_plans ADD COLUMN trial_days integer DEFAULT 0` |
