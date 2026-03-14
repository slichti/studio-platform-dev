# Member Tags — Refined Plan

This document refines the member-tags feature with **platform enablement**, **tenant enablement**, **admin and tenant management sections**, and **tag-restricted registration** (e.g. Silver Sneakers–only classes).

---

## 1. Enablement Model

### 1.1 Platform enablement

- **Mechanism**: Use the existing **platform config** table (`platform_config`).
- **Key**: `feature_tags` (consistent with `feature_community`, `feature_chat`, `feature_mobile_app`, etc.).
- **Behavior**:
  - When `feature_tags` is **enabled** in platform config:
    - The **Admin portal** shows the **Member Tags** section (see §3).
    - Tenants are **allowed** to have the tags feature turned on (tenant-level enablement).
  - When `feature_tags` is **disabled**:
    - Admin **Member Tags** section is hidden (or shown as “Tags feature is disabled”).
    - No tenant can use tags; any tenant-level `tags` feature is ignored by the app.

- **Implementation note**: Admin layout already filters nav by `loaderData.configs` (keys where `enabled === true`). Add a nav item for **Member Tags** with `featureKey: "feature_tags"` so it only appears when the platform has tags enabled.

### 1.2 Tenant-specific enablement

- **Mechanism**: Use the existing **tenant features** table (`tenant_features`).
- **Feature key**: `tags` (e.g. `tenantFeatures.featureKey === 'tags'`).
- **Behavior**:
  - When **platform** `feature_tags` is **off**: tenant `tags` is ignored everywhere.
  - When **platform** `feature_tags` is **on** and **tenant** `tags` is **enabled**:
    - Studio sidebar shows the **Tags** entry under Management (or Settings) for that tenant.
    - Tenant can access **Tags** management and tag-restricted classes.
  - When **platform** `feature_tags` is **on** but **tenant** `tags` is **disabled**:
    - No Tags UI for that tenant; no tag-based discounts or restrictions apply.

- **Who can enable for a tenant**:
  - **Platform admins**: In Admin → Member Tags (or Tenants detail), toggle “Tags” for the tenant (same pattern as other tenant features).
  - **Optional self-service**: Add `tags` to the allowlist in `studioApp.post('/features')` so owners/admins can enable it from Studio → Settings → Add-ons/Features, if desired.

---

## 2. Data Model (summary)

- **Tags** (per tenant):
  - Table: `tags` (or reuse/extend existing “tags” if present).
  - Columns: `id`, `tenantId`, `slug`, `label`, `description`, `category` (e.g. `pricing`, `access`, `marketing`), `discountType` (`percent` | `fixed` | `none`), `discountValue`, `appliesToProducts` (e.g. `drop_ins`, `packs`, `memberships`, `all`), `visibility` (`internal_only` | `visible_to_member`), `createdAt`, `updatedAt`.

- **Member–tag assignment**:
  - Table: `member_tags` (pivot).
  - Columns: `id`, `memberId` (tenantMembers.id), `tagId`, `source` (`manual`, `rule`, `import`), `createdAt`, `createdBy` (optional).

- **Tag-restricted classes**:
  - Option A: Add to `classes` table a column `requiredTagIds` (JSON array of tag IDs). Only members who have **at least one** of these tags can register.
  - Option B: New table `class_required_tags` (`classId`, `tagId`) with unique constraint on (`classId`, `tagId`). Prefer Option B for normalized queries and future indexing; Option A is acceptable for a first iteration if schema changes are minimal.

- **Tag-restricted events** (if events are a separate entity): Same idea — `eventId` + `tagId` pivot or `requiredTagIds` on the event table.

---

## 3. Admin Portal — New Section: Member Tags

