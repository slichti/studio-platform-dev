# Studio Platform Architecture

## System Overview

```mermaid
flowchart TB
    subgraph "Client Layer"
        WEB[Web App<br/>React Router + SSR]
        MOBILE[Platform Mobile App<br/>Universal Binary (Expo)]
        WIDGET[Booking Widget<br/>Embed]
    end

    subgraph "Cloudflare Edge"
        PAGES[Cloudflare Pages<br/>Frontend Hosting]
        WORKERS[Cloudflare Workers<br/>API Backend]
        DO[Durable Objects<br/>Real-time State]
        D1[(D1 Database<br/>SQLite)]
        R2[R2 Storage<br/>Images & Files]
        STREAM[Cloudflare Stream<br/>Video VOD]
        IMAGES[Cloudflare Images<br/>Image Processing]
    end

    subgraph "Authentication"
        CLERK[Clerk<br/>Auth Provider]
        STORE[AuthStore<br/>Mobile Secure Store]
    end

    subgraph "External Services"
        STRIPE[Stripe<br/>Payments]
        ZOOM[Zoom API<br/>Video Classes]
        RESEND[Resend<br/>Email]
        TWILIO[Twilio<br/>SMS]
        SVIX[Svix<br/>Webhooks]
        EXPO[Expo<br/>Push Notifications]
    end

    WEB --> PAGES
    WEB --> WORKERS
    WIDGET --> WORKERS
    MOBILE --> WORKERS

    PAGES --> CLERK
    MOBILE --> STORE
    WORKERS --> D1
    WORKERS --> DO
    
    WORKERS --> EXPO
    
    subgraph "Automation Engine"
        AUTO[Automation Service]
        QUEUE[Task Queue]
        CRON[Cron Triggers<br/>*/15 * * * *]
    end
    
    WORKERS --> AUTO
    CRON --> AUTO
    AUTO --> RESEND
    AUTO --> TWILIO
    AUTO --> EXPO
```

## Multi-Tenant Architecture

```mermaid
flowchart LR
    subgraph "Request Flow"
        REQ[HTTP Request] --> MW{Tenant Middleware}
        MW -->|X-Tenant-Slug Header| RESOLVE[Slug Resolution]
        MW -->|Subdomain| RESOLVE
        RESOLVE --> DB[(D1)]
        DB --> CTX[Tenant Context]
        CTX --> HANDLER[Route Handler]
    end

    subgraph "Data Isolation"
        HANDLER --> QUERY[Query Builder]
        QUERY -->|tenant_id filter| DATA[(Tenant Data)]
    end
```

## Role-Based Access Control

```mermaid
flowchart TD
    subgraph "Roles"
        SYS[System Admin] --> OWN[Owner]
        OWN --> INST[Instructor]
        INST --> STU[Student]
    end

    subgraph "Permissions"
        SYS -->|Full Access| ALL[All Tenants]
        OWN -->|Full Access| TENT[Own Tenant]
        INST -->|Limited| CLAS[Classes & Students]
        STU -->|View Only| SELF[Own Profile & Bookings]
    end

    subgraph "Student Restrictions"
        STU -.->|Cannot| SCHED[Schedule Classes]
        STU -.->|Cannot| COUPONS[View All Coupons]
        STU -.->|Cannot| PHOTOS[Access Photos]
        STU -.->|Can| BOOK[Book Classes]
        STU -.->|Can| VIDEOS[Watch Videos]
        STU -.->|Can| PROGRESS[View Progress]
    end

```

## Security Implementation

### Role-Based Access Control (RBAC)
*   **Platform Admin**: Global system access. Validated via `users.isPlatformAdmin`.
*   **Studio Owner**: Full access to tenant data and settings. Validated via `tenantRoles`.
*   **Instructor**: Limited management of classes, members, and bookings.
*   **Student**: Restricted to own profile, bookings, and public data.

### Threat Mitigation
*   **IDOR Prevention**:
    *   **Bookings**: Operations like cancellation/modification enforce ownership checks (`booking.memberId === currentMember.id`) or Admin/Owner role. The `GET /bookings/:id` route explicitly validates `class.tenantId` against the active tenant to prevent cross-tenant ID discovery.
    *   **Uploads**: Sensitive files (e.g., waivers) are protected by ownership or role checks.
