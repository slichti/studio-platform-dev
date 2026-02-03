# Retention and Growth Engine Implementation Plan

## Goal Description
Enhance the platform's ability to retain and grow its user base by implementing three key features:
1.  **Churn Automation Link:** Automatically trigger re-engagement campaigns for at-risk members.
2.  **Referral System:** Create a structured referral program where members can refer friends and earn rewards.
3.  **Enhanced Churn Model:** Improve the churn prediction algorithm with more sophisticated heuristics.

## User Review Required
> [!IMPORTANT]
> **Referral Mechanics:** We are assuming a simple "Give X, Get Y" model (e.g., "Give $20, Get $20"). Rewards will be issued as Account Credit (compatible with the `creditValue` or `balance` system if it exists, otherwise we track it).
> **Churn Triggers:** Automations will trigger immediately when a user's risk level changes to 'high' during the daily cron job.

## Proposed Changes

### 1. Link Churn to Automations

#### Schema
- Update `marketing_automations` is already capable, we just need to support `trigger_event = 'churn_risk_high'`.

#### [MODIFY] [churn.ts](file:///Users/slichti/GitHub/studio-platform-dev/packages/api/src/services/churn.ts)
- Modify `updateMemberScore` to detect if risk level increases (e.g., Safe -> High).
- If risk increases, call `automationsService.dispatchTrigger('churn_risk_high', context)`.

#### [MODIFY] [automations.ts](file:///Users/slichti/GitHub/studio-platform-dev/packages/api/src/services/automations.ts)
- Ensure `dispatchTrigger` handles `churn_risk_high`.

---

### 2. Referral System

#### Schema
- **[NEW] `referral_codes`**: Link a unique code to a member.
- **[NEW] `referral_rewards`**: Track successful referrals and rewards status.

#### [NEW] [referrals.ts](file:///Users/slichti/GitHub/studio-platform-dev/packages/api/src/routes/referrals.ts)
- `POST /referrals/generate`: Create/Return a code for the current user.
- `POST /referrals/validate`: Check if a code is valid (for signup).
- `GET /referrals/stats`: Get user's referral stats (count, earnings).

#### [MODIFY] [auth.ts](file:///Users/slichti/GitHub/studio-platform-dev/packages/api/src/routes/auth.ts)
- Update signup flow to accept `referralCode`.
- If valid, store the referral link (pending state).
- After first purchase (or criterion met), award credits to both.

#### [NEW] [ReferralDashboard.tsx](file:///Users/slichti/GitHub/studio-platform-dev/apps/web/app/routes/studio.$slug.profile.referrals.tsx)
- UI for members to see their code and stats.

---

### 3. Enhance Churn Model

#### [MODIFY] [churn.ts](file:///Users/slichti/GitHub/studio-platform-dev/packages/api/src/services/churn.ts)
- Add new factors to `analyzeMemberRisk`:
  - **Booking Cancellations:** High cancellation rate = Risk.
  - **Membership Expiry:** Upcoming expiry = Risk.
  - **Payment Failures:** Recent failures = High Risk.
  - **Class Frequency Slope:** Compare last 30 days vs previous 30 days.

## Verification Plan

### Automated Tests
- **Churn Service:** Unit test `analyzeMemberRisk` with mock data for various scenarios (cancellations, declining attendance).
- **Referral Flow:** Integration test: User A refers User B -> User B signs up -> User B buys pack -> Verify User A gets credit.

### Manual Verification
- **Churn:** Manually manipulate bookings in DB, run analysis, check if Churn Score updates and Automation Log is created.
- **Referrals:** Use the UI to copy a link, incognito signup, and verify credits appear.
