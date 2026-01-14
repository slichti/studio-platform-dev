# Studio Platform Architecture

## System Overview

```mermaid
flowchart TB
    subgraph "Client Layer"
        WEB[Web App<br/>React Router + SSR]
        MOBILE[Mobile App<br/>Future]
        WIDGET[Booking Widget<br/>Embed]
    end

    subgraph "Cloudflare Edge"
        PAGES[Cloudflare Pages<br/>Frontend Hosting]
        WORKERS[Cloudflare Workers<br/>API Backend]
        D1[(D1 Database<br/>SQLite)]
        R2[R2 Storage<br/>Images & Files]
        STREAM[Cloudflare Stream<br/>Video VOD]
        IMAGES[Cloudflare Images<br/>Image Processing]
    end

    subgraph "Authentication"
        CLERK[Clerk<br/>Auth Provider]
    end

    subgraph "External Services"
        STRIPE[Stripe<br/>Payments]
        ZOOM[Zoom API<br/>Video Classes]
        RESEND[Resend<br/>Email]
        TWILIO[Twilio<br/>SMS]
        SVIX[Svix<br/>Webhooks]
    end

    WEB --> PAGES
    WEB --> WORKERS
    WIDGET --> WORKERS
    MOBILE -.-> WORKERS

    PAGES --> CLERK
    WORKERS --> D1
    WORKERS --> R2
    WORKERS --> STREAM
    WORKERS --> IMAGES
    WORKERS --> CLERK

    WORKERS --> STRIPE
    WORKERS --> ZOOM
    WORKERS --> RESEND
    WORKERS --> TWILIO
    WORKERS --> SVIX
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