*   **CSRF Protection**:
    *   **Stripe Connect**: Usage of **Signed State Tokens (JWT)** prevents CSRF attacks during the OAuth flow. The `state` parameter is cryptographically verifiable.
*   **Tenant Isolation**:
    *   All queries are scoped by `tenantId` derived from the request hostname/header via strict middleware.
    *   **Automations**: Background triggers (e.g., `class_booked`) use explicit joins with the `classes` table to ensure bookings are only processed within the correct tenant scope.

### Platform Configuration
The system uses a global `platform_config` table for system-wide toggles and version management.
*   **Mobile Maintenance Mode**: Globally disables all mobile app connectivity.
*   **Minimum App Version**: Enforces a mandatory update for all users below a specific version string.
*   **Feature Gates**: Enables/disables experimental or paid features (e.g., Webhooks) across all tenants.
### Platform Scalability & Protection
*   **Dynamic Rate Limiting**:
    *   **Cost-Based**: Weighted requests (1 point for GET, 10 points for bulk/export) ensure fair resource usage.
    *   **Global & Granular**:
        *   Global: 300 req/min/IP.
        *   Authenticated: 600 req/min/User.
        *   Isolated Buckets: Public routes (onboarding, booking) have separate counters to prevent DoS.

## API Layer Structure

```mermaid
flowchart TB
    subgraph "API Routes"
        AUTH["/auth/*"]
        USER["/users/*"]
        CLASSES["/classes/*"]
        MEMBERS["/members/*"]
        COMMERCE["/commerce/*"]
        APPOINTMENTS["/appointments/*"]
        VIDEO["/video-management/*"]
        CHAT["/chat/*"]
        WEBHOOKS["/webhooks/*"]
        PROGRESS["/progress/*"]
        ADMIN_MOBILE["/admin/mobile/*"]
    end

    subgraph "Middleware Stack"
        CORS[CORS] --> SENTRY[Sentry]
        SENTRY --> RATELIMIT[Global Rate Limiter]
        RATELIMIT --> TENANT[Tenant Resolution]
        TENANT --> AUTHMW[Auth Middleware]
        AUTHMW --> ROUTES[Route Handlers]
    end

    subgraph "Service Layer"
        SERVICES[Business Logic Services]
    end

    ROUTES --> AUTH
    ROUTES --> USERS
    ROUTES --> CLASSES
    ROUTES --> MEMBERS
    ROUTES --> COMMERCE
    ROUTES --> APPOINTMENTS
    ROUTES --> VIDEO
    ROUTES --> CHAT
    ROUTES --> WEBHOOKS
    ROUTES --> PROGRESS

    AUTH & USERS & CLASSES & MEMBERS & COMMERCE & APPOINTMENTS & VIDEO & CHAT & WEBHOOKS & PROGRESS --> SERVICES
    SERVICES --> DB[(D1 Database)]
```

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React Router v7, TypeScript, TailwindCSS |
| **Backend** | Cloudflare Workers, Hono Framework |
| **Database** | Cloudflare D1 (SQLite), Drizzle ORM |
| **Storage** | Cloudflare R2 (Files), Stream (Video), Images |
| **Auth** | Clerk |
| **Payments** | Stripe Connect (Multi-tenant) |
| **Email** | Resend |
| **SMS** | Twilio |
| **Video Calls** | Zoom API |
| **Real-time** | Cloudflare Durable Objects (WebSockets) |

## Database Schema (3NF)

The platform utilizes a normalized multi-tenant relational schema. Data isolation is enforced at the application layer using `tenant_id` filters on all queries to ensure strict tenant boundaries.

