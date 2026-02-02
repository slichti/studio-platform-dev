```mermaid
erDiagram
    %% Core Multi-Tenancy
    users {
        string id PK
        string email
        json profile
        enum role
        boolean is_system_admin
        string stripe_customer_id
    }
    tenants {
        string id PK
        string slug
        string name
        json settings
        string stripe_account_id
        string currency
        string status
        json mailchimp_credentials
        json zapier_credentials
        json google_credentials
        json slack_credentials
    }
    tenant_members {
        string id PK
        string tenant_id FK
        string user_id FK
        json profile
        enum status
    }
    tenant_roles {
        string member_id PK,FK
        enum role PK
    }

    users ||--o{ tenant_members : "belongs to"
    tenants ||--o{ tenant_members : "has"
    tenant_members ||--o{ tenant_roles : "has roles"

    %% Memberships & Subscriptions
    membership_plans {
        string id PK
        string tenant_id FK
        string name
        integer price
        enum interval
        boolean vod_enabled
    }
    subscriptions {
        string id PK
        string user_id FK
        string tenant_id FK
        string member_id FK
        string plan_id FK
        enum status
        timestamp current_period_end
    }

    tenants ||--o{ membership_plans : "offers"
    membership_plans ||--o{ subscriptions : "subscribed to"
    tenant_members ||--o{ subscriptions : "owns"

    %% Classes & Bookings
    locations {
        string id PK
        string tenant_id FK
        string name
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
        timestamp start_time
        integer duration_minutes
        enum status
    }
    bookings {
        string id PK
        string class_id FK
        string member_id FK
        enum status
        enum payment_method
    }

    tenants ||--o{ locations : "has"
    locations ||--o{ classes : "hosts"
    class_series ||--o{ classes : "generates"
    classes ||--o{ bookings : "has"
    tenant_members ||--o{ bookings : "attends"
    tenant_members ||--o{ classes : "instructs"

    %% Commerce & POS
    products {
        string id PK
        string tenant_id FK
        string name
        integer price
        integer stock_quantity
    }
    pos_orders {
        string id PK
        string tenant_id FK
        string member_id FK
        string staff_id FK
        integer total_amount
        enum status
    }
    pos_order_items {
        string id PK
        string order_id FK
        string product_id FK
        integer quantity
    }

    tenants ||--o{ products : "sells"
    products ||--o{ pos_order_items : "included in"
    pos_orders ||--o{ pos_order_items : "contains"
    tenant_members ||--o{ pos_orders : "purchases"
    tenant_members ||--o{ pos_orders : "processes"

    %% Gift Cards
    gift_cards {
        string id PK
        string tenant_id FK
        string code
        integer current_balance
        string buyer_member_id FK
        string recipient_member_id FK
    }
    gift_card_transactions {
        string id PK
        string gift_card_id FK
        integer amount
        enum type
    }

    tenants ||--o{ gift_cards : "issues"
    tenant_members ||--o{ gift_cards : "buys"
    tenant_members ||--o{ gift_cards : "receives"
    gift_cards ||--o{ gift_card_transactions : "history"

    %% Class Packs
    class_pack_definitions {
        string id PK
        string tenant_id FK
        string name
        integer credits
    }
    purchased_packs {
        string id PK
        string tenant_id FK
        string member_id FK
        string pack_definition_id FK
        integer remaining_credits
    }

    tenants ||--o{ class_pack_definitions : "defines"
    class_pack_definitions ||--o{ purchased_packs : "instance of"
    tenant_members ||--o{ purchased_packs : "owns"

    %% Appointments
    appointment_services {
        string id PK
        string tenant_id FK
        string title
        integer duration_minutes
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

    %% CRM
    leads {
        string id PK
        string tenant_id FK
        string email
        enum status
    }
    student_notes {
        string id PK
        string student_id FK
        string author_id FK
        string note
    }

    tenants ||--o{ leads : "tracks"
    tenant_members ||--o{ student_notes : "has notes"
    tenant_members ||--o{ student_notes : "writes"

    %% Waivers
    waiver_templates {
        string id PK
        string tenant_id FK
        string title
    }
    waiver_signatures {
        string id PK
        string template_id FK
        string member_id FK
        timestamp signed_at
    }

    tenants ||--o{ waiver_templates : "requires"
    waiver_templates ||--o{ waiver_signatures : "signed as"
    tenant_members ||--o{ waiver_signatures : "signs"

    %% Marketing & Automation
    marketing_automations {
        string id PK
        string tenant_id FK "Nullable (Global)"
        string trigger_event
        string subject
        boolean is_enabled
        json channels
    }
    
    tenants ||--o{ marketing_automations : "configures"

    %% Communication (Chat)
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

    %% Discounts & Coupons
    coupons {
        string id PK
        string tenant_id FK
        string code
        enum type
        integer value
        boolean active
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

    %% System Logs
    push_logs {
        string id PK
        string tenant_id FK
        string user_id FK
        string title
        string body
        timestamp sent_at
    }

    tenants ||--o{ push_logs : "generates"
    users ||--o{ push_logs : "receives"

    %% Platform & Feature Gating
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

    tenants ||--o{ tenant_features : "has enabled"
```
