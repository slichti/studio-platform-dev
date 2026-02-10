# Studio Platform Mobile App

A universal React Native (Expo) application for studio members.

## Features

- **Class Booking**: View schedule by date, filter by category/instructor, and book classes with one tap.
- **Push Notifications**: Receive reminders for upcoming classes and waitlist promotions.
- **Referrals**: Share unique referral codes to earn rewards.
- **Profile Management**: View attendance streak, membership status, and update payment methods.
- **Tenant Binding**: Dynamically rebrands based on the studio `slug`.

## Development

### Prerequisites
- Node.js 18+
- Expo Go app installed on your physical device or Simulator.

### Getting Started

1.  **Install Dependencies**:
    ```bash
    cd apps/mobile
    npm install
    ```

2.  **Start Metro Bundler**:
    ```bash
    npm start
    ```

3.  **Run on Device**:
    - Scan the QR code with Expo Go (Android) or Camera (iOS).
    - Press `i` to open in iOS Simulator.
    - Press `a` to open in Android Emulator.

## Configuration

The app requires the following environment variables (typically injected via Expo EAS):

- `EXPO_PUBLIC_API_URL`: The base URL of the Cloudflare Worker API.
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk authentication key.

## Deployment

The app is deployed using EAS Build:

```bash
eas build --profile production --platform all
```

For OTA updates:

```bash
eas update --branch production --message "Update description"
```
