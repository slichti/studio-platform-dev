import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDb } from '../db';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '@studio/db/src/schema';
import { eq, sql } from 'drizzle-orm';
import { OpenAPIHono } from '@hono/zod-openapi';
import { StudioVariables, HonoContext } from '../types';
import app from './classes.schedules';
import membersApp from './members';

const tenantId = 'test_tenant';
const slug = 'test-studio';
const instructorId = 'instr_123';

let mockDb: any;

vi.mock('../db', () => ({
    createDb: () => mockDb
}));

describe('Debug Fixes Verification', () => {
    let sqlite: Database.Database;
    let env: any;

    beforeEach(async () => {
        sqlite = new Database(':memory:');
        mockDb = drizzle(sqlite, { schema });

        // Polyfill batch for tests (UsageService uses it)
        mockDb.batch = async (queries: any[]) => {
            return Promise.all(queries);
        };

        // Minimal schema setup for tests matching production
        sqlite.exec(`CREATE TABLE tenants (
            id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, custom_domain TEXT UNIQUE, branding TEXT,
            mobile_app_config TEXT, settings TEXT, custom_field_definitions TEXT, stripe_account_id TEXT, stripe_customer_id TEXT,
            stripe_subscription_id TEXT, current_period_end INTEGER, marketing_provider TEXT DEFAULT 'system' NOT NULL,
            resend_credentials TEXT, twilio_credentials TEXT, flodesk_credentials TEXT, currency TEXT DEFAULT 'usd' NOT NULL,
            zoom_credentials TEXT, mailchimp_credentials TEXT, zapier_credentials TEXT, google_credentials TEXT,
            slack_credentials TEXT, google_calendar_credentials TEXT, resend_audience_id TEXT, status TEXT DEFAULT 'active' NOT NULL,
            tier TEXT DEFAULT 'launch' NOT NULL, subscription_status TEXT DEFAULT 'active' NOT NULL, is_public INTEGER DEFAULT 0 NOT NULL,
            sms_usage INTEGER DEFAULT 0 NOT NULL, email_usage INTEGER DEFAULT 0 NOT NULL, streaming_usage INTEGER DEFAULT 0 NOT NULL,
            sms_limit INTEGER, email_limit INTEGER, streaming_limit INTEGER, billing_exempt INTEGER DEFAULT 0 NOT NULL,
            storage_usage INTEGER DEFAULT 0 NOT NULL, member_count INTEGER DEFAULT 0 NOT NULL, instructor_count INTEGER DEFAULT 0 NOT NULL,
            last_billed_at INTEGER, archived_at INTEGER, grace_period_ends_at INTEGER, student_access_disabled INTEGER DEFAULT 0 NOT NULL,
            aggregator_config TEXT, is_test INTEGER DEFAULT 0 NOT NULL, created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`);
        sqlite.exec(`CREATE TABLE users (
            id TEXT PRIMARY KEY, email TEXT NOT NULL, profile TEXT, is_platform_admin INTEGER DEFAULT 0,
            role TEXT DEFAULT 'user' NOT NULL, phone TEXT, dob INTEGER, address TEXT, is_minor INTEGER DEFAULT 0,
            stripe_customer_id TEXT, stripe_account_id TEXT, mfa_enabled INTEGER DEFAULT 0, push_token TEXT,
            last_active_at INTEGER, last_location TEXT, created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`);
        sqlite.exec(`CREATE TABLE tenant_members (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, user_id TEXT NOT NULL, profile TEXT, settings TEXT,
            custom_fields TEXT, status TEXT DEFAULT 'active' NOT NULL, joined_at INTEGER DEFAULT (strftime('%s', 'now')),
            churn_score INTEGER DEFAULT 100, churn_status TEXT DEFAULT 'safe',
            last_churn_check INTEGER, engagement_score INTEGER DEFAULT 50, last_engagement_calc INTEGER,
            sms_consent INTEGER DEFAULT 0, sms_consent_at INTEGER, sms_opt_out_at INTEGER
        )`);
        sqlite.exec(`CREATE TABLE tenant_roles (
            id TEXT PRIMARY KEY, member_id TEXT NOT NULL,
            role TEXT NOT NULL, custom_role_id TEXT,
            permissions TEXT, created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`);
        sqlite.exec(`CREATE TABLE class_series (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, instructor_id TEXT NOT NULL, location_id TEXT,
            title TEXT NOT NULL, description TEXT, duration_minutes INTEGER NOT NULL,
            price INTEGER DEFAULT 0, currency TEXT DEFAULT 'usd', recurrence_rule TEXT NOT NULL, 
            valid_from INTEGER NOT NULL, valid_until INTEGER, created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`);
        sqlite.exec(`CREATE TABLE classes (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, instructor_id TEXT, location_id TEXT, series_id TEXT,
            title TEXT NOT NULL, description TEXT, start_time INTEGER NOT NULL, duration_minutes INTEGER NOT NULL,
            capacity INTEGER, waitlist_capacity INTEGER DEFAULT 10, price INTEGER DEFAULT 0, member_price INTEGER,
            currency TEXT DEFAULT 'usd' NOT NULL, payroll_model TEXT, payroll_value INTEGER, type TEXT DEFAULT 'class' NOT NULL,
            allow_credits INTEGER DEFAULT 1, included_plan_ids TEXT, zoom_meeting_url TEXT, zoom_meeting_id TEXT,
            zoom_password TEXT, zoom_enabled INTEGER DEFAULT 0, thumbnail_url TEXT, cloudflare_stream_id TEXT,
            recording_status TEXT, video_provider TEXT DEFAULT 'offline', livekit_room_name TEXT, livekit_room_sid TEXT,
            status TEXT DEFAULT 'active' NOT NULL, min_students INTEGER DEFAULT 1, auto_cancel_threshold INTEGER,
            auto_cancel_enabled INTEGER DEFAULT 0, 
            recording_price INTEGER,
            is_recording_sellable INTEGER DEFAULT 0,
            is_course INTEGER DEFAULT 0,
            content_collection_id TEXT,
            course_id TEXT,
            google_event_id TEXT, created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`);
        sqlite.exec(`CREATE TABLE locations (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL, address TEXT, capacity INTEGER, 
            timezone TEXT, layout TEXT, settings TEXT, created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`);
        sqlite.exec(`CREATE TABLE appointments (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, service_id TEXT NOT NULL, member_id TEXT NOT NULL, 
            title TEXT NOT NULL, start_time INTEGER NOT NULL, end_time INTEGER NOT NULL,
            instructor_id TEXT, location_id TEXT, status TEXT DEFAULT 'confirmed', notes TEXT,
            zoom_meeting_url TEXT, google_event_id TEXT, created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )`);

        await mockDb.insert(schema.tenants).values({
            id: tenantId,
            slug: slug,
            name: 'Test Studio',
            tier: 'growth',
            status: 'active',
            subscriptionStatus: 'active'
        }).run();

        await mockDb.insert(schema.users).values({
            id: 'user_123',
            email: 'instructor@test.com',
            profile: { firstName: 'Test', lastName: 'Instructor' }
        }).run();

        await mockDb.insert(schema.tenantMembers).values({
            id: instructorId,
            tenantId,
            userId: 'user_123',
            status: 'active',
            joinedAt: new Date()
        }).run();

        await mockDb.insert(schema.tenantRoles).values({
            id: 'role_123',
            memberId: instructorId,
            role: 'instructor'
        }).run();

        env = {
            DB: { prepare: () => ({ bind: () => ({ all: () => [], get: () => null, run: () => ({ meta: { changes: 0 } }) }) }) } as any,
            ENCRYPTION_SECRET: 'test_secret',
            RESEND_API_KEY: 'test_key'
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should create a recurring class series and individual classes', async () => {
        const testApp = new OpenAPIHono<HonoContext>();
        testApp.use(async (c: any, next: any) => {
            c.set('tenant', { id: tenantId, slug: slug, tier: 'growth' } as any);
            c.set('can', () => true);
            c.set('features', new Set(['zoom']));
            await next();
        });
        testApp.route('/', app);
        testApp.onError((err, c) => {
            return c.text(err.message, 500);
        });

        const startTime = new Date();
        startTime.setHours(10, 0, 0, 0);
        startTime.setDate(startTime.getDate() + 1);

        const res = await testApp.request('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: 'Recurring Yoga',
                startTime: startTime.toISOString(),
                durationMinutes: 60,
                instructorId: instructorId,
                isRecurring: true,
                recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO,WE',
                recurrenceEnd: new Date(startTime.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                type: 'class'
            })
        }, env);

        if (res.status !== 201) {
            const body = await res.text();
            throw new Error(`Create Class Failed with ${res.status}: ${body}`);
        }
        const data: any = await res.json();
        expect(data.seriesId).toBeDefined();
        expect(data.classes).toBeGreaterThan(1);

        const series = await mockDb.select().from(schema.classSeries).where(eq(schema.classSeries.id, data.seriesId)).get();
        expect(series).toBeDefined();
        expect(series.recurrenceRule).toBe('FREQ=WEEKLY;BYDAY=MO,WE');

        const classes = await mockDb.select().from(schema.classes).where(eq(schema.classes.seriesId, data.seriesId)).all();
        expect(classes.length).toBe(data.classes);
    });

    it('should filter members by role without 500ing', async () => {
        const testMembersApp = new OpenAPIHono<HonoContext>();
        testMembersApp.use(async (c: any, next: any) => {
            c.set('tenant', { id: tenantId } as any);
            c.set('can', (p: string) => p === 'manage_members');
            await next();
        });
        testMembersApp.route('/', membersApp);
        testMembersApp.onError((err, c) => {
            return c.text(err.message, 500);
        });

        const res = await testMembersApp.request('/?role=instructor', {
            method: 'GET'
        }, env);

        if (res.status !== 200) {
            const body = await res.text();
            throw new Error(`Members List Failed with ${res.status}: ${body}`);
        }
        const data: any = await res.json();
        expect(data.members).toBeDefined();
        expect(data.members.length).toBe(1);
        expect(data.members[0].id).toBe(instructorId);
    });
});