- **Route**: `/admin/tags` (or `/admin/member-tags`).
- **Visibility**: Only when platform config `feature_tags` is enabled (nav item with `featureKey: "feature_tags"`).
- **Content**:
  1. **Platform toggle**
     - Card/section: “Member Tags feature” with toggle bound to `platformConfig.feature_tags` (PUT `/admin/platform/config/feature_tags`). When off, show short copy: “Enable to allow tenants to use member tags, discounts, and tag-restricted classes.”
  2. **Tenant enablement**
     - List of tenants with a column “Tags” (or “Member tags”): per-tenant toggle to enable/disable the **tenant** feature `tags` (POST to existing admin tenant-features API, e.g. `/admin/tenants/:id/features` with `featureKey: 'tags'`, `enabled: true/false`). Only show this when platform `feature_tags` is on.
  3. **Optional: Tag template library**
     - Platform-level “tag templates” (name, suggested slug, category, typical discount) that tenants can clone into their own catalog. Can be Phase 2.

- **Implementation**: New admin route `admin.tags.tsx` (loader fetches platform config and tenant list + tenant features); new API route under admin if needed (e.g. bulk enable/disable tags per tenant), or reuse existing platform config and tenant features endpoints. The implemented version also surfaces a **read‑only default tag set** (New Member, VIP, Senior, Silver Sneakers, Trial, Instructor) that is automatically created in each tenant (see §8).

---

## 4. Tenant (Studio) — New Section: Tags

- **Placement**: New section **Tags** under **Management** (or under **Settings**, depending on IA preference). Same sidebar group as “Tags & Fields” is acceptable, but “Tags” here is the **member** tag catalog and assignment; “Tags & Fields” can remain for custom fields/labels if different.
- **Route**: `/studio/:slug/settings/member-tags` (recommended) or `/studio/:slug/tags`. Use a distinct path from the existing **Tags & Fields** (`/studio/:slug/settings/tags-fields`), which is for custom fields/labels, not member tags.
- **Visibility**: Only when **platform** `feature_tags` is on **and** **tenant** feature `tags` is on (`featureSet.has('tags')` in studio layout).
- **Content**:
  1. **Tag catalog**
     - List of tags for this tenant. Actions: Create, Edit, Delete (soft-delete or hard depending on usage).
     - Form fields: Label, Slug, Category, Description; **Discount**: type (percent / fixed / none), value; **Applies to products** (drop-ins, packs, memberships, all); **Visibility** (internal only vs visible to member).
  2. **Assign tags to members**
     - Either inline in this page (e.g. “Members with this tag” with multi-select member list) or, preferably, **on the member profile** (People → [Member] → Tags chips + Add/Remove). API: GET/PUT `members/:id/tags` or PATCH `members/:id` with `tagIds`.
  3. **Tag-restricted classes**
     - In **Class creation/editing** (schedule or class form): optional section “Eligibility” with multi-select **Required tags**. If at least one tag is selected, only members who have **at least one** of these tags can register. Others cannot register (and optionally the class is hidden or shown as “Not eligible” in public/portal). See §5.

- **Settings (discount, etc.)**: Stored on the **tag** record (`discountType`, `discountValue`, `appliesToProducts`). No separate “tag settings” page is strictly necessary; tag edit form holds these. Optional: tenant-level “Tag settings” for defaults (e.g. “Max one discount tag per transaction”) in `tenant.settings.tags` if needed later.

---

## 5. Tag-Restricted Registration (e.g. Silver Sneakers, 65+)

- **Requirement**: Some classes (or events) are **only** for members with a specific tag (e.g. “Silver Sneakers”, “65+”). Others **cannot** register for those classes.

- **Model**:
  - Each **class** (and optionally event) has a set of **required tags** (`requiredTagIds` or `class_required_tags`). If the set is **non-empty**:
    - A member can **register** only if they have **at least one** of those tags.
    - If the member has none of the required tags, registration is **forbidden** (API returns 403 with a clear message, e.g. “This class is only available to members with Silver Sneakers (or 65+) eligibility.”).

- **API (booking/registration)**:
  - Before creating a booking (or adding to waitlist), check:
    1. Class has `requiredTagIds` (or join to `class_required_tags`).
    2. If yes, load member’s tags (`member_tags` for this `memberId`).
    3. If member has no tag in `requiredTagIds`, return **403** with a body like `{ error: "Not eligible to register", code: "TAG_REQUIRED", requiredTags: [ { id, label } ] }`.
  - Same rule for **waitlist** sign-up and any other “register for this class” path.

