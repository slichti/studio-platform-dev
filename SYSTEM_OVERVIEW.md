# System Overview

## High-Level Architecture

The Studio Platform is a multi-tenant SaaS built on Cloudflare's edge network.

```mermaid
graph TD
    Client[Web Client (React Router v7)]
    Auth[Clerk Auth]
    
    subgraph "Cloudflare Edge"
        Pages[Cloudflare Pages (Web)]
        Worker[Cloudflare Worker (API / Hono)]
        D1[(D1 Database)]
        R2[(R2 Storage)]
    end
    
    subgraph "External Services"
        Stripe[Stripe (Payments/Connect)]
        Resend[Resend (Email)]
    end

    Client -->|Auths with| Auth
    Client -->|Serves Assets| Pages
    Client -->|API Requests| Worker
    
    Worker -->|CRUD| D1
    Worker -->|PDFs/Images| R2
    Worker -->|Process Payments| Stripe
    Worker -->|Send Emails| Resend
```

## Core Workflows

### 1. Member Invitation & Onboarding

```mermaid
sequenceDiagram
    participant Owner
    participant API
    participant Email as EmailService
    participant Student
    participant DB

    Owner->>API: POST /members (email, name)
    API->>DB: Create Member (Status: Inactive, Token: UUID)
    API->>Email: Send Invitation Email (link + token)
    Email-->>Student: Receive Email
    Student->>Client: Clicks Link (/accept-invite?token=...)
    Client->>Auth: User Signs In / Signs Up
    Client->>API: POST /members/accept-invite (token)
    API->>DB: Find Member by Token
    API->>DB: Link Real User ID, Set Active, Clear Token
    API-->>Client: Success
```

### 2. Class Booking

```mermaid
sequenceDiagram
    participant Student
    participant API
    participant DB
    participant Stripe

    Student->>API: POST /bookings (classId)
    API->>DB: Check Class Capacity & Requirements
    alt Paid Class
        API->>DB: Check for Credits / Active Subscription
        alt No Credits
             API-->>Student: Payment Required
             Student->>Stripe: Complete Checkout
             Stripe-->>API: Webhook (Payment Succeeded)
             API->>DB: Create Booking
        else Has Credits
             API->>DB: Deduct Credit
             API->>DB: Create Booking
        end
    else Free/Included
        API->>DB: Create Booking
    end
    API-->>Student: Booking Confirmed
```