```mermaid
erDiagram
    TENANTS {
        string id PK
        string slug UK
        string name
        json branding
        string status
        string tier
    }
    USERS {
        string id PK
        string email UK
        string role
        string phone
    }
    TENANT_MEMBERS {
        string id PK
        string tenantId FK
        string userId FK
        string status
    }
    LOCATIONS {
        string id PK
        string tenantId FK
        string name
        string timezone
    }
    CLASSES {
        string id PK
        string tenantId FK
        string instructorId FK
        string locationId FK
        string seriesId FK
        string courseId FK
        datetime startTime
        int duration
        string type
    }
    COURSES {
        string id PK
        string tenantId FK
        string title
        string slug UK
        string deliveryMode
        datetime cohortStartDate
        datetime cohortEndDate
    }
    BOOKINGS {
        string id PK
        string classId FK
        string memberId FK
        string status
        string attendanceType
    }
    SUBSCRIPTIONS {
        string id PK
        string userId FK
        string tenantId FK
        string planId FK
        string status
    }
    TENANTS ||--o{ TENANT_MEMBERS : "has members"
    USERS ||--o{ TENANT_MEMBERS : "is member of"
    TENANTS ||--o{ LOCATIONS : "operates in"
    TENANT_MEMBERS ||--o{ CLASSES : "teaches"
    LOCATIONS ||--o{ CLASSES : "hosts"
    CLASSES ||--o{ BOOKINGS : "has"
    TENANT_MEMBERS ||--o{ BOOKINGS : "makes"
    TENANTS ||--o{ COURSES : "offers"
    CLASSES }|--o| COURSES : "linked to"
    USERS ||--o{ SUBSCRIPTIONS : "subscribes"
```

## Performance & Optimization

### Database Efficiency & Scalability
To maintain low latency on the edge, the API employs several database optimization strategies:

```mermaid
sequenceDiagram
    participant Middleware as QuotaMiddleware
    participant Service as UsageService
    participant D1 as Cloudflare D1
    
    Middleware->>Service: checkLimit(tenantId)
    Service->>D1: db.batch([countMembers, countLocations, countClasses, getUsage])
    Note over D1: Single round-trip execution
    D1-->>Service: [results]
    Service-->>Middleware: Has Quota?
    alt quota exceeded
        Middleware-->>Client: 402 Payment Required
    else quota ok
        Middleware-->>Handler: Proceed to Route
    end
```

*   **Query Batching**: High-frequency checks (like Tenant Quotas) use `db.batch()` to consolidate multiple count/fetch operations into a single round-trip, reducing overhead by up to 80%.
*   **SARGable Queries**: Overlap detection logic in `ConflictService` uses indexed range filters on `startTime` (indexed) to coarsely filter candidates before applying precise complex SQL duration math.
*   **N+1 Elimination**: Background win-back automations use aggregated queries (`MAX`, `GROUP BY`) to fetch activity for all member candidates in a single operation rather than looping over members.
*   **Cursorless Pagination**: List endpoints (e.g., `/classes`) enforce mandatory `limit` and `offset` parameters to prevent performance degradation as tenant schedules grow.

### Server Bundle Optimization
To adhere to the Cloudflare Worker 1MB bundle size limit, the application employs aggressive code splitting and lazy loading:
*   **Route Lazy Loading**: Major routes (`Settings`, `Admin`, `Marketing`) are wrapped in `React.lazy` and `Suspense`, ensuring they are not bundled into the main server entry point.
*   **Dynamic Imports**: Heavy libraries (e.g., `mermaid`, `recharts`, `livekit-client`) are imported dynamically only when needed on the client side (`ClientOnly` components).
*   **Separation of Concerns**: UI logic is extracted into separate components to facilitate isolation and independent bundling.

### Perceived Performance & UX
*   **Skeleton Loading**: The platform uses a centralized `SkeletonLoader` component to provide consistent visual feedback across the Dashboard, Analytics, and Student Portal during initial data hydration.
*   **Pagination & Infinite Scroll**: To handle large datasets (e.g., hundreds of scheduled classes), list views implement `useInfiniteQuery` (Admin) or custom `useFetcher` patterns (Portal) to load data in chunks, significantly reducing initial payload size and Time-to-Interactive (TTI).

### Mobile Optimization
*   **Universal App**: Single binary architecture reduces build complexity and store review times.
*   **Over-the-Air Updates**: Uses Expo Updates (where compliant) for rapid critical bug fixes.

## Mobile App Strategy (Platform Model)
Instead of white-labeled binaries for each tenant, the system uses a **Single Platform App**:
*   **Universal Binary**: One app in App Store / Play Store.
*   **Studio Code**: Users enter a unique `slug` (or scan QR) to "bind" the app to a specific tenant.
*   **Theming**: The app dynamically fetches `mobile-config` (primary color, features) to rebrand itself on the fly.
*   **Administration**: Platform admins control tenant access, force minimum versions, and toggle global maintenance mode via the **Admin Mobile Dashboard**.
*   **Push Notifications**: Tokens are registered to the specific tenant context.

