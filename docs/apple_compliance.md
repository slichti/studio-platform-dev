# Apple Compliance Audit Report

## Executive Summary
This report analyzes the current mobile app beta against Apple's App Store Review Guidelines.

**Status:** ⚠️ **Partial Compliance**
**Critical Issues:** 1 (Account Deletion)
**Potential Issues:** 1 (Digital Goods/Memberships)

---

## 1. Privacy & Data (Critical)

### 🔴 Missing Account Deletion
**Requirement:** Guideline 5.1.1(v) requires apps that support account creation to also support account deletion *within the app*.
**Current Status:** The Profile screen allows "Sign Out" but has no "Delete Account" option.
**Remediation:** Implement a "Delete Account" button in `ProfileScreen` or a dedicated Settings screen. This must:
1.  Confirm the action with the user.
2.  Call a backend API to delete the user's data (or schedule it).
3.  Revoke "Sign in with Apple" tokens interaction if applicable.

### 🟢 Data Minimization
**Current Status:** The app collects minimal data (Name, Email for booking). No third-party tracking libraries (Facebook, Google Analytics) were found in `package.json`.
**Action:** Ensure `app.json`/`app.config.ts` does NOT include `NSUserTrackingUsageDescription` unless tracking is added later.

---

## 2. In-App Payments (Guideline 3.1)

### 🟢 Class Packs (Physical Services)
**Requirement:** Payment for services consumed *outside* the app (e.g., gym classes) must use external methods (Stripe, Credit Card) and NOT Apple IAP.
**Current Status:** The app uses Stripe Hosted Checkout.
**Evidence:** Class Details screen includes physical location/maps integration.
**Verdict:** **Compliant**. Ensure App Review notes state: "These purchases are for physical gym access."

### ⚠️ Memberships (Digital vs Physical)
**Requirement:** If a membership unlocks *digital content* within the app (e.g., VOD, pre-recorded classes), it typically requires Apple IAP (30% fee).
**Risk:** The API (`memberships.ts`) includes a `vodEnabled` flag. If this is active for mobile users, Apple may view it as a digital subscription.
**Remediation:**
*   **Option A (Safe):** Ensure the mobile app only unlocks physical access. Do not show standard VOD content if purchased via Stripe.
*   **Option B (Reader/Multi-platform):** If the service is primarily physical, emphasize that in review.

---

## 3. Human Interface Guidelines (UI/UX)

### 🟢 Navigation & Layout
*   **Tabs:** Standard bottom navigation is used.
*   **Safe Area:** `SafeAreaView` is used correctly on screens reviewed.

### 🟡 Recommendations
*   **Sign In with Apple:** If we offer "Sign in with Google" or other social logins, we *must* offer Sign in with Apple. (Currently email/password only? Need to verify `login.tsx`).

---

## Action Plan
1.  **Implement Account Deletion** (High Priority).
2.  **Verify Login Methods** (Check `login.tsx` for social auth).
3.  **Prepare App Review Notes** explaining the physical nature of goods.
