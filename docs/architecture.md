# Studio Platform Architecture

## System Overview

```mermaid
flowchart TB
    subgraph "Client Layer"
        WEB[Web App<br/>React Router + SSR]
        MOBILE[Mobile App<br/>Expo / React Native]
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
    *   **Bookings**: Operations like cancellation/modification enforce ownership checks (`booking.memberId === currentMember.id`) or Admin/Owner role.
    *   **Uploads**: Sensitive files (e.g., waivers) are protected by ownership or role checks.
*   **CSRF Protection**:
    *   **Stripe Connect**: Usage of **Signed State Tokens (JWT)** prevents CSRF attacks during the OAuth flow. The `state` parameter is cryptographically verifiable.
*   **Tenant Isolation**:
    *   All queries are scoped by `tenantId` derived from the request hostname/header via strict middleware.

## API Layer Structure

```mermaid
flowchart TB
    subgraph "API Routes"
        AUTH["/auth/*"]
        USERS["/users/*"]
        CLASSES["/classes/*"]
        MEMBERS["/members/*"]
        COMMERCE["/commerce/*"]
        APPOINTMENTS["/appointments/*"]
        VIDEO["/video-management/*"]
        CHAT["/chat/*"]
        WEBHOOKS["/webhooks/*"]
    end

    subgraph "Middleware Stack"
        CORS[CORS] --> SENTRY[Sentry]
        SENTRY --> TENANT[Tenant Resolution]
        TENANT --> AUTHMW[Auth Middleware]
        AUTHMW --> ROUTES[Route Handlers]
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
