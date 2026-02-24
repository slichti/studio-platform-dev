# Enhancements Verification

## 1. Onboarding Wizard Enhancements

### Logo Upload
- **Goal**: Allow users to upload their studio logo during onboarding.
- **Verification**:
    - Checked `studio.$slug.onboarding.tsx`.
    - Added `Logo Upload` to Step 2 (Branding).
    - Uses `handleLogoUpload` to upload to R2/Cloudflare.
    - Submits `logoUrl` to backend which saves it to `tenant.branding.logoUrl`.

### Team Invites
- **Goal**: Allow users to invite members during onboarding.
- **Verification**:
    - Added Step 5 "Team Invites" to `studio.$slug.onboarding.tsx`.
    - UI supports multiple email inputs.
    - Backend action iterates through emails and calls `POST /members` to invite them as 'instructors'.
    - Uses `Promise.all` to handle multiple invites parallelly.

## 2. Admin Tool Enhancements

### Impersonation
- **Goal**: Allow admins to log in as tenant owners.
- **Verification**:
    - Added `POST /tenants/:id/impersonate` to `admin.ts` API.
    - Generates signed JWT with `impersonatorId`.
    - Added "Login" button to Admin Tenant List.
    - Validated `auth.ts` middleware (from initial step) supports `IMPERSONATION_SECRET`.

### System Notifications
- **Goal**: Allow admins to send messages to tenants.
- **Verification**:
    - Added `POST /tenants/:id/notify` to `admin.ts`.
    - Sends an email via `EmailService` to the tenant owner.
    - Added "Notify" button (Bell icon) and Modal to Admin Tenant List.
    - Logs action in `auditLogs`.

## 3. SEO Content Automation (Tier 7)

### AI Local Blogging
- **Goal**: Automate local blogging for tenants via Gemini AI.
- **Verification**:
    - Implemented `GeminiService` for localized content generation.
    - Created `portal.$slug.blog` (Student Portal) for private engagement.
    - Created `site.$slug.blog` (Marketing Site) for public-facing SEO.
    - Integrated "Recent Insights" section in the mobile app Home Screen.
    - Updated `packages/api/src/routes/sitemap.ts` to include automated blog posts.
    - Injected `BlogPosting` JSON-LD schema for search engine discovery.

## Manual Testing Guide

### Onboarding
1. Create a new tenant.
2. Advance to Step 2.
3. Upload a Logo image. Verify it appears.
4. Advance to Step 5.
5. Add 2 email addresses.
6. Click "Send Invites".
7. Verify emails received or members created in `Admin > Users` or `Studio > Staff`.

### Admin
1. Go to `/admin/tenants`.
2. Click the "User/Log In" icon on a tenant row.
3. Confirm dialogue.
4. Verify you are redirected to the tenant's dashboard as the owner.
5. Go back to Admin.
6. Click the "Bell" icon on a tenant row.
7. Enter a message and send.
8. Verify "Success" toast appears.

> [!NOTE]
> Ensure `IMPERSONATION_SECRET` is set in environment variables for Impersonation to work securely.
