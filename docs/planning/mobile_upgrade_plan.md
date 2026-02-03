# Mobile Experience Upgrade Plan

## Goal Description
Significantly improve the mobile application experience for members, bringing it to parity with the web retention features and enhancing native capabilities.

## User Review Required
> [!IMPORTANT]
> **Scope Confirmation:** Please confirm if you want to include:
> 1.  **Referral Integration:** Showing the "Refer & Earn" screen in the mobile app.
> 2.  **Push Notifications:** Full implementation of push notifications for booking reminders and churn re-engagement.
> 3.  **Booking Polish:** Improving the class booking flow with better UI/UX.
> 4.  **Profile & Stats:** Adding a native dashboard for attendance stats and membership details.

## Proposed Changes

### 1. Referral System (Mobile)
- **[NEW] `app/(tabs)/referrals.tsx`**: Add a dedicated tab or profile section for Referrals.
- **Feature:** Display unique code, share using native share sheet, view earnings.

### 2. Push Notifications
- **[MODIFY] `app/_layout.tsx`**: integrate Expo Notifications listeners.
- **[MODIFY] `packages/api/src/services/push.ts`**: Ensure backend can target specific devices.
- **[NEW] `app/settings/notifications.tsx`**: UI to toggles specific notification types.

### 3. Booking Experience
- **[MODIFY] `app/(tabs)/index.tsx`**: Enhance the schedule view with filters (Instructor, Class Type).
- **[MODIFY] `app/class/[id].tsx`**: Improve the class detail view with "Add to Calendar" button.

### 4. Profile & Stats
- **[MODIFY] `app/(tabs)/profile.tsx`**: Add charts/graphs for attendance history (Attendance Streak).
- **[NEW] `components/StreakCard.tsx`**: Visual component for current booking streak.

## Verification Plan
### Manual Verification
- **Run Locally:** `npx expo start` and test on iOS Simulator / Android Emulator.
- **Push Test:** Use Expo Push Notification Tool to send a test message.
- **Referral Test:** Verify native share sheet opens with the correct link.
