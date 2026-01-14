
import { MermaidDiagram } from "~/components/MermaidDiagram";
import { GitBranch, BookOpen, Video, Users } from "lucide-react";

export default function AdminWorkflows() {
    return (
        <div className="max-w-7xl mx-auto pb-20 space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Process Workflows</h1>
                <p className="text-zinc-500 dark:text-zinc-400">Visual documentation of core platform business logic and automated flows.</p>
            </div>

            {/* 1. Tenant Creation */}
            <section className="space-y-4">
                <div className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
                    <GitBranch className="text-indigo-600 dark:text-indigo-400" size={20} />
                    <h2 className="text-lg font-semibold">1. Tenant Creation & Onboarding</h2>
                </div>
                <MermaidDiagram
                    title="Tenant Provisioning Flow"
                    chart={`
sequenceDiagram
    participant Admin as Platform Admin
    participant API as Platform API
    participant DB as Database
    participant Stripe
    participant R2 as Cloudflare R2

    Admin->>API: POST /tenants (name, slug, tier)
    API->>DB: Check Slug Uniqueness
    API->>Stripe: Create Customer (Platform Billing)
    API->>DB: Insert Tenant (status=active)
    API->>DB: Insert Admin Member (Owner)
    API->>R2: Initialize Storage Bucket Path
    API-->>Admin: Returns { tenantId, slug }
`}
                />
            </section>

            {/* 2. Student Sign-up */}
            <section className="space-y-4 pt-8 border-t border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
                    <Users className="text-emerald-600 dark:text-emerald-400" size={20} />
                    <h2 className="text-lg font-semibold">2. Student Sign-up & Class Booking</h2>
                </div>
                <MermaidDiagram
                    title="Student Registration & Booking Flow"
                    chart={`
sequenceDiagram
    participant User as Student
    participant Web as Studio Site
    participant API
    participant DB
    participant Stripe

    User->>Web: Visiting /studio/[slug]/classes
    User->>Web: Click "Book" on Class
    Web->>API: GET /classes/[id]
    
    alt Not Logged In
        Web-->>User: Redirect to Sign In/Up
        User->>Web: Sign Up (Clerk)
        Web->>API: POST /users (Create Global User)
        API->>DB: Create User Record
    end

    Web->>API: POST /bookings (classId)
    API->>DB: Check Member Status
    
    alt No Credits
        API-->>Web: 402 Payment Required
        Web->>User: Show "Buy Class Pack" Modal
        User->>Web: Select 5-Class Pack
        Web->>Stripe: Checkout Session
        Stripe-->>Web: Payment Success
        Web->>API: Webhook (invoice.paid)
        API->>DB: Add Credits to Member
    end

    Web->>API: Retry POST /bookings
    API->>DB: Deduct Credit
    API->>DB: Create Booking (status=confirmed)
    API-->>Web: Success
    Web->>User: "You are booked!"
`}
                />
            </section>

            {/* 3. VOD Ingestion */}
            <section className="space-y-4 pt-8 border-t border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
                    <Video className="text-blue-600 dark:text-blue-400" size={20} />
                    <h2 className="text-lg font-semibold">3. Zoom File Transfer (VOD Ingestion)</h2>
                </div>
                <MermaidDiagram
                    title="Automated VOD Ingestion Pipeline"
                    chart={`
sequenceDiagram
    participant Zoom
    participant Webhook as API Webhook
    participant Worker as Download Worker
    participant R2 as R2 Storage
    participant CF as Cloudflare Stream
    participant DB

    Zoom->>Webhook: POST /webhooks/zoom (recording.completed)
    Webhook->>DB: Log Webhook Event
    Webhook->>Worker: Trigger Async Job
    
    loop Download Worker
        Worker->>Zoom: Get Download URL
        Worker->>R2: Stream Upload (MP4)
        Worker->>DB: Update Video Status (downloaded)
    end

    Worker->>CF: Direct Upload from R2 URL
    CF-->>Worker: Stream ID
    Worker->>DB: Update Video (processing)
    
    loop Stream Webhook
        CF->>Webhook: POST /webhooks/stream (ready)
        Webhook->>DB: Update Video (status=ready)
    end
`}
                />
            </section>

            {/* 4. Live Streaming */}
            <section className="space-y-4 pt-8 border-t border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
                    <Video className="text-red-500 dark:text-red-400" size={20} />
                    <h2 className="text-lg font-semibold">4. Live Streaming Logic</h2>
                </div>
                <MermaidDiagram
                    title="Live Stream Access Control"
                    chart={`
graph TD
    A[Instructor] -->|Starts Stream| B(LiveKit Room)
    B -->|Webhook| C{API Gatekeeper}
    C -->|Valid Token?| D[Connect Instructor]
    C -->|Invalid?| E[Reject]

    F[Student] -->|Join Class| G(Web Player)
    G -->|Request Token| H[API /token]
    H -->|Check Booking| I{Has Booking?}
    I -->|Yes| J[Return Token]
    I -->|No| K[Error: Book First]
    J --> B
`}
                />
            </section>
        </div>
    );
}
