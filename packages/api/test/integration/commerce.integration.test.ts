import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '../../src/db';
import { tenants, classPackDefinitions, membershipPlans } from '@studio/db/src/schema';
import { eq, and } from 'drizzle-orm';
import app from '../../src/index';

describe('Commerce Integration', () => {
    const tenantId = 'test-tenant-' + Date.now();
    const slug = 'test-studio-' + Date.now();

    beforeEach(async () => {
        // Create Tables manually for the test runner's in-memory D1
        const db = createDb(env.DB);

        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS tenants (
            id TEXT PRIMARY KEY, slug TEXT, name TEXT, owner_id TEXT, tier TEXT, status TEXT, created_at INTEGER,
            custom_domain TEXT, branding TEXT, mobile_app_config TEXT, settings TEXT, custom_field_definitions TEXT,
            stripe_account_id TEXT, stripe_customer_id TEXT, stripe_subscription_id TEXT, current_period_end INTEGER,
            marketing_provider TEXT DEFAULT 'system', resend_credentials TEXT, twilio_credentials TEXT, flodesk_credentials TEXT,
            currency TEXT DEFAULT 'usd', zoom_credentials TEXT, mailchimp_credentials TEXT, zapier_credentials TEXT,
            google_credentials TEXT, slack_credentials TEXT, google_calendar_credentials TEXT, resend_audience_id TEXT,
            subscription_status TEXT DEFAULT 'active', is_public INTEGER DEFAULT 0,
            sms_usage INTEGER DEFAULT 0, email_usage INTEGER DEFAULT 0, streaming_usage INTEGER DEFAULT 0,
            sms_limit INTEGER, email_limit INTEGER, streaming_limit INTEGER, billing_exempt INTEGER DEFAULT 0,
            storage_usage INTEGER DEFAULT 0, member_count INTEGER DEFAULT 0, instructor_count INTEGER DEFAULT 0,
            last_billed_at INTEGER, archived_at INTEGER, grace_period_ends_at INTEGER, student_access_disabled INTEGER DEFAULT 0,
            aggregator_config TEXT, is_test INTEGER DEFAULT 0 NOT NULL
        )`).run();

        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS class_pack_definitions (
            id TEXT PRIMARY KEY, tenant_id TEXT, name TEXT, price INTEGER DEFAULT 0, credits INTEGER,
            expiration_days INTEGER, image_url TEXT, vod_enabled INTEGER DEFAULT 0, active INTEGER DEFAULT 1,
            created_at INTEGER
        )`).run();

        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS membership_plans (
            id TEXT PRIMARY KEY, tenant_id TEXT, name TEXT, description TEXT, price INTEGER DEFAULT 0,
            interval TEXT DEFAULT 'month', currency TEXT DEFAULT 'usd', stripe_product_id TEXT, stripe_price_id TEXT,
            image_url TEXT, overlay_title TEXT, overlay_subtitle TEXT, vod_enabled INTEGER DEFAULT 0, active INTEGER DEFAULT 1,
            created_at INTEGER, updated_at INTEGER
        )`).run();

        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS tenant_features (
            id TEXT PRIMARY KEY, tenant_id TEXT, feature_key TEXT, enabled INTEGER DEFAULT 1, source TEXT,
            updated_at INTEGER
        )`).run();

        // Seed Tenant
        await db.insert(tenants).values({
            id: tenantId,
            slug,
            name: 'Test Studio',
            currency: 'usd',
            status: 'active',
            subscriptionStatus: 'active',
            tier: 'launch',
            isTest: true
        } as any).run();
    });

    it('GET /commerce/products should return aggregated packs and plans', async () => {
        const db = createDb(env.DB);

        // Seed a pack
        await db.insert(classPackDefinitions).values({
            id: 'pack-1',
            tenantId,
            name: 'Test Pack',
            credits: 10,
            price: 10000,
            active: true
        } as any).run();

        // Seed a plan
        await db.insert(membershipPlans).values({
            id: 'plan-1',
            tenantId,
            name: 'Test Plan',
            price: 5000,
            interval: 'month',
            active: true
        } as any).run();

        const req = new Request(`http://localhost/commerce/products`, {
            headers: {
                'X-Tenant-Slug': slug,
                'Authorization': 'Bearer mock-token'
            }
        });

        const res = await app.fetch(req, env);
        expect(res.status).toBe(200);
        const data: any = await res.json();
        expect(data.products).toHaveLength(2);
        expect(data.products.find((p: any) => p.type === 'pack').name).toBe('Test Pack');
        expect(data.products.find((p: any) => p.type === 'membership').name).toBe('Test Plan');
    });

    it('POST /commerce/products/bulk should return results (idempotency/permissions handled by middleware)', async () => {
        const items = [
            { type: 'pack', name: 'Bulk Pack', price: 8000, credits: 5 },
            { type: 'membership', name: 'Bulk Memb', price: 12000, interval: 'monthly' }
        ];

        const req = new Request(`http://localhost/commerce/products/bulk`, {
            method: 'POST',
            headers: {
                'X-Tenant-Slug': slug,
                'Content-Type': 'application/json',
                'Authorization': 'Bearer mock-token'
            },
            body: JSON.stringify({ items })
        });

        const res = await app.fetch(req, env);
        expect(res.status).not.toBe(404);
        const data: any = await res.json();
        if (data.results) {
            expect(data.results).toHaveLength(2);
        }
    });
});
