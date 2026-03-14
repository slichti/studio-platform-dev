# Memberships & Subscriptions

This document covers the complete membership system — architecture, data model, API surface, and UX flows for both studio admins and students.

## Overview

Studio Platform memberships are Stripe-backed recurring subscriptions. Plans are created by studio owners, synced to Stripe as a Product + Price, and purchased by students via an embedded Stripe Checkout flow. The system is designed around a **retention-first** philosophy: students can self-serve cancel, admins can archive without data loss, and plans with active subscribers are never hard-deleted.

## Member Activation Semantics (Important)

There are **two related but distinct** concepts in the admin UI:

- **Member status** (`tenant_members.status`): `active` / `inactive` / `archived` — controls whether a person can book classes.
- **Membership status** (derived from subscriptions & credits): whether the member currently has an *active subscription* OR *positive credit balance*.

### What should activate a member?

- **Granting a class pack / credits** should set the member to **active**.
- **Starting a membership subscription** should set the member to **active**.

This is enforced in fulfillment, so it applies to both Stripe-backed purchases and internal/manual grants.

### Manual activation (admin)

The student profile includes an **Activate Member** action (uses `PATCH /members/:id/status`) to restore booking access when a member is `inactive`.

---

## Data Model

```
membership_plans
  id               PK
  tenant_id        FK → tenants
  name
  description
  price            integer (cents)  ← price per billing interval (e.g. 12500 = $125 / month)
  currency         default 'usd'
  interval         enum: 'month' | 'year' | 'week'
  interval_count   integer default 1 ← number of intervals in the term (e.g. 3 for a 3‑month membership)
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

## Pricing Semantics

- `price` is always interpreted as **per-interval price** (e.g. `$125 / month`, `$900 / year`).
- `interval_count` controls the **length of the commitment term** without changing the per-interval billing amount.
  - Example: a “3‑Month Membership” would use `interval = 'month'`, `interval_count = 3`, `price = 12500` (i.e. `$125 / month`).
  - The UI shows both **per-month price** and **total over full term** (`price × interval_count`) to avoid confusion.

### Fixed-Term vs Auto-Renewing Memberships

- **Auto‑renew ON** (`autoRenew = true`): standard recurring subscription; Stripe bills each interval indefinitely until canceled.
- **Auto‑renew OFF** with `interval_count > 1`: **fixed-term membership**.
  - We still create a Stripe subscription with `interval_count = 1` on the Stripe Price so billing is per interval.
  - After checkout, a webhook handler sets `cancel_at` for the end of the N‑th period so billing stops automatically after the full term.
  - Example: 3‑month membership at `$125 / month` charges 3 times ($125 each month) and then ends; the student must purchase again to continue.

This keeps billing consistent (per-interval line items) while giving studios “punch card–like” fixed-term memberships.

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

## Notifications & Automations

### Member-Facing Emails

When commerce events occur around memberships and packs, the platform sends **transactional emails** (via `EmailService`) summarizing what the member received:

- **Class Packs**: On purchase or admin-assignment, the member receives an email with pack name, starting credits, remaining balance, and expiry (if any), with a note indicating whether it was bought or assigned.
- **Memberships**: On membership start or admin-assignment, the member receives an email with plan name, billing cadence, and next renewal date, again indicating whether it was bought or assigned.

These emails respect tenant-level notification settings and branding.

### Automation Triggers

Two automation triggers are available for lifecycle marketing and retention flows:

- **`pack_purchased`**
  - Fired from fulfillment whenever a class pack is purchased or admin-assigned.
  - Payload fields (available to automations and templates) include:
    - `packId`, `packName`, `credits`, `expiresAt`, `amount`, `source`, `purchasedPackId`.
- **`membership_started`**
  - Fired when a membership becomes active for a member (whether via web checkout, mobile checkout, or admin assignment).
  - Now includes a `source` field so studios can branch flows based on where the membership originated:
    - `web_checkout`, `mobile_checkout`, or `admin_assignment`.

These triggers are exposed in the Marketing Automations UI and appear with recommended fields for personalization.

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
