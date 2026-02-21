import { drizzle } from 'drizzle-orm/d1';
import { sql } from 'drizzle-orm';
import * as schema from '@studio/db/src/schema';

export async function setupTestDb(d1: D1Database) {
    const db = drizzle(d1, { schema });

    // 1. Drop all known tables to ensure clean state
    const tables = [
        'tenants', 'uploads', 'tenant_features', 'users', 'user_relationships',
        'tenant_members', 'tenant_invitations', 'tenant_roles', 'custom_roles',
        'member_custom_roles', 'audit_logs', 'usage_logs', 'locations',
        'class_series', 'classes', 'student_notes', 'subscriptions',
        'bookings', 'appointment_services', 'availabilities', 'appointments',
        'payroll_config', 'payouts', 'payroll_items', 'marketing_campaigns',
        'marketing_automations', 'automation_logs', 'email_logs',
        'membership_plans', 'platform_plans', 'waiver_templates', 'waiver_signatures',
        'class_pack_definitions', 'purchased_packs', 'coupons', 'coupon_redemptions',
        'sms_config', 'sms_logs', 'push_logs', 'substitutions', 'products',
        'suppliers', 'inventory_adjustments', 'purchase_orders', 'purchase_order_items',
        'pos_orders', 'referral_codes', 'referral_rewards', 'pos_order_items',
        'gift_cards', 'gift_card_transactions', 'leads', 'challenges',
        'user_challenges', 'progress_metric_definitions', 'member_progress_entries',
        'videos', 'processed_webhooks', 'waitlist', 'sub_requests', 'video_shares',
        'video_collections', 'video_collection_items', 'branding_assets',
        'referrals', 'member_tags', 'members_to_tags', 'custom_field_definitions',
        'custom_field_values', 'community_posts', 'community_comments',
        'community_likes', 'reviews', 'video_purchases',
        'quizzes', 'quiz_questions', 'quiz_submissions',
        'course_enrollments', 'courses', 'course_modules', 'course_access_codes',
        'course_prerequisites', 'articles', 'assignments', 'assignment_submissions',
        'course_comments', 'course_resources'
    ];

    for (const table of tables) {
        await d1.prepare(`DROP TABLE IF EXISTS ${table}`).run();
    }

    // 2. Create Tables with full production-equivalent schema
    await d1.batch([
        d1.prepare(`CREATE TABLE tenants (
            id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, 
            custom_domain TEXT UNIQUE, branding TEXT, mobile_app_config TEXT, settings TEXT, 
            custom_field_definitions TEXT, stripe_account_id TEXT, stripe_customer_id TEXT, 
            stripe_subscription_id TEXT, current_period_end INTEGER, marketing_provider TEXT DEFAULT 'system', 
            resend_credentials TEXT, twilio_credentials TEXT, flodesk_credentials TEXT, currency TEXT DEFAULT 'usd', 
            zoom_credentials TEXT, mailchimp_credentials TEXT, zapier_credentials TEXT, google_credentials TEXT, 
            slack_credentials TEXT, google_calendar_credentials TEXT, resend_audience_id TEXT, 
            status TEXT DEFAULT 'active', tier TEXT DEFAULT 'launch', subscription_status TEXT DEFAULT 'active', 
            is_public INTEGER DEFAULT 0, sms_usage INTEGER DEFAULT 0, email_usage INTEGER DEFAULT 0, 
            streaming_usage INTEGER DEFAULT 0, sms_limit INTEGER, email_limit INTEGER, streaming_limit INTEGER, 
            billing_exempt INTEGER DEFAULT 0, storage_usage INTEGER DEFAULT 0, member_count INTEGER DEFAULT 0, 
            instructor_count INTEGER DEFAULT 0, last_billed_at INTEGER, archived_at INTEGER, 
            grace_period_ends_at INTEGER, student_access_disabled INTEGER DEFAULT 0, 
            aggregator_config TEXT, is_test INTEGER DEFAULT 0 NOT NULL, created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`),

        d1.prepare(`CREATE TABLE users (
            id TEXT PRIMARY KEY, email TEXT NOT NULL, profile TEXT, 
            is_platform_admin INTEGER DEFAULT 0, role TEXT DEFAULT 'user', phone TEXT, 
            dob INTEGER, address TEXT, is_minor INTEGER DEFAULT 0, stripe_customer_id TEXT, 
            stripe_account_id TEXT, mfa_enabled INTEGER DEFAULT 0, push_token TEXT, 
            last_active_at INTEGER, last_location TEXT, created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`),

        d1.prepare(`CREATE TABLE tenant_members (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, user_id TEXT NOT NULL, 
            profile TEXT, settings TEXT, custom_fields TEXT, status TEXT DEFAULT 'active', 
            joined_at INTEGER DEFAULT (strftime('%s', 'now')), churn_score INTEGER DEFAULT 100, 
            churn_status TEXT DEFAULT 'safe', last_churn_check INTEGER, engagement_score INTEGER DEFAULT 50, 
            last_engagement_calc INTEGER, sms_consent INTEGER DEFAULT 0, sms_consent_at INTEGER, sms_opt_out_at INTEGER
        )`),

        d1.prepare(`CREATE TABLE tenant_roles (
            id TEXT PRIMARY KEY, member_id TEXT NOT NULL, role TEXT NOT NULL, 
            custom_role_id TEXT, permissions TEXT, created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`),

        d1.prepare(`CREATE TABLE locations (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL, address TEXT, 
            layout TEXT, timezone TEXT DEFAULT 'UTC', is_primary INTEGER DEFAULT 0, 
            settings TEXT, is_active INTEGER DEFAULT 1, created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`),

        d1.prepare(`CREATE TABLE classes (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, instructor_id TEXT, location_id TEXT, 
            series_id TEXT, title TEXT NOT NULL, description TEXT, start_time INTEGER NOT NULL, 
            duration_minutes INTEGER NOT NULL, capacity INTEGER, waitlist_capacity INTEGER DEFAULT 10, 
            price INTEGER DEFAULT 0, member_price INTEGER, currency TEXT DEFAULT 'usd', 
            payroll_model TEXT, payroll_value INTEGER, type TEXT DEFAULT 'class', 
            allow_credits INTEGER DEFAULT 1, included_plan_ids TEXT, zoom_meeting_url TEXT, 
            zoom_meeting_id TEXT, zoom_password TEXT, zoom_enabled INTEGER DEFAULT 0, 
            thumbnail_url TEXT, cloudflare_stream_id TEXT, recording_status TEXT, 
            video_provider TEXT DEFAULT 'offline', livekit_room_name TEXT, livekit_room_sid TEXT, 
            status TEXT DEFAULT 'active', min_students INTEGER DEFAULT 1, 
            auto_cancel_threshold INTEGER, auto_cancel_enabled INTEGER DEFAULT 0, 
            recording_price INTEGER,
            is_recording_sellable INTEGER DEFAULT 0,
            is_course INTEGER DEFAULT 0,
            content_collection_id TEXT,
            course_id TEXT,
            google_event_id TEXT,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`),

        d1.prepare(`CREATE TABLE bookings (
            id TEXT PRIMARY KEY, class_id TEXT NOT NULL, member_id TEXT NOT NULL, 
            status TEXT DEFAULT 'confirmed', attendance_type TEXT DEFAULT 'in_person', 
            checked_in_at INTEGER, is_guest INTEGER DEFAULT 0, guest_name TEXT, guest_email TEXT, 
            spot_number TEXT, waitlist_position INTEGER, waitlist_notified_at INTEGER, 
            payment_method TEXT, used_pack_id TEXT, external_source TEXT, external_id TEXT, 
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`),
        d1.prepare(`CREATE TABLE video_purchases (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, user_id TEXT NOT NULL, 
            class_id TEXT NOT NULL, price_paid INTEGER NOT NULL DEFAULT 0, 
            stripe_payment_id TEXT, created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`),
    ]);

    await d1.batch([
        d1.prepare(`CREATE TABLE membership_plans (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT, 
            price INTEGER DEFAULT 0, currency TEXT DEFAULT 'usd', "interval" TEXT DEFAULT 'month', 
            image_url TEXT, overlay_title TEXT, overlay_subtitle TEXT, vod_enabled INTEGER DEFAULT 0, 
            active INTEGER DEFAULT 1, stripe_product_id TEXT, stripe_price_id TEXT,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`),

        d1.prepare(`CREATE TABLE subscriptions (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, tenant_id TEXT NOT NULL, 
            member_id TEXT, plan_id TEXT, status TEXT NOT NULL, tier TEXT DEFAULT 'basic', 
            current_period_end INTEGER, stripe_subscription_id TEXT, canceled_at INTEGER, 
            dunning_state TEXT, last_dunning_at INTEGER, created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`),


        d1.prepare(`CREATE TABLE class_pack_definitions (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL, 
            price INTEGER DEFAULT 0, credits INTEGER NOT NULL, expiration_days INTEGER, 
            image_url TEXT, vod_enabled INTEGER DEFAULT 0, active INTEGER DEFAULT 1, 
            stripe_product_id TEXT, stripe_price_id TEXT,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`),

        d1.prepare(`CREATE TABLE purchased_packs (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, member_id TEXT NOT NULL, 
            pack_definition_id TEXT NOT NULL, initial_credits INTEGER NOT NULL, 
            remaining_credits INTEGER NOT NULL, purchased_price_cents INTEGER DEFAULT 0, 
            status TEXT DEFAULT 'active', stripe_payment_id TEXT, expires_at INTEGER, 
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`),

        d1.prepare(`CREATE TABLE challenges (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, title TEXT NOT NULL, 
            description TEXT, type TEXT NOT NULL, period TEXT, frequency INTEGER DEFAULT 1, 
            target_value INTEGER NOT NULL, reward_type TEXT NOT NULL, reward_value TEXT, 
            start_date INTEGER, end_date INTEGER, active INTEGER DEFAULT 1, 
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`),

        d1.prepare(`CREATE TABLE user_challenges (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, user_id TEXT NOT NULL, 
            challenge_id TEXT NOT NULL, progress INTEGER DEFAULT 0, status TEXT DEFAULT 'active', 
            metadata TEXT, completed_at INTEGER, created_at INTEGER DEFAULT (strftime('%s', 'now')), 
            updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`),
    ]);

    await d1.batch([
        d1.prepare(`CREATE TABLE referral_codes (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, user_id TEXT NOT NULL, 
            member_id TEXT, code TEXT NOT NULL, clicks INTEGER DEFAULT 0, 
            signups INTEGER DEFAULT 0, earnings INTEGER DEFAULT 0, 
            created_at INTEGER DEFAULT (strftime('%s', 'now')), active INTEGER DEFAULT 1
        )`),

        d1.prepare(`CREATE TABLE pos_orders (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, member_id TEXT, 
            staff_id TEXT, total_amount INTEGER NOT NULL, tax_amount INTEGER DEFAULT 0, 
            status TEXT DEFAULT 'completed', payment_method TEXT DEFAULT 'card', 
            stripe_payment_intent_id TEXT, created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`),

        d1.prepare(`CREATE TABLE pos_order_items (
            id TEXT PRIMARY KEY, order_id TEXT NOT NULL, product_id TEXT NOT NULL, 
            quantity INTEGER NOT NULL, unit_price INTEGER NOT NULL, 
            total_price INTEGER NOT NULL
        )`),

        d1.prepare(`CREATE TABLE referral_rewards (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, referrer_user_id TEXT NOT NULL, 
            referred_user_id TEXT NOT NULL, status TEXT DEFAULT 'pending', amount INTEGER NOT NULL, 
            currency TEXT DEFAULT 'usd', paid_at INTEGER, created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`),

        d1.prepare(`CREATE TABLE gift_cards (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, code TEXT NOT NULL, 
            initial_value INTEGER NOT NULL, current_balance INTEGER NOT NULL, 
            status TEXT DEFAULT 'active', expiry_date INTEGER, buyer_member_id TEXT, 
            stripe_payment_id TEXT, recipient_member_id TEXT, recipient_email TEXT, 
            notes TEXT, created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000), 
            updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
        )`),

        d1.prepare(`CREATE TABLE gift_card_transactions (
            id TEXT PRIMARY KEY, gift_card_id TEXT NOT NULL, amount INTEGER NOT NULL, 
            type TEXT NOT NULL, reference_id TEXT, created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
        )`),

        d1.prepare(`CREATE TABLE marketing_automations (
            id TEXT PRIMARY KEY, tenant_id TEXT, trigger_event TEXT NOT NULL, 
            trigger_condition TEXT, template_id TEXT, audience_filter TEXT, 
            subject TEXT NOT NULL, content TEXT, is_enabled INTEGER DEFAULT 0, 
            metadata TEXT, timing_type TEXT DEFAULT 'immediate', timing_value INTEGER DEFAULT 0, 
            delay_hours INTEGER DEFAULT 0, channels TEXT DEFAULT '["email"]', 
            recipients TEXT DEFAULT '["student"]', coupon_config TEXT, 
            created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000), 
            updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
        )`),

        d1.prepare(`CREATE TABLE email_logs (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, campaign_id TEXT, 
            recipient_email TEXT NOT NULL, subject TEXT NOT NULL, template_id TEXT, 
            data TEXT, status TEXT DEFAULT 'sent', error TEXT, 
            sent_at INTEGER DEFAULT (strftime('%s', 'now') * 1000), metadata TEXT
        )`),

        d1.prepare(`CREATE TABLE audit_logs (
            id TEXT PRIMARY KEY, actor_id TEXT, tenant_id TEXT, action TEXT NOT NULL, 
            target_id TEXT, target_type TEXT, details TEXT, ip_address TEXT, 
            country TEXT, city TEXT, region TEXT, created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
        )`),

        d1.prepare(`CREATE TABLE processed_webhooks (
            id TEXT PRIMARY KEY, type TEXT NOT NULL, created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
        )`),

        d1.prepare(`CREATE TABLE webhook_endpoints (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, url TEXT NOT NULL, 
            secret TEXT NOT NULL, events TEXT NOT NULL, is_active INTEGER DEFAULT 1, 
            description TEXT, created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
            updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
        )`),

        d1.prepare(`CREATE TABLE tenant_features (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, feature_key TEXT NOT NULL, 
            enabled INTEGER DEFAULT 0, source TEXT DEFAULT 'manual', 
            updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
        )`),
    ]);

    await d1.batch([
        d1.prepare(`CREATE TABLE custom_roles (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL, 
            description TEXT, permissions TEXT NOT NULL, 
            created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
        )`),

        d1.prepare(`CREATE TABLE member_custom_roles (
            id TEXT PRIMARY KEY, member_id TEXT NOT NULL, custom_role_id TEXT NOT NULL, 
            tenant_id TEXT NOT NULL, created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
        )`),

        d1.prepare(`CREATE TABLE automation_logs (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, automation_id TEXT NOT NULL, 
            user_id TEXT NOT NULL, channel TEXT NOT NULL, metadata TEXT, 
            triggered_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
        )`),

        d1.prepare(`CREATE TABLE platform_config (
            key TEXT PRIMARY KEY, value TEXT, enabled INTEGER DEFAULT 1, 
            description TEXT, updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
        )`),

        d1.prepare(`CREATE TABLE class_series (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, title TEXT NOT NULL, 
            description TEXT, instructor_id TEXT, location_id TEXT, 
            schedule_config TEXT, status TEXT DEFAULT 'active', 
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`),

        d1.prepare(`CREATE TABLE waitlist (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, class_id TEXT NOT NULL, 
            user_id TEXT NOT NULL, position INTEGER NOT NULL, 
            status TEXT DEFAULT 'pending', offer_expires_at INTEGER, 
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`),

        d1.prepare(`CREATE TABLE appointment_services (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, title TEXT NOT NULL, 
            description TEXT, duration_minutes INTEGER NOT NULL, 
            price INTEGER DEFAULT 0, currency TEXT DEFAULT 'usd', 
            is_active INTEGER DEFAULT 1, created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`),

        d1.prepare(`CREATE TABLE appointments (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, service_id TEXT NOT NULL, 
            instructor_id TEXT NOT NULL, member_id TEXT NOT NULL, 
            start_time INTEGER NOT NULL, end_time INTEGER NOT NULL, 
            status TEXT DEFAULT 'confirmed', location_id TEXT, notes TEXT, 
            zoom_meeting_url TEXT, google_event_id TEXT, 
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`),

        d1.prepare(`CREATE TABLE progress_metric_definitions (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL, 
            category TEXT NOT NULL, unit TEXT NOT NULL, icon TEXT, 
            aggregation TEXT DEFAULT 'sum', visible_to_students INTEGER DEFAULT 1, 
            active INTEGER DEFAULT 1, display_order INTEGER DEFAULT 0, 
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`),

        d1.prepare(`CREATE TABLE payroll_config (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, member_id TEXT, 
            user_id TEXT NOT NULL, pay_model TEXT NOT NULL, rate INTEGER NOT NULL, 
            payout_basis TEXT DEFAULT 'net', created_at INTEGER DEFAULT (strftime('%s', 'now')), 
            updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`),

        d1.prepare(`CREATE TABLE payouts (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, instructor_id TEXT NOT NULL, 
            amount INTEGER NOT NULL, currency TEXT DEFAULT 'usd', 
            period_start INTEGER NOT NULL, period_end INTEGER NOT NULL, 
            status TEXT DEFAULT 'processing', paid_at INTEGER, 
            stripe_transfer_id TEXT, notes TEXT, 
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`),

        d1.prepare(`CREATE TABLE videos (
            id TEXT PRIMARY KEY, tenant_id TEXT, title TEXT NOT NULL, description TEXT, 
            r2_key TEXT NOT NULL, cloudflare_stream_id TEXT, duration INTEGER DEFAULT 0, 
            width INTEGER, height INTEGER, size_bytes INTEGER DEFAULT 0, 
            status TEXT DEFAULT 'processing', source TEXT DEFAULT 'upload', 
            video_provider TEXT DEFAULT 'offline', livekit_room_name TEXT, livekit_room_sid TEXT, 
            trim_start INTEGER, trim_end INTEGER, created_at INTEGER DEFAULT (strftime('%s', 'now')), 
            updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`),

        d1.prepare(`CREATE TABLE video_collections (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, title TEXT NOT NULL, 
            description TEXT, slug TEXT NOT NULL, 
            created_at INTEGER DEFAULT (strftime('%s', 'now')), 
            updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`)
    ]);

    await d1.prepare(`CREATE TABLE video_collection_items (
        id TEXT PRIMARY KEY,
        collection_id TEXT NOT NULL,
        content_type TEXT DEFAULT 'video' NOT NULL,
        video_id TEXT,
        quiz_id TEXT,
        article_id TEXT,
        assignment_id TEXT,
        "order" INTEGER DEFAULT 0,
        module_id TEXT,
        release_after_days INTEGER,
        is_required INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`).run();

    await d1.prepare(`CREATE TABLE quizzes (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        randomize_order INTEGER DEFAULT 0,
        passing_score INTEGER DEFAULT 0,
        active INTEGER DEFAULT 1,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`).run();

    await d1.prepare(`CREATE TABLE quiz_questions (
        id TEXT PRIMARY KEY,
        quiz_id TEXT NOT NULL,
        question_text TEXT NOT NULL,
        question_type TEXT NOT NULL,
        options TEXT, -- JSON
        correct_answer TEXT NOT NULL,
        explanation TEXT,
        points INTEGER DEFAULT 1,
        "order" INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`).run();

    await d1.prepare(`CREATE TABLE quiz_submissions (
        id TEXT PRIMARY KEY,
        quiz_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        score INTEGER NOT NULL,
        passed INTEGER NOT NULL,
        answers TEXT NOT NULL, -- JSON
        finished_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`).run();

    await d1.prepare(`CREATE TABLE courses (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        slug TEXT NOT NULL,
        thumbnail_url TEXT,
        price INTEGER DEFAULT 0,
        member_price INTEGER,
        status TEXT DEFAULT 'draft' NOT NULL,
        is_public INTEGER DEFAULT 0 NOT NULL,
        content_collection_id TEXT,
        delivery_mode TEXT DEFAULT 'self_paced',
        cohort_start_date INTEGER,
        cohort_end_date INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`).run();

    await d1.prepare(`CREATE TABLE course_modules (
        id TEXT PRIMARY KEY,
        course_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        "order" INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )`).run();

    await d1.prepare(`CREATE TABLE course_access_codes (
        id TEXT PRIMARY KEY,
        course_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        code TEXT NOT NULL,
        max_uses INTEGER,
        used_count INTEGER NOT NULL DEFAULT 0,
        expires_at INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        UNIQUE(course_id, code)
    )`).run();

    await d1.prepare(`CREATE TABLE course_enrollments (
        id TEXT PRIMARY KEY,
        course_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        status TEXT DEFAULT 'active' NOT NULL,
        progress INTEGER DEFAULT 0,
        enrolled_at INTEGER DEFAULT (strftime('%s', 'now')),
        completed_at INTEGER,
        UNIQUE(user_id, course_id)
    )`).run();

    await d1.prepare(`CREATE TABLE course_prerequisites (
        course_id TEXT NOT NULL,
        prerequisite_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY (course_id, prerequisite_id)
    )`).run();

    await d1.batch([
        d1.prepare(`CREATE TABLE articles (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            title TEXT NOT NULL,
            html TEXT,
            content TEXT,
            reading_time_minutes INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`),
        d1.prepare(`CREATE TABLE assignments (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            instructions_html TEXT,
            require_file_upload INTEGER DEFAULT 0,
            points_available INTEGER DEFAULT 100,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`),
        d1.prepare(`CREATE TABLE assignment_submissions (
            id TEXT PRIMARY KEY,
            assignment_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            tenant_id TEXT NOT NULL,
            content TEXT,
            file_url TEXT,
            status TEXT DEFAULT 'submitted',
            grade INTEGER,
            feedback_html TEXT,
            submitted_at INTEGER DEFAULT (strftime('%s', 'now')),
            graded_at INTEGER
        )`),
        d1.prepare(`CREATE TABLE course_comments (
            id TEXT PRIMARY KEY,
            course_id TEXT NOT NULL,
            collection_item_id TEXT NOT NULL,
            author_id TEXT NOT NULL,
            tenant_id TEXT NOT NULL,
            content TEXT NOT NULL,
            parent_id TEXT,
            is_pinned INTEGER DEFAULT 0,
            is_approved INTEGER DEFAULT 1,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`),
        d1.prepare(`CREATE TABLE course_resources (
            id TEXT PRIMARY KEY,
            collection_item_id TEXT NOT NULL,
            tenant_id TEXT NOT NULL,
            title TEXT NOT NULL,
            url TEXT,
            r2_key TEXT,
            file_type TEXT,
            size_bytes INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`)
    ]);

    return db;
}
