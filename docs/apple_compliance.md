# Apple Compliance Audit Report

## Executive Summary
This report analyzes the current mobile app beta against Apple's App Store Review Guidelines.

**Status:** ✅ **Largely Compliant (see notes)**
**Critical Issues:** 0 (Account Deletion implemented)
**Potential Issues:** 1 (Digital Goods/Memberships)

---

## 1. Privacy & Data (Critical)

### 🟢 Account Deletion (Implemented)
**Requirement:** Guideline 5.1.1(v) requires apps that support account creation to also support account deletion *within the app*.
**Current Status:** The mobile `ProfileScreen` includes a **Delete Account** button which:
1. Confirms the action with a destructive confirmation dialog.
2. Calls the backend `DELETE /users/me` endpoint to delete the account.
3. Signs the user out on success.

**Next step (optional hardening):**
- If/when Sign in with Apple is added, ensure the deletion flow also revokes Apple tokens per Apple’s guidance.

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
