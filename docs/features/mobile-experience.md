# Mobile Experience (Phase 4)

The Phase 4 upgrade focuses on user retention and engagement through native mobile features.

## Push Notifications

### Architecture
- **Provider**: Expo Push API (Backend) + Expo Notifications (Client).
- **Channels**:
    - `default`: General notifications.
    - `reminders`: Booking reminders (high priority).
- **Token Management**:
    - Tokens are registered via `POST /users/push-token` on app launch.
    - Stored in `user_push_tokens` table, linked to `userId` and `tenantId`.

### Triggers
1.  **Waitlist Promotion**: Automatic notification when a user is moved from waitlist to roster.
2.  **Booking Confirmation**: Immediate confirmation upon successful booking.
3.  **Class Reminders**: Scheduled reminders 24h and 1h before class (configured via Cron).

## Referral System

### Overview
Allows students to refer friends and earn rewards.
- **Unique Codes**: Every user has a unique referral code (e.g., `JDOE123`).
- **Sharing**: Uses native OS share sheet (iOS/Android) for seamless distribution.
- **Attribution**: 
    - New users enter referral code during signup.
    - `referrals` table tracks the relationship.
    - "Referrer" gets credit upon "Referee" first purchase.

## improved Schedule

### Filters
- **Category Filter**: Horizontal scrollable list to filter classes by type (Yoga, HIIT, etc.).
- **Instructor Filter**: Quick filter to find classes by favorite instructors.

### UI Enhancements
- **Streak Tracking**: Visual "attendance streak" indicator on the dashboard.
- **Booking Flow**: Simplified "Book Now" action with clear confirmation feedback.
