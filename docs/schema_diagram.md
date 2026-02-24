```mermaid
erDiagram
    %% ─────────────────────────────────────────────
    %% Core Multi-Tenancy
    %% ─────────────────────────────────────────────
    users {
        string id PK
        string email UK
        json profile
        enum role
        boolean is_system_admin
        string stripe_customer_id
    }
    tenants {
        string id PK
        string slug UK
        string name
        json settings
        json branding
        string stripe_account_id
        string currency
        string status
        json mailchimp_credentials
        json zapier_credentials
        json google_credentials
        json slack_credentials
        json seo_config
        json gbp_token
    }
    tenant_members {
        string id PK
        string tenant_id FK
        string user_id FK
        json profile
        enum status
        boolean sms_consent
        timestamp sms_consent_at
        timestamp sms_opt_out_at
    }
    tenant_roles {
        string member_id PK_FK
        enum role PK
    }

    users ||--o{ tenant_members : "belongs to"
    tenants ||--o{ tenant_members : "has"
    tenant_members ||--o{ tenant_roles : "has roles"

    %% ─────────────────────────────────────────────
    %% Memberships & Subscriptions (overhauled Feb 2026)
    %% ─────────────────────────────────────────────
    membership_plans {
        string id PK
        string tenant_id FK
        string name
        string description
        integer price
        string currency
        enum interval
        string image_url
        string overlay_title
        string overlay_subtitle
        boolean vod_enabled
        integer trial_days
        boolean active
        string stripe_product_id
        string stripe_price_id
        timestamp created_at
        timestamp updated_at
    }
    subscriptions {
        string id PK
        string user_id FK
        string tenant_id FK
        string member_id FK
        string plan_id FK
        enum status
        timestamp current_period_end
        string stripe_subscription_id
        timestamp canceled_at
        enum dunning_state
        timestamp last_dunning_at
        timestamp created_at
    }

    tenants ||--o{ membership_plans : "offers"
    membership_plans ||--o{ subscriptions : "subscribed to"
    tenant_members ||--o{ subscriptions : "owns"
    users ||--o{ subscriptions : "pays"

    %% ─────────────────────────────────────────────
    %% Classes & Bookings
    %% ─────────────────────────────────────────────
    locations {
        string id PK
        string tenant_id FK
        string name
        string slug UK
        string timezone
        json seo_config
    }
    class_series {
        string id PK
        string tenant_id FK
        string title
        string recurrence_rule
    }
    classes {
        string id PK
        string tenant_id FK
        string series_id FK
        string location_id FK
        string instructor_id FK
        string course_id FK
        timestamp start_time
        integer duration_minutes
        enum status
        enum type
    }
    videos {
        string id PK
        string tenant_id FK
        string title
        string description
        string r2_key
        string cloudflare_stream_id
        integer duration
        string status
        string poster_url
        json tags
        timestamp created_at
    }
    bookings {
        string id PK
        string class_id FK
        string member_id FK
        enum status
        enum attendance_type
        string used_pack_id FK
        timestamp checked_in_at
    }

    tenants ||--o{ locations : "has"
    locations ||--o{ classes : "hosts"
    class_series ||--o{ classes : "generates"
    classes ||--o{ bookings : "has"
    tenant_members ||--o{ bookings : "attends"
    tenant_members ||--o{ classes : "instructs"
    purchased_packs ||--o{ bookings : "funds"

    %% ─────────────────────────────────────────────
    %% Courses & LMS (enhanced Feb 2026)
    %% ─────────────────────────────────────────────
    courses {
        string id PK
        string tenant_id FK
        string title
        string slug UK
        string description
        string thumbnail_url
        boolean is_published
        enum delivery_mode
        timestamp cohort_start_date
        timestamp cohort_end_date
    }
    course_enrollments {
        string id PK
        string course_id FK
        string user_id FK
        string tenant_id FK
        enum status
        integer progress_pct
        timestamp enrolled_at
        timestamp completed_at
    }
    video_collections {
        string id PK
        string course_id FK
        string title
        integer sort_order
    }
    video_collection_items {
        string id PK
        string collection_id FK
        string title
        enum item_type
        integer sort_order
    }
    quizzes {
        string id PK
        string tenant_id FK
        string title
        integer passing_score
    }
    quiz_questions {
        string id PK
        string quiz_id FK
        string question
        json options
        string correct_answer
        integer points
    }
    quiz_submissions {
        string id PK
        string quiz_id FK
        string user_id FK
        string tenant_id FK
        json answers
        integer score
        boolean passed
        timestamp submitted_at
    }
    assignments {
        string id PK
        string tenant_id FK
        string title
        string description
        string instructions_html
    }
    assignment_submissions {
        string id PK
        string assignment_id FK
        string user_id FK
        string tenant_id FK
        string content
        enum status
        integer grade
        string feedback
        timestamp submitted_at
        timestamp graded_at
    }
    course_item_completions {
        string id PK
        string user_id FK
        string tenant_id FK
        string course_id FK
        string item_id FK
        timestamp completed_at
    }
    course_comments {
        string id PK
        string course_id FK
        string collection_item_id FK
        string author_id FK
        string content
        timestamp created_at
    }
    course_resources {
        string id PK
        string collection_item_id FK
        string title
        string file_url
        string file_type
    }

    tenants ||--o{ courses : "offers"
    courses ||--o{ course_enrollments : "enrolls"
    courses ||--o{ video_collections : "has modules"
    video_collections ||--o{ video_collection_items : "contains items"
    video_collection_items ||--o| quizzes : "may be"
    video_collection_items ||--o| assignments : "may be"
    quizzes ||--o{ quiz_questions : "has"
    quizzes ||--o{ quiz_submissions : "receives"
    assignments ||--o{ assignment_submissions : "receives"
    users ||--o{ quiz_submissions : "submits"
    users ||--o{ assignment_submissions : "submits"
    users ||--o{ course_item_completions : "completes"
    courses ||--o{ course_item_completions : "tracked by"
    courses ||--o{ course_comments : "has"
    classes }|--o| courses : "linked to"

    %% ─────────────────────────────────────────────
    %% Commerce & POS
    %% ─────────────────────────────────────────────
    products {
        string id PK
        string tenant_id FK
        string name
        integer price
        integer stock_quantity
        string stripe_product_id
        string stripe_price_id
    }
    pos_orders {
        string id PK
        string tenant_id FK
        string member_id FK
        string staff_id FK
        integer total_amount
        enum status
        string stripe_payment_intent_id
    }
    pos_order_items {
        string id PK
        string order_id FK
        string product_id FK
        integer quantity
        integer unit_price
    }

    tenants ||--o{ products : "sells"
    products ||--o{ pos_order_items : "included in"
    pos_orders ||--o{ pos_order_items : "contains"
    tenant_members ||--o{ pos_orders : "purchases"

    %% ─────────────────────────────────────────────
    %% Gift Cards
    %% ─────────────────────────────────────────────
    gift_cards {
        string id PK
        string tenant_id FK
        string code UK
        integer initial_balance
        integer current_balance
        string buyer_member_id FK
        string recipient_member_id FK
    }
    gift_card_transactions {
        string id PK
        string gift_card_id FK
        integer amount
        enum type
        timestamp created_at
    }

    tenants ||--o{ gift_cards : "issues"
    tenant_members ||--o{ gift_cards : "buys"
    tenant_members ||--o{ gift_cards : "receives"
    gift_cards ||--o{ gift_card_transactions : "history"

    %% ─────────────────────────────────────────────
    %% Class Packs
    %% ─────────────────────────────────────────────
    class_pack_definitions {
        string id PK
        string tenant_id FK
        string name
        integer credits
        integer price
    }
    purchased_packs {
        string id PK
        string tenant_id FK
        string member_id FK
        string pack_definition_id FK
        integer initial_credits
        integer remaining_credits
        integer member_price
        timestamp expires_at
    }

    tenants ||--o{ class_pack_definitions : "defines"
    class_pack_definitions ||--o{ purchased_packs : "instance of"
    tenant_members ||--o{ purchased_packs : "owns"

    %% ─────────────────────────────────────────────
    %% Appointments
    %% ─────────────────────────────────────────────
    appointment_services {
        string id PK
        string tenant_id FK
        string title
        integer duration_minutes
        integer price
    }
    appointments {
        string id PK
        string tenant_id FK
        string service_id FK
        string instructor_id FK
        string member_id FK
        timestamp start_time
        enum status
    }

    tenants ||--o{ appointment_services : "offers"
    appointment_services ||--o{ appointments : "booked as"
    tenant_members ||--o{ appointments : "provides"
    tenant_members ||--o{ appointments : "books"

    %% ─────────────────────────────────────────────
    %% CRM & Leads
    %% ─────────────────────────────────────────────
    leads {
        string id PK
        string tenant_id FK
        string email
        string name
        string phone
        enum status
        string source
    }
    student_notes {
        string id PK
        string student_id FK
        string author_id FK
        string note
        timestamp created_at
    }

    tenants ||--o{ leads : "tracks"
    tenant_members ||--o{ student_notes : "has notes"
    tenant_members ||--o{ student_notes : "writes"

    %% ─────────────────────────────────────────────
    %% Waivers
    %% ─────────────────────────────────────────────
    waiver_templates {
        string id PK
        string tenant_id FK
        string title
        string body_html
    }
    waiver_signatures {
        string id PK
        string template_id FK
        string member_id FK
        string ip_address
        timestamp signed_at
    }

    tenants ||--o{ waiver_templates : "requires"
    waiver_templates ||--o{ waiver_signatures : "signed as"
    tenant_members ||--o{ waiver_signatures : "signs"

    %% ─────────────────────────────────────────────
    %% Marketing & Automation
    %% ─────────────────────────────────────────────
    marketing_automations {
        string id PK
        string tenant_id FK
        string trigger_event
        string subject
        boolean is_enabled
        json channels
        json trigger_condition
    }
    automation_logs {
        string id PK
        string tenant_id FK
        string automation_id FK
        string user_id FK
        string channel
        timestamp triggered_at
        json metadata
    }

    tenants ||--o{ marketing_automations : "configures"
    marketing_automations ||--o{ automation_logs : "generates"
    users ||--o{ automation_logs : "recorded for"

    %% ─────────────────────────────────────────────
    %% Community & Blogging
    %% ─────────────────────────────────────────────
    community_posts {
        string id PK
        string tenant_id FK
        string author_id FK
        string content
        enum type
        string image_url
        integer likes_count
        integer comments_count
        boolean is_pinned
        string topic_id FK
        boolean is_generated
        timestamp created_at
    }

    tenants ||--o{ community_posts : "hosts"
    tenant_members ||--o{ community_posts : "authors"

    %% ─────────────────────────────────────────────
    %% SEO Content Automation (Tier 7)
    %% ─────────────────────────────────────────────
    platform_seo_topics {
        string id PK
        string name
        string description
    }
    tenant_seo_content_settings {
        string id PK
        string tenant_id FK
        string topic_id FK
        enum frequency
        boolean is_enabled
    }

    platform_seo_topics ||--o{ tenant_seo_content_settings : "subscribed by"
    tenants ||--o{ tenant_seo_content_settings : "configures"
    platform_seo_topics ||--o{ community_posts : "guides"

    %% ─────────────────────────────────────────────
    %% Discounts & Coupons
    %% ─────────────────────────────────────────────
    coupons {
        string id PK
        string tenant_id FK
        string code UK
        enum type
        integer value
        boolean active
        integer max_uses
        timestamp expires_at
    }
    coupon_redemptions {
        string id PK
        string coupon_id FK
        string user_id FK
        timestamp redeemed_at
    }

    tenants ||--o{ coupons : "offers"
    coupons ||--o{ coupon_redemptions : "used in"
    users ||--o{ coupon_redemptions : "redeems"

    %% ─────────────────────────────────────────────
    %% Progress Tracking
    %% ─────────────────────────────────────────────
    progress_metric_definitions {
        string id PK
        string tenant_id FK
        string name
        enum category
        string unit
        string icon
        enum aggregation
        boolean visible_to_students
        boolean active
        integer display_order
    }
    member_progress_entries {
        string id PK
        string tenant_id FK
        string member_id FK
        string metric_definition_id FK
        integer value
        timestamp recorded_at
        enum source
        json metadata
    }

    tenants ||--o{ progress_metric_definitions : "defines"
    progress_metric_definitions ||--o{ member_progress_entries : "has"
    tenant_members ||--o{ member_progress_entries : "logs"

    %% ─────────────────────────────────────────────
    %% Communication (Chat)
    %% ─────────────────────────────────────────────
    chat_rooms {
        string id PK
        string tenant_id FK
        enum type
        string name
        enum status
        string assigned_to_id FK
    }

    tenants ||--o{ chat_rooms : "has"
    users ||--o{ chat_rooms : "assigned to"

    %% ─────────────────────────────────────────────
    %% Platform & Feature Gating
    %% ─────────────────────────────────────────────
    platform_config {
        string key PK
        json value
        boolean enabled
        string description
        timestamp updated_at
    }
    tenant_features {
        string id PK
        string tenant_id FK
        string feature_key
        boolean enabled
        timestamp created_at
    }
    audit_logs {
        string id PK
        string action
        string actor_id FK
        string target_id
        string ip_address
        json details
        timestamp created_at
    }
    push_logs {
        string id PK
        string tenant_id FK
        string user_id FK
        string title
        string body
        timestamp sent_at
    }
    webhook_endpoints {
        string id PK
        string tenant_id FK
        string url
        json events
        boolean active
    }
    webhook_logs {
        string id PK
        string tenant_id FK
        string endpoint_id FK
        string event
        enum status
        timestamp created_at
    }

    tenants ||--o{ tenant_features : "enables"
    tenants ||--o{ audit_logs : "generates"
    tenants ||--o{ push_logs : "sends"
    tenants ||--o{ webhook_endpoints : "registers"
    webhook_endpoints ||--o{ webhook_logs : "logs"
```

## Performance Indexes

The schema includes performance-critical indexes for edge scalability:

| Table | Index | Purpose |
|---|---|---|
| `bookings` | `(tenant_id, start_time)` | Schedule filtering |
| `bookings` | `(member_id, status, checked_in_at)` | Win-back automation |
| `classes` | `(tenant_id, start_time)` | Schedule & conflict detection |
| `automation_logs` | `(automation_id, user_id, channel)` UNIQUE | Idempotency guard |
| `course_item_completions` | `(user_id, item_id)` UNIQUE | Dedup per-lesson completions |
| `course_item_completions` | `(user_id, course_id)` | Progress aggregation |
| `quiz_submissions` | `(quiz_id, user_id)` | Latest-submission lookups |

## 3NF Compliance Notes

All tables satisfy Third Normal Form:
- **1NF**: All columns are atomic; no repeating groups.
- **2NF**: Every non-key attribute is fully dependent on the whole primary key.
- **3NF**: No transitive dependencies between non-key attributes; denormalized fields (e.g., `planName` in API responses) are computed at query time, not stored.

The sole deliberate exception is `subscriptions.status` which mirrors Stripe's subscription status — it is updated via webhook to avoid a round-trip to Stripe on every authenticated request.
