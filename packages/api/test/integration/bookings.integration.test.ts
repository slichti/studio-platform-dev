import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import * as schema from '@studio/db/src/schema';
import { setupTestDb } from './test-utils';

describe('Bookings API (Integration)', () => {
    const TENANT_ID = 'test_tenant_id';
    const USER_ID = 'test_user_id';
    const MEMBER_ID = 'test_member_id';
    const CLASS_ID = 'test_class_id';
    const INSTRUCTOR_ID = 'test_instructor_id';
    const INSTRUCTOR_USER_ID = 'test_instructor_user_id';

    let db: any;

    beforeAll(async () => {
        db = await setupTestDb(env.DB);

        // 1. Create Tenant
        await db.insert(schema.tenants).values({
            id: TENANT_ID,
            name: 'Integration Test Studio',
            slug: 'integration-studio',
            marketingProvider: 'system',
            currency: 'usd',
            status: 'active',
            tier: 'launch',
            subscriptionStatus: 'active',
            branding: {},
            settings: {},
            mobileAppConfig: {}
        }).onConflictDoNothing().run();

        // 2. Create Student User & Member
        await db.insert(schema.users).values({
            id: USER_ID,
            email: 'student@test.com',
            role: 'user'
        }).onConflictDoNothing().run();

        await db.insert(schema.tenantMembers).values({
            id: MEMBER_ID,
            tenantId: TENANT_ID,
            userId: USER_ID,
            status: 'active'
        }).onConflictDoNothing().run();

        // 3. Create Instructor
        await db.insert(schema.users).values({
            id: INSTRUCTOR_USER_ID,
            email: 'instructor@test.com',
            role: 'user'
        }).onConflictDoNothing().run();

        await db.insert(schema.tenantMembers).values({
            id: INSTRUCTOR_ID,
            tenantId: TENANT_ID,
            userId: INSTRUCTOR_USER_ID,
            status: 'active'
        }).onConflictDoNothing().run();

        // 4. Create Class
        const startTime = new Date();
        startTime.setDate(startTime.getDate() + 1); // Tomorrow

        await db.insert(schema.classes).values({
            id: CLASS_ID,
            tenantId: TENANT_ID,
            instructorId: INSTRUCTOR_ID, // Use member ID
            title: 'Integration Flow Yoga',
            startTime: startTime,
            durationMinutes: 60,
            capacity: 5,
            status: 'active',
            zoomEnabled: false,
            videoProvider: 'offline'
        }).onConflictDoNothing().run();
    });

    it('should successfully book a class and prevent double booking', async () => {
        const response = await SELF.fetch('https://api.studio.local/bookings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'TEST-AUTH': USER_ID,
                'X-Tenant-Slug': 'integration-studio'
            },
            body: JSON.stringify({
                classId: CLASS_ID
            })
        });

        // Debug response if fail
        if (response.status !== 200) {
            console.log("Error Response:", await response.clone().text());
        }

        const json = await response.json() as any;
        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.id).toBeDefined();

        // Verify DB
        const booking = await db.select().from(schema.bookings).where(eq(schema.bookings.id, json.id)).get();
        expect(booking).toBeDefined();
        expect(booking?.status).toBe('confirmed');

        // Prevent double booking
        const response2 = await SELF.fetch('https://api.studio.local/bookings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'TEST-AUTH': USER_ID,
                'X-Tenant-Slug': 'integration-studio'
            },
            body: JSON.stringify({
                classId: CLASS_ID
            })
        });

        const json2 = await response2.json() as any;
        expect(response2.status).toBe(400);
        expect(json2.error).toBe('Already booked');
    });

    it('should respect capacity limit', async () => {
        const SMALL_CLASS_ID = 'small_class';

        const startTime = new Date();
        startTime.setDate(startTime.getDate() + 2);

        await db.insert(schema.classes).values({
            id: SMALL_CLASS_ID,
            tenantId: TENANT_ID,
            instructorId: INSTRUCTOR_ID,
            title: 'Tiny Class',
            startTime: startTime,
            durationMinutes: 60,
            capacity: 1, // Only 1 spot
            status: 'active',
            zoomEnabled: false,
            videoProvider: 'offline'
        }).run();

        // User 1 Books (Success) - reusing main user
        const res1 = await SELF.fetch('https://api.studio.local/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'TEST-AUTH': USER_ID, 'X-Tenant-Slug': 'integration-studio' },
            body: JSON.stringify({ classId: SMALL_CLASS_ID })
        });
        expect(res1.status).toBe(200);

        // User 2 Books (Should Fail)
        const USER2_ID = 'user2';
        await db.insert(schema.users).values({ id: USER2_ID, email: 'u2@t.com', role: 'user' }).run();
        await db.insert(schema.tenantMembers).values({ id: 'member2', tenantId: TENANT_ID, userId: USER2_ID, status: 'active' }).run();

        const res2 = await SELF.fetch('https://api.studio.local/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'TEST-AUTH': USER2_ID, 'X-Tenant-Slug': 'integration-studio' },
            body: JSON.stringify({ classId: SMALL_CLASS_ID })
        });

        const json2 = await res2.json() as any;
        expect(res2.status).toBe(400);
        expect(json2.error).toBe('Class is full');
    });
});
