import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import { eq, and } from 'drizzle-orm';
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
    it('should deduct credit from pack', async () => {
        const CREDIT_CLASS_ID = 'credit_class';
        const PACK_DEF_ID = 'pack_def';
        const PURCHASE_ID = 'purchase_1';
        const CREDIT_USER_ID = 'credit_user';
        const CREDIT_MEMBER_ID = 'credit_member';

        // 1. Create Class
        const startTime = new Date();
        startTime.setDate(startTime.getDate() + 3);

        await db.insert(schema.classes).values({
            id: CREDIT_CLASS_ID,
            tenantId: TENANT_ID,
            instructorId: INSTRUCTOR_ID,
            title: 'Credit Class',
            startTime: startTime,
            durationMinutes: 60,
            capacity: 10,
            status: 'active',
            allowCredits: true,
            price: 2000 // $20 drop-in
        }).run();

        // 2. Create User & Member
        await db.insert(schema.users).values({ id: CREDIT_USER_ID, email: 'credit@test.com', role: 'user' }).run();
        await db.insert(schema.tenantMembers).values({ id: CREDIT_MEMBER_ID, tenantId: TENANT_ID, userId: CREDIT_USER_ID, status: 'active' }).run();

        // 3. Create Pack Def & Purchase
        await db.insert(schema.classPackDefinitions).values({
            id: PACK_DEF_ID,
            tenantId: TENANT_ID,
            name: '10 Pack',
            credits: 10,
            price: 15000
        }).run();

        await db.insert(schema.purchasedPacks).values({
            id: PURCHASE_ID,
            tenantId: TENANT_ID,
            memberId: CREDIT_MEMBER_ID,
            packDefinitionId: PACK_DEF_ID,
            initialCredits: 10,
            remainingCredits: 10,
            status: 'active'
        }).run();

        // 4. Book Class
        const response = await SELF.fetch('https://api.studio.local/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'TEST-AUTH': CREDIT_USER_ID, 'X-Tenant-Slug': 'integration-studio' },
            body: JSON.stringify({ classId: CREDIT_CLASS_ID })
        });

        const json = await response.json() as any;
        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.id).toBeDefined();

        // 5. Verify Credit Deducted
        const pack = await db.select().from(schema.purchasedPacks).where(eq(schema.purchasedPacks.id, PURCHASE_ID)).get();
        expect(pack).toBeDefined();
        // @ts-ignore
        expect(pack.remainingCredits).toBe(9);

        // 6. Verify Booking Usage
        const booking = await db.select().from(schema.bookings).where(eq(schema.bookings.id, json.id)).get();
        // @ts-ignore
        expect(booking.usedPackId).toBe(PURCHASE_ID);
    });

    it('should allow joining waitlist when full', async () => {
        const WIFI_CLASS_ID = 'waitlist_class';
        const WIFI_USER_ID = 'waitlist_user';
        const WIFI_MEMBER_ID = 'waitlist_member';

        // 1. Create Full Class
        const startTime = new Date();
        startTime.setDate(startTime.getDate() + 4);

        await db.insert(schema.classes).values({
            id: WIFI_CLASS_ID,
            tenantId: TENANT_ID,
            instructorId: INSTRUCTOR_ID,
            title: 'Waitlist Class',
            startTime: startTime,
            durationMinutes: 60,
            capacity: 1, // Only 1 spot
            status: 'active',
            waitlistCapacity: 5
        }).run();

        // Fill the spot
        const BLOCKER_ID = 'blocker';
        await db.insert(schema.tenantMembers).values({ id: BLOCKER_ID, tenantId: TENANT_ID, userId: 'blocker_u', status: 'active' }).run();
        await db.insert(schema.bookings).values({ id: 'blocking_booking', classId: WIFI_CLASS_ID, memberId: BLOCKER_ID, status: 'confirmed', createdAt: new Date() }).run();

        // 2. Create User
        await db.insert(schema.users).values({ id: WIFI_USER_ID, email: 'wl@test.com', role: 'user' }).run();
        await db.insert(schema.tenantMembers).values({ id: WIFI_MEMBER_ID, tenantId: TENANT_ID, userId: WIFI_USER_ID, status: 'active' }).run();

        // 3. Try Book directly (Should Fail)
        const res1 = await SELF.fetch('https://api.studio.local/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'TEST-AUTH': WIFI_USER_ID, 'X-Tenant-Slug': 'integration-studio' },
            body: JSON.stringify({ classId: WIFI_CLASS_ID })
        });
        expect(res1.status).toBe(400);

        // 4. Join Waitlist
        const res2 = await SELF.fetch(`https://api.studio.local/waitlist/${WIFI_CLASS_ID}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'TEST-AUTH': WIFI_USER_ID, 'X-Tenant-Slug': 'integration-studio' }
        });

        const json2 = await res2.json() as any;
        expect(res2.status).toBe(200);
        expect(json2.success).toBe(true);
        expect(json2.position).toBe(1);

        // 5. Verify DB
        const wl = await db.select().from(schema.waitlist).where(and(eq(schema.waitlist.classId, WIFI_CLASS_ID), eq(schema.waitlist.userId, WIFI_USER_ID))).get();
        expect(wl).toBeDefined();
        // @ts-ignore
        expect(wl.status).toBe('pending');
    });

    it('should successfully check-in a booking', async () => {
        // 1. Create Class
        const CHECKIN_CLASS_ID = "checkin_class";
        await db.insert(schema.classes).values({
            id: CHECKIN_CLASS_ID,
            tenantId: TENANT_ID,
            title: "Check-in Class",
            startTime: new Date(Date.now() + 86400000), // Tomorrow
            durationMinutes: 60,
            capacity: 10,
            status: "active"
        }).run();

        // 2. Create User & Member (Booker)
        const CHECKIN_USER_ID = "checkin_user";
        const CHECKIN_MEMBER_ID = "checkin_member";
        await db.insert(schema.users).values({ id: CHECKIN_USER_ID, email: "checkin@test.com", role: "user" }).run();
        await db.insert(schema.tenantMembers).values({ id: CHECKIN_MEMBER_ID, tenantId: TENANT_ID, userId: CHECKIN_USER_ID, status: "active" }).run();

        // 3. Create Booking
        const BOOKING_ID = "checkin_booking";
        await db.insert(schema.bookings).values({
            id: BOOKING_ID,
            classId: CHECKIN_CLASS_ID,
            memberId: CHECKIN_MEMBER_ID,
            status: 'confirmed',
            attendanceType: 'in_person',
            createdAt: new Date()
        }).run();

        // 4. Create Owner (for permissions)
        const OWNER_USER_ID = "owner_user";
        const OWNER_MEMBER_ID = "owner_member";
        await db.insert(schema.users).values({ id: OWNER_USER_ID, email: "owner@test.com", role: "user" }).run();
        await db.insert(schema.tenantMembers).values({ id: OWNER_MEMBER_ID, tenantId: TENANT_ID, userId: OWNER_USER_ID, status: "active" }).run();
        await db.insert(schema.tenantRoles).values({
            id: "owner_role",
            memberId: OWNER_MEMBER_ID,
            role: "owner"
        }).run();

        // 5. Perform Check-in (as Owner)
        const res = await SELF.fetch(`https://api.studio.local/classes/${CHECKIN_CLASS_ID}/bookings/${BOOKING_ID}/check-in`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'TEST-AUTH': OWNER_USER_ID,
                'X-Tenant-Slug': 'integration-studio'
            },
            body: JSON.stringify({ checkedIn: true })
        });

        if (res.status !== 200) {
            console.log(await res.text());
        }
        expect(res.status).toBe(200);
        const json = await res.json() as any;
        expect(json.success).toBe(true);

        // 6. Verify Database
        const booking = await db.select().from(schema.bookings).where(eq(schema.bookings.id, BOOKING_ID)).get();
        expect(booking).toBeDefined();
        // @ts-ignore
        expect(booking.checkedInAt).not.toBeNull();
    });
});
