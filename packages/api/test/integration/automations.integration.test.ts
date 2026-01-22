
import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { AutomationsService } from '../../src/services/automations';
import { EmailService } from '../../src/services/email';
import { createDb } from '../../src/db';
import { v4 as uuidv4 } from 'uuid';
import { bookings } from 'db/src/schema';

describe('Automations Integration', () => {
    const TENANT_ID = 'auto_tenant_1';
    const USER_ID = 'auto_user_1';
    const MEMBER_ID = 'auto_member_1';

    // Automation IDs
    const AUTO_DELAY_ID = 'auto_delay_1';

    let db: any;

    beforeAll(async () => {
        db = createDb(env.DB);

        // 1. Cleanup & Schema Setup
        // We drop relevant tables to ensure clean state
        await env.DB.batch([
            env.DB.prepare('DROP TABLE IF EXISTS marketing_automations'),
            env.DB.prepare('DROP TABLE IF EXISTS email_logs'),
            env.DB.prepare('DROP TABLE IF EXISTS automation_logs'),
            env.DB.prepare('DROP TABLE IF EXISTS users'),
            env.DB.prepare('DROP TABLE IF EXISTS tenants'),
            env.DB.prepare('DROP TABLE IF EXISTS tenant_members'),
            env.DB.prepare('DROP TABLE IF EXISTS bookings'),
            env.DB.prepare('DROP TABLE IF EXISTS classes'),
        ]);

        await env.DB.batch([
            env.DB.prepare(`CREATE TABLE tenants (
                id TEXT PRIMARY KEY, slug TEXT, name TEXT, status TEXT, branding TEXT, settings TEXT, mobile_app_config TEXT,
                stripe_credentials TEXT, resend_credentials TEXT, twilio_credentials TEXT, flodesk_credentials TEXT,
                zoom_credentials TEXT, mailchimp_credentials TEXT, zapier_credentials TEXT, google_credentials TEXT,
                slack_credentials TEXT
            )`),
            env.DB.prepare(`CREATE TABLE locations (id TEXT PRIMARY KEY, tenant_id TEXT, name TEXT, layout TEXT, settings TEXT, address TEXT)`),
            env.DB.prepare(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, profile TEXT, last_location TEXT)`),
            env.DB.prepare(`CREATE TABLE tenant_members (id TEXT PRIMARY KEY, tenant_id TEXT, user_id TEXT, status TEXT, joined_at INTEGER, profile TEXT, settings TEXT)`),
            env.DB.prepare(`CREATE TABLE classes (
                id TEXT PRIMARY KEY, tenant_id TEXT, instructor_id TEXT, location_id TEXT, series_id TEXT, title TEXT,
                description TEXT, start_time INTEGER, duration_minutes INTEGER, capacity INTEGER, price INTEGER,
                member_price INTEGER, currency TEXT, type TEXT, allow_credits INTEGER, included_plan_ids TEXT,
                zoom_meeting_url TEXT, zoom_meeting_id TEXT, zoom_password TEXT, zoom_enabled INTEGER,
                thumbnail_url TEXT, cloudflare_stream_id TEXT, recording_status TEXT, video_provider TEXT,
                livekit_room_name TEXT, livekit_room_sid TEXT, status TEXT, min_students INTEGER,
                auto_cancel_threshold INTEGER, auto_cancel_enabled INTEGER, google_event_id TEXT, created_at INTEGER
            )`),
            env.DB.prepare(`CREATE TABLE class_series (
                id TEXT PRIMARY KEY, tenant_id TEXT, instructor_id TEXT, location_id TEXT, title TEXT,
                description TEXT, duration_minutes INTEGER, price INTEGER, currency TEXT, recurrence_rule TEXT,
                valid_from INTEGER, valid_until INTEGER, created_at INTEGER
            )`),

        ]);

        // Fix Bookings Table Create
        await env.DB.prepare(`CREATE TABLE bookings (
            id TEXT PRIMARY KEY, class_id TEXT, member_id TEXT, status TEXT, created_at INTEGER,
            attendance_type TEXT, is_guest INTEGER, guest_name TEXT, guest_email TEXT, spot_number TEXT,
            waitlist_position INTEGER, waitlist_notified_at INTEGER, payment_method TEXT, used_pack_id TEXT, checked_in_at INTEGER
        )`).run();

        await env.DB.batch([
            env.DB.prepare(`CREATE TABLE marketing_automations (
                id TEXT PRIMARY KEY, tenant_id TEXT, trigger_event TEXT, subject TEXT, content TEXT, 
                is_enabled INTEGER, timing_type TEXT, timing_value INTEGER, channels TEXT, 
                created_at INTEGER, updated_at INTEGER, trigger_condition TEXT,
                template_id TEXT, audience_filter TEXT, coupon_config TEXT,
                metadata TEXT, delay_hours INTEGER
            )`),
            env.DB.prepare(`CREATE TABLE email_logs (
                 id TEXT PRIMARY KEY, tenant_id TEXT, recipient_email TEXT, subject TEXT, 
                 status TEXT, metadata TEXT, sent_at INTEGER, error TEXT, template_id TEXT, data TEXT, campaign_id TEXT
             )`),
            env.DB.prepare(`CREATE TABLE automation_logs (
                 id TEXT PRIMARY KEY, tenant_id TEXT, automation_id TEXT, user_id TEXT, channel TEXT, triggered_at INTEGER, metadata TEXT
             )`),
            env.DB.prepare(`CREATE UNIQUE INDEX automation_log_unique_idx ON automation_logs(automation_id, user_id, channel)`),
        ]);

        // 2. Seed Data
        await env.DB.prepare(`INSERT INTO tenants (
            id, slug, name, status, branding, settings, mobile_app_config,
            stripe_credentials, resend_credentials, twilio_credentials, flodesk_credentials,
            zoom_credentials, mailchimp_credentials, zapier_credentials, google_credentials, slack_credentials
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
            TENANT_ID, 'autostudio', 'Auto Studio', 'active', '{}', '{}', '{}',
            '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}', '{}'
        ).run();

        await env.DB.prepare(`INSERT INTO locations (id, tenant_id, name, layout, settings) VALUES (?, ?, ?, ?, ?)`).bind(
            'loc_1', TENANT_ID, 'Main Studio', '{}', '{}'
        ).run();
        await env.DB.prepare(`INSERT INTO users (id, email, profile, last_location) VALUES (?, ?, ?, ?)`).bind(USER_ID, 'test@example.com', JSON.stringify({ firstName: 'Tester' }), '{}').run();
        await env.DB.prepare(`INSERT INTO tenant_members (id, tenant_id, user_id, status, joined_at, profile, settings) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(MEMBER_ID, TENANT_ID, USER_ID, 'active', Date.now(), '{}', '{}').run();

        // Class
        await env.DB.prepare(`INSERT INTO classes (id, tenant_id, series_id) VALUES (?, ?, ?)`).bind('class_1', TENANT_ID, null).run();

        // Delayed Automation (Class Booked, 1 Hour Delay)
        // timingValue = 1 (hour)
        await env.DB.prepare(`INSERT INTO marketing_automations (id, tenant_id, trigger_event, subject, content, is_enabled, timing_type, timing_value, channels) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
            AUTO_DELAY_ID, TENANT_ID, 'class_booked', 'Class Followup', 'Thanks for booking!', 1, 'delay', 1, JSON.stringify(['email'])
        ).run();

    });

    it('should process delayed class_booked trigger', async () => {
        // 1. Create a logical "past" booking.
        // Delay is 1 hour.
        // We want now - created_at = 1 hour (approx).
        // created_at = now - 60 mins.
        // processDelayedTriggers checks: ge(createdAt, now - 1h) AND le(createdAt, now - 1h + 1h).
        // So targetTime = now - 60min. Window = now.
        // If we create booking at now - 30min? No, ge(30minAgo, 60minAgo) is true. le(30minAgo, 0minAgo) is true?
        // Wait. targetTime = now - 1h. WindowEnd = now.
        // ge(createdAt, now - 60min) -> createdAt >= now - 60min.
        // le(createdAt, now) -> createdAt <= now.
        // So if booking was created 30 mins ago, it triggers?
        // Yes, "delayed" implies "it happened within the delay window"?
        // Wait, typical delay logic: "Send email X hours AFTER event".
        // My logic checks if event happened X hours ago?
        // Let's re-read code:
        // targetTime = now - delay.
        // windowEnd = targetTime + 1h.
        // query: createdAt >= targetTime AND createdAt <= windowEnd.
        // So booking must be created BETWEEN (now - delay) and (now - delay + 1h).
        // i.e. Booking happened "Delay hours ago" (within a 1 hour processing window).

        // So for 1 hour delay: Booking must be created between [Now - 1h] and [Now].
        // Wait.
        // If Delay = 1h.
        // Target = Now - 1h.
        // WindowEnd = Now - 1h + 1h = Now?
        // Yes.
        // So if booking created 30 mins ago (which is > Now-1h and < Now):
        // It triggers.
        // Doesn't that mean it triggers "too early" for a 30 min old booking if delay is 1h?
        // If I want to wait 1 hour, I should strictly look for things created AROUND (Now - 1h).
        // My window is [Now - 1h, Now].
        // This effectively means "Any time in the last hour up to 1 hour ago".
        // This is weird. Usually "Delay" checks "Is age > delay?".

        // Let's check my logic in automations.ts again.
        // targetTime = now - delay.
        // windowEnd = targetTime + 1h.
        // Checking for event at (now - delay).
        // If booking created at (now - 30m).
        // (now - 30m) >= (now - 60m) -> TRUE.
        // (now - 30m) <= (now) -> TRUE.
        // So it triggers at 30 minutes!

        // FIX: The window size might be intentional to catch things we missed?
        // But if I run Cron every 15 mins.
        // Run 1: T=0. Checks [T-60, T]. Finds booking B (created T-30). Sends.
        // Run 2: T=15. Checks [T-45, T+15]. Finds booking B (created T-15). Sends AGAIN?
        // Ah, AutomationLogs unique index prevents duplicate sends!
        // So it sends "ASAP after delay threshold passed"?
        // If I use >= TargetTime... TargetTime is "Time of Event Limit".
        // If Delay is 1h. I want to send IF (Now - CreatedAt) >= 1h.
        // i.e. CreatedAt <= Now - 1h.

        // My code: `gte(createdAt, targetTime)` means `createdAt >= Now - 1h`.
        // This captures recent events (younger than 1h).
        // This is logic for "Within the last hour".
        // This is logic for "Immediate" (or close to it), NOT Delay.
        // "Delay 1 hour" should mean "Wait until it is 1 hour old".
        // So I should look for items OLDER than 1h.
        // `lte(createdAt, Now - 1h)`.

        // Oops. My logic in `automations.ts` might be INVERTED or I misunderstood "Delay".
        // If code searches `gte(createdAt, Now - Delay)`, it finds items created RECENTLY.
        // So "Delay 1 hour" currently processes items created in last 1 hour.
        // This effectively makes it "Immediate but processed by Cron".

        // User intent for "Delay 30 days" (Birthday/Absent) -> Send 30 days AFTER last visit.
        // If I use `gte(visit, now - 30d)`, I find visits in last 30 days.
        // If I check last visit was > 30 days ago, I need `lte`.

        // I should fix the logic AND test it.
        // The integration test will expose this! 
        // If I insert booking created 2 hours ago (older than 1h), and logic is `gte(now-1h)`, it won't find it.
        // And if test fails, I confirm logic bug.

        // Let's proceed with test assuming correct behavior (Delay means >= 1h old).
        // Setup Booking: 90 mins ago. (Delay 1h).
        // Expectation: Should send.

        const ninetyMinsAgo = new Date(Date.now() - (90 * 60 * 1000));
        await db.insert(bookings).values({
            id: 'booking_old',
            classId: 'class_1',
            memberId: MEMBER_ID,
            status: 'confirmed',
            createdAt: ninetyMinsAgo
        }).run();

        // 2. Run Service
        const emailService = new EmailService('re_mock_key', {}, { slug: 'autostudio' }, undefined, false, db, TENANT_ID);
        // We mock DB by passing the one created from env
        const service = new AutomationsService(db, TENANT_ID, emailService);

        await service.processTimeBasedAutomations();



        // 3. Check Logs
        const logs = await env.DB.prepare('SELECT * FROM email_logs').all();
        // If my logic is GTE (searching recent), it will NOT find 90min old booking.
        // If it finds it, logic is "Older than".

        // If logic is broken, logs.results.length === 0.
        // I expect it might be 0 with current code.
        // I will assert 1, and if it fails, I fix the code.
        expect(logs.results.length).toBe(1);
        expect(logs.results[0].recipient_email).toBe('test@example.com');
        // Status might be sent or failed depending on Resend mock behavior
        expect(['sent', 'failed']).toContain(logs.results[0].status);
    });
});