## Commerce Features
*   **Gift Cards**:
    *   Stored in `gift_cards` table (Partial redemption supported).
    *   Split-tender checkout (Gift Card + Credit Card).
    *   Tracked via `gift_card_transactions`.
*   **Discounts**:
    *   Coupon system (`coupons` table) with usage limits and expiry.
    *   Auto-applied or code-based.
*   **POS**:
    *   Retail interface for in-person sales.
    *   Stripe Terminal integration for card presence.

## Compliance & Data Minimization
*   **Financial System of Record**: Stripe is treated as the sole system of record for financial data. The platform does **not** store sensitive cardholder data (PAN, CVV) or bank account numbers.
*   **Stripe Connect Only**: The platform exclusively uses Stripe Standard Connect for tenant payments. "Bring Your Own Key" (Custom Stripe Keys) is not supported to minimize PCI-DSS scope.
*   **Encryption**: All sensitive integration credentials (e.g., Zoom, Resend) are encrypted at rest using AES-GCM-256.

## Regulatory Compliance

### CAN-SPAM Act
Email marketing compliance is enforced through the `EmailService`:
*   **Physical Address**: Configurable via `branding.physicalAddress` in tenant settings
*   **Unsubscribe Link**: Auto-included footer with `settings.unsubscribeUrl`
*   **List-Unsubscribe Header**: RFC 8058 compliant one-click unsubscribe

### TCPA (Telephone Consumer Protection Act)
SMS marketing compliance is enforced through the `SmsService`:
*   **Consent Tracking**: `tenantMembers.smsConsent`, `smsConsentAt`, `smsOptOutAt` fields
*   **Time Restrictions**: SMS blocked outside 8am-9pm recipient local time (EST default)
*   **Opt-Out Handling**: `/webhooks/twilio/sms` processes STOP/UNSUBSCRIBE keywords
*   **Re-subscription**: START keyword handling with user confirmation

### SOC 2 Type II Readiness
*   **Audit Logging**: All administrative actions logged to `auditLogs` table
*   **Log Export**: CSV export available in Admin Portal
*   **Session Tracking**: Login/logout events captured via Clerk webhooks
*   **Retention**: Audit logs retained for 365 days

### Michigan Identity Theft Protection Act
*   **Data Minimization**: No storage of SSN, driver's license, or financial account numbers
*   **Breach Notification**: Incident response workflow supports 45-day notification requirement

### ADA / WCAG 2.1
*   **Semantic HTML**: Proper heading hierarchy, ARIA labels
*   **Keyboard Navigation**: All interactive elements accessible
*   **Color Contrast**: Minimum 4.5:1 ratio for text

```mermaid
flowchart LR
    subgraph "Compliance Architecture"
        EMAIL[Email Service] --> CANSPAM{CAN-SPAM}
        SMS[SMS Service] --> TCPA{TCPA}
        AUDIT[Audit Logs] --> SOC2{SOC 2}
        STRIPE[Stripe Connect] --> PCI{PCI-DSS}
    end

    CANSPAM --> |"Physical Address"| FOOTER[Email Footer]
    CANSPAM --> |"List-Unsubscribe"| HEADERS[Email Headers]
    TCPA --> |"Consent Check"| CONSENT[DB: smsConsent]
    TCPA --> |"Time Restrict"| TIME[8am-9pm EST]
    TCPA --> |"STOP Handler"| WEBHOOK[Twilio Webhook]
    SOC2 --> |"CSV Export"| EXPORT[Admin Portal]
    PCI --> |"No Card Data"| MINIMAL[Data Minimization]
```

## Tenant Provisioning & Onboarding

### Provisioning Flow
1.  **Slug Validation**: Real-time availability check via `POST /studios/validate-slug`. Enforces regex standards and reserved word blocking.
2.  **Creation**:
    *   `POST /studios`: Creates the `tenant` record.
    *   **Billing Intent**: Captures desired tier (Launch/Growth/Scale) and interval.
    *   **Permissioning**: Creator is automatically assigned `owner` role.
3.  **Onboarding Wizard**:
    *   **Steps**: Template Selection -> Branding -> Location -> Schedule -> Team Invite -> Data Import.
    *   **Templates**: Pre-configured business types (Yoga, Gym, Martial Arts, etc.) set default class types and prices.

