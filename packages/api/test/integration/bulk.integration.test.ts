import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import { eq, and } from 'drizzle-orm';
import * as schema from '@studio/db/src/schema';
import { setupTestDb } from './test-utils';

describe('Bulk Operations API (Integration)', () => {
    const TENANT_ID = 'bulk_test_tenant';
    const ADMIN_USER_ID = 'bulk_admin_user';
    const INSTRUCTOR_ID = 'bulk_instructor_id';
    const OTHER_INSTRUCTOR_ID = 'bulk_other_instructor_id';

    let db: any;

    beforeAll(async () => {
        db = await setupTestDb(env.DB);

        // Setup Tenant
        await db.insert(schema.tenants).values({
            id: TENANT_ID,
            name: 'Bulk Test Studio',
            slug: 'bulk-studio',
            status: 'active',
            tier: 'launch'
        }).run();

        // Setup Admin User
        await db.insert(schema.users).values({
            id: ADMIN_USER_ID,
            email: 'admin@bulk.com',
            role: 'user'
        }).run();

        await db.insert(schema.tenantMembers).values({
            id: ADMIN_USER_ID, // Use same ID for simplicity in mock
            tenantId: TENANT_ID,
            userId: ADMIN_USER_ID,
            status: 'active'
        }).run();

        // Add Role for manage_classes
        await db.insert(schema.tenantRoles).values({
            id: crypto.randomUUID(),
            memberId: ADMIN_USER_ID,
            role: 'admin'
        }).run();
    });

    it('should bulk check-in all confirmed bookings for a class', async () => {
        const classId = crypto.randomUUID();
        await db.insert(schema.classes).values({
            id: classId,
            tenantId: TENANT_ID,
            title: 'Bulk Check-in Class',
            startTime: new Date(),
            durationMinutes: 60,
            status: 'active',
            price: 0
        }).run();

        // Create 2 bookings
        for (let i = 0; i < 2; i++) {
            const memberId = crypto.randomUUID();
            await db.insert(schema.tenantMembers).values({ id: memberId, tenantId: TENANT_ID, userId: ADMIN_USER_ID }).run();
            await db.insert(schema.bookings).values({
                id: crypto.randomUUID(),
                classId,
                memberId,
                status: 'confirmed'
            }).run();
        }

        const response = await SELF.fetch(`https://api.studio.local/classes/${classId}/check-in-all`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'TEST-AUTH': ADMIN_USER_ID,
                'X-Tenant-Slug': 'bulk-studio'
            },
            body: JSON.stringify({ checkedIn: true })
        });

        expect(response.status).toBe(200);
        const json = await response.json() as any;
        expect(json.affected).toBe(2);

        // Verify in DB
        const results = await db.select().from(schema.bookings).where(eq(schema.bookings.classId, classId)).all();
        results.forEach((b: any) => expect(b.checkedInAt).not.toBeNull());
    });

    it('should bulk cancel classes', async () => {
        const classIds = [crypto.randomUUID(), crypto.randomUUID()];
        for (const id of classIds) {
            await db.insert(schema.classes).values({
                id,
                tenantId: TENANT_ID,
                title: 'To Cancel',
                startTime: new Date(),
                durationMinutes: 60,
                status: 'active',
                price: 0
            }).run();
        }

        const response = await SELF.fetch('https://api.studio.local/classes/bulk-cancel', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'TEST-AUTH': ADMIN_USER_ID,
                'X-Tenant-Slug': 'bulk-studio'
            },
            body: JSON.stringify({ classIds })
        });

        expect(response.status).toBe(200);
        const json = await response.json() as any;
        expect(json.affected).toBe(2);

        // Verify
        const results = await db.select().from(schema.classes).where(and(eq(schema.classes.tenantId, TENANT_ID), eq(schema.classes.status, 'cancelled'))).all();
        const foundIds = results.map((r: any) => r.id);
        classIds.forEach(id => expect(foundIds).toContain(id));
    });

    it('should bulk update classes and detect instructor conflicts', async () => {
        const instructorId = crypto.randomUUID();
        const startTime = new Date();
        startTime.setHours(startTime.getHours() + 10); // Future

        const classIds = [crypto.randomUUID()];
        await db.insert(schema.classes).values({
            id: classIds[0],
            tenantId: TENANT_ID,
            title: 'To Update',
            startTime,
            durationMinutes: 60,
            status: 'active',
            price: 0
        }).run();

        // Create conflicting class for the same instructor
        await db.insert(schema.classes).values({
            id: crypto.randomUUID(),
            tenantId: TENANT_ID,
            instructorId,
            title: 'Conflict',
            startTime,
            durationMinutes: 60,
            status: 'active',
            price: 0
        }).run();

        const response = await SELF.fetch('https://api.studio.local/classes/bulk-update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'TEST-AUTH': ADMIN_USER_ID,
                'X-Tenant-Slug': 'bulk-studio'
            },
            body: JSON.stringify({
                classIds,
                data: { instructorId }
            })
        });

        expect(response.status).toBe(400);
        const json = await response.json() as any;
        expect(json.error).toContain('Conflict');
    });
});
