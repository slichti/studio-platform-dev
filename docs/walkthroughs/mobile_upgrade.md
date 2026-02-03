# Mobile Experience Upgrade Walkthrough

I have successfully upgraded the mobile application with key retention and engagement features.

## 1. Push Notifications
**Goal:** Re-engage users with reminders and churn alerts.
- **Implemented:** `expo-notifications` integration in `_layout.tsx`.
- **Logic:** Tokens are requested on startup/login and sent to the backend (`POST /users/push-token`).
- **Handling:** Foreground notifications show as banners; background taps are logged (ready for deep linking).

## 2. Referral Application
**Goal:** Viral growth via mobile sharing.
- **New Screen:** `Refers & Earn` tab.
- **Features:**
    - Live tracking of referrals and earnings.
    - Native "Share Sheet" integration for sending specific links.
    - "Give $20, Get $20" messaging.

## 3. Booking Experience
**Goal:** Reduce friction and improve attendance.
- **Schedule:** Updated to grouped `SectionList` by Date (Monday, Tuesday, etc.) instead of a flat list.
- **Calendar:** Added "Add to Calendar" button on Class Details page, using Google Calendar links for maximum compatibility.

## 4. Profile & Stats
**Goal:** Gamification and personal tracking.
- **Streak Card:** Visual "Flame" card showing current attendance streak.
- **User Info:** Improved profile header with dynamic avatar initial.

## Verification
- **Build:** `npm run typecheck` passed.
- **Dependencies:** Added `expo-clipboard` and `expo-notifications`.

Next steps: Connect the `StreakCard` to a real backend endpoint if `churnScore` logic evolves.
