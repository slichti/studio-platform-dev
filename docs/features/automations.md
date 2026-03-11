# Marketing Automations

The Marketing Automation system enables studios to trigger event-driven communications (Email/SMS) to engage members, prevent churn, and celebrate milestones.

## Core Features

### 1. Visual Workflow Builder
- **Automation Canvas**: A node-based visual editor for designing complex multi-step automations.
- **Branching Logic**: Supports conditional paths (If/Else) based on member data or behavior.
- **Trigger-Action Model**: Automations start with a trigger (e.g., `class_booked`, `member_created`, `churn_risk_high`) followed by a series of timed actions.

### 2. Recommended Templates
- **Platform-wide Templates**: Studio owners can choose from a library of pre-configured, high-converting automation templates (Win-back campaigns, Birthday wishes, New Member onboarding).
- **One-Click Adoption**: Templates can be "adopted" by a studio, automatically cloning the workflow into their local dashboard for customization.

### 3. Integrated Variables
- Personalize communications with dynamic variables: `{firstName}`, `{lastName}`, `{studioName}`, `{studioAddress}`, `{classTitle}`, etc.

## System Triggers

| Trigger | Event |
|---------|-------|
| `member_created` | Fires when a new student is added to the studio. |
| `class_booked` | Fires immediately upon booking a class. |
| `class_checked_in` | Fires when a student is marked as present on the roster. |
| `waitlist_promoted` | Fires when a student is moved from the waitlist to confirmed. |
| `pack_purchased` | Fires when a class pack is **purchased or admin-assigned** to a member. Common fields: `packId`, `packName`, `credits`, `expiresAt`, `amount`, `source`, `purchasedPackId`. |
| `membership_started` | Fires when a membership becomes active for a member (via Stripe checkout or admin assignment). Includes `planId`, `planName`, `planInterval`, `nextRenewal`, and `source` (`web_checkout`, `mobile_checkout`, `admin_assignment`). |
| `churn_risk_high` | Fires when the churn prediction model identifies an at-risk member. |

## Technical Implementation

- **Service**: `packages/api/src/services/automations.ts`
- **Cron Jobs**: Automated scanning for date-based triggers (e.g., birthdays) or behavioral triggers (churn) happens via recurring Cloudflare Worker crons.
- **Frontend**: `apps/web/app/components/AutomationCanvas.tsx`

### Recommended Variables

For commerce-related journeys (upsell, win-back, onboarding), the following variables are typically available:

- **Pack purchase (`pack_purchased`)**: `{firstName}`, `{packName}`, `{credits}`, `{expiresAt}`, `{source}`.
- **Membership start (`membership_started`)**: `{firstName}`, `{planName}`, `{planInterval}`, `{nextRenewal}`, `{source}`.