- **Public/portal schedule**:
  - **Option A (recommended)**: Show tag-restricted classes to everyone, but:
    - If the current user (member) **has** one of the required tags: show “Register” / “Book” as usual.
    - If the current user **does not** have any required tag: show class as “Not eligible” or “Silver Sneakers only” and **disable** the register button; tooltip or copy explains eligibility.
  - **Option B**: Hide tag-restricted classes entirely for members who don’t have the tag (simpler but less transparent).
  - **Guest/unauthenticated**: Either hide tag-restricted classes or show them with “Sign in to check eligibility” / “Silver Sneakers only”.

- **Studio (staff) schedule**:
  - Show all classes; when creating/editing a class, staff can set “Required tags”. Staff booking on behalf of a member should be subject to the same eligibility check (403 if member lacks required tag), with optional override permission for admins (e.g. “Allow override: tag required”) if desired later.

---

## 6. Implementation Checklist (high level)

- [ ] **Platform**: Add `feature_tags` to platform config (admin can enable/disable). Add Admin nav item “Member Tags” with `featureKey: "feature_tags"`.
- [ ] **Tenant**: Add `tags` to tenant features (enable per tenant when platform allows). In studio sidebar, show “Tags” under Management when `featureSet.has('tags')`.
- [ ] **Admin section**: New route `/admin/tags` — platform toggle, tenant enablement list, (optional) tag template library.
- [ ] **Tenant section**: New route `/studio/:slug/settings/tags` (or `/studio/:slug/tags`) — tag catalog (CRUD), discount settings, link to member assignment (or inline).
- [ ] **Member assignment**: API and UI to attach/detach tags to/from members (e.g. on member profile).
- [ ] **Schema**: `tags` table, `member_tags` pivot, and either `classes.requiredTagIds` or `class_required_tags` (+ same for events if applicable).
- [ ] **Booking/registration**: In classes (and events) booking flow, enforce “required tags” check; return 403 with `TAG_REQUIRED` when member is not eligible.
- [ ] **Schedule/portal UI**: Show tag-restricted classes with eligibility state (eligible vs not eligible) and disable register when not eligible.
- [ ] **Pricing**: At checkout, apply tag-based discounts (best single tag or controlled stacking) when tags feature is enabled for the tenant.

---

## 7. Default Tag Set (Implemented)

To reduce setup friction, the platform seeds a **default tag catalog** for every tenant as soon as tags are enabled or the first tag list is requested:

- **New Member** — general onboarding and welcomes.
- **VIP** — loyal / high‑value members.
- **Senior** — age-based programs (e.g. 65+).
- **Silver Sneakers** — insurance‑driven programs (e.g. SilverSneakers®).
- **Trial** — students in a trial window.
- **Instructor** — staff/instructors where it is useful to treat them as members.

Details:

- Defaults are created by `ensureDefaultTagsForTenant(db, tenantId)` in `packages/api/src/utils/defaultTags.ts`.
- The helper is invoked:
  - After tenant creation (admin + onboarding flows).
  - From the tags list endpoint so **existing tenants** are backfilled the first time they open Tags.
- The function is **idempotent**: it checks existing tag slugs and only creates missing defaults, so tenants can safely rename or delete defaults without duplicates.

Studios can extend this catalog with additional tags (e.g. “Teachers”, “Corporate Partner”) without affecting the default behavior.

---

## 8. References

- Platform config: `packages/api/src/routes/admin.config.ts`, `platform_config` in `packages/db/src/schema.ts`.
- Admin nav: `apps/web/app/routes/admin.tsx` (filter by `featureKey`).
- Tenant features: `tenant_features` table, `packages/api/src/routes/admin.features.ts`, `studioApp.post('/features')` in `packages/api/src/index.ts`.
- Default tags + helper: `packages/api/src/utils/defaultTags.ts` and `packages/api/src/routes/tags.ts`.
- Studio sidebar: `apps/web/app/routes/studio.$slug.tsx` (`featureSet`, sidebar items).
- Existing “Tags & Fields” (if present): keep distinct from **member tags**; this plan is about tags that apply to **members** and drive discounts and **class eligibility**.
