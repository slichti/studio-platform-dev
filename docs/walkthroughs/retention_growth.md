# Retention and Growth Engine Walkthrough

I have successfully implemented the Retention & Growth Engine enhancements. This includes a complete Referral System and advanced Churn Prevention logic.

## 1. Referral System

A "Give $20, Get $20" referral program is now available for all members.

### Features
- **Unique Referral Links**: Each member gets a permalink (e.g. `studio.com/demo/join?ref=ABC-123`).
- **Dashboard**: A new "Refer & Earn" page in the Commerce section allows members to copy their link and track stats.
- **Rewards Tracking**: The system tracks clicks, signups, and earnings.
- **Prevention**: Self-referrals are blocked.

### How to Test
1. **Navigate**: Go to `Commerce > Refer & Earn` in the sidebar.
2. **Copy Link**: Click the copy button for your unique link.
3. **Simulate Signup**: Use the link in an Incognito window to sign up a new user.
4. **Verify**: Check the dashboard again to see "Friends Referred" increment.

### API Routes
- `GET /referrals/stats`: Fetches code and dashboard stats.
- `POST /referrals/apply`: applying a code (backend logic ready for signup form integration).
- `POST /referrals/validate`: Validates a code during signup.

## 2. Active Churn Prevention

The Churn Prediction engine has been significantly upgraded.

### Enhanced Algorithm
The system now calculates a **Churn Score (0-100)** based on:
- **Recency**: Days since last attendance.
- **Ghosting**: New members who joined >10 days ago but never attended.
- **Cancellations**: High cancellation rate (>50%) negatively impacts score.

### Automation Linkage
- When a member's risk level escalates to **High** (Churned), the system now **automatically triggers** an automation event: `churn_risk_high`.
- **Action Required**: Create an Automation in `Marketing > Automations` with Trigger: `churn_risk_high` to send a re-engagement email.

### Verification
- **Cron Job**: The daily cron job runs `ChurnService.updateAllScores()`.
- **Manual**: You can trigger a report generation to see updated scores immediately.

## 3. Database Updates
- **New Tables**: `referral_codes`, `referral_rewards`.
- **Updated Logic**: `ChurnService` queries now use `bookings` and `classes` for deep analysis.
