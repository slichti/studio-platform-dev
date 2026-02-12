import { env, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import * as schema from '@studio/db/src/schema';
import { setupTestDb } from './test-utils';

describe('Quota Integration Tests', () => {
    let db: any;

    beforeAll(async () => {
        db = await setupTestDb(env.DB);
    });

    it('should block member creation when quota is exceeded', async () => {
        const tenantId = 't_quota_1';
        const ownerId = 'user_owner';

        // 1. Setup Tenant (Launch tier has limits)
        await db.insert(schema.tenants).values({
            id: tenantId,
            slug: 'quota-test',
            name: 'Quota Test',
            tier: 'launch'
        }).run();

        // 2. Setup Owner
        await db.insert(schema.users).values({
            id: ownerId,
            email: 'owner@test.com',
            role: 'owner'
        }).run();

        await db.insert(schema.tenantMembers).values({
            id: 'm_owner',
            tenantId: tenantId,
            userId: ownerId,
            status: 'active'
        }).run();

        await db.insert(schema.tenantRoles).values({
            id: 'r_owner',
            memberId: 'm_owner',
            role: 'owner'
        }).run();

        // 3. Fill up quota (Launch limit is 1 for locations)
        await db.insert(schema.locations).values({
            id: 'loc_1',
            tenantId: tenantId,
            name: 'Existing Location'
        }).run();

        // 4. Try to add 2nd location
        const req = new Request('http://localhost/locations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Tenant-Id': tenantId,
                'TEST-AUTH': ownerId
            },
            body: JSON.stringify({ name: 'Second Location' })
        });

        const res = await SELF.fetch(req);
        if (res.status !== 402) {
            throw new Error(`Member Quota test failed: ${res.status} - ${await res.text()}`);
        }
        expect(res.status).toBe(402);
        const data: any = await res.json();
        expect(data.code).toBe('QUOTA_EXCEEDED');
    });

    it('should allow joining a studio via Join API', async () => {
        const tenantId = 't_join_1';
        const userId = 'user_student_1';

        await db.insert(schema.tenants).values({
            id: tenantId,
            slug: 'join-test',
            name: 'Join Test',
            tier: 'launch'
        }).run();

        await db.insert(schema.users).values({
            id: userId,
            email: 'student@test.com'
        }).run();

        // [FIX] Added X-Tenant-Id to help tenantMiddleware resolve context even with slug in URL
        const req = new Request(`http://localhost/studios/join-test/join`, {
            method: 'POST',
            headers: {
                'TEST-AUTH': userId,
                'X-Tenant-Id': tenantId
            }
        });

        const res = await SELF.fetch(req);
        if (res.status !== 200) {
            console.log('Join Error:', await res.clone().text());
        }
        expect(res.status).toBe(200);
        const data: any = await res.json();
        expect(data.success).toBe(true);
        expect(data.memberId).toBeDefined();

        // Verify membership in DB
        const member = await db.query.tenantMembers.findFirst({
            where: (m: any, { and, eq }: any) => and(eq(m.userId, userId), eq(m.tenantId, tenantId))
        });
        expect(member).toBeDefined();
    });

    it('should enforce classes per week quota', async () => {
        const tenantId = 't_class_quota';
        const ownerId = 'user_owner_2';

        await db.insert(schema.tenants).values({
            id: tenantId,
            slug: 'class-quota',
            name: 'Class Quota',
            tier: 'launch'
        }).run();

        await db.insert(schema.users).values({
            id: ownerId,
            email: 'owner2@test.com',
            role: 'owner',
            isPlatformAdmin: 1
        }).run();

        await db.insert(schema.tenantMembers).values({
            id: 'm_owner_2',
            tenantId: tenantId,
            userId: ownerId,
            status: 'active'
        }).run();

        await db.insert(schema.tenantRoles).values({
            id: 'r_owner_2',
            memberId: 'm_owner_2',
            role: 'owner'
        }).run();

        // Launch limit is 5 classes per week.
        const now = new Date();
        const batch = [];
        for (let i = 0; i < 5; i++) {
            batch.push(db.insert(schema.classes).values({
                id: `c_${i}`,
                tenantId: tenantId,
                title: `Class ${i}`,
                startTime: now,
                durationMinutes: 60,
                status: 'active',
                type: 'class'
            }));
        }
        await Promise.all(batch);

        // Try to create 6th class
        const req = new Request('http://localhost/classes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Tenant-Id': tenantId,
                'TEST-AUTH': ownerId
            },
            body: JSON.stringify({
                title: 'Too Many Classes',
                startTime: new Date().toISOString(),
                durationMinutes: 60
            })
        });

        const res = await SELF.fetch(req);
        if (res.status !== 402) {
            throw new Error(`Enforce Classes Quota failed: ${res.status} - ${await res.text()}`);
        }
        expect(res.status).toBe(402);
    });
});
