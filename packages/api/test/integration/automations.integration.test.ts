import { env } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import * as schema from '@studio/db/src/schema';
import { AutomationsService } from '../../src/services/automations';
import { EmailService } from '../../src/services/email';
import { setupTestDb } from './test-utils';

describe('Automations Integration', () => {
    const TENANT_ID = 'auto_tenant_1';
    const USER_ID = 'auto_user_1';
    const MEMBER_ID = 'auto_member_1';
    const AUTO_DELAY_ID = 'auto_delay_1';

    let db: any;

    beforeAll(async () => {
        db = await setupTestDb(env.DB);

        // 2. Seed Data
        await db.insert(schema.tenants).values({
            id: TENANT_ID,
            slug: 'autostudio',
            name: 'Auto Studio',
            status: 'active',
            branding: {},
            settings: {},
            mobileAppConfig: {}
        }).run();

        await db.insert(schema.locations).values({
            id: 'loc_1',
            tenantId: TENANT_ID,
            name: 'Main Studio'
        }).run();

        await db.insert(schema.users).values({
            id: USER_ID,
            email: 'test@example.com',
            profile: { firstName: 'Tester' }
        }).run();

        await db.insert(schema.tenantMembers).values({
            id: MEMBER_ID,
            tenantId: TENANT_ID,
            userId: USER_ID,
            status: 'active',
            joinedAt: new Date()
        }).run();

        await db.insert(schema.classes).values({
            id: 'class_1',
            tenantId: TENANT_ID,
            title: 'Test Class',
            startTime: new Date(),
            durationMinutes: 60,
            status: 'active',
            videoProvider: 'offline'
        }).run();

        // Delayed Automation (Class Booked, 1 Hour Delay)
        await db.insert(schema.marketingAutomations).values({
            id: AUTO_DELAY_ID,
            tenantId: TENANT_ID,
            triggerEvent: 'class_booked',
            subject: 'Class Followup',
            content: 'Thanks for booking!',
            isEnabled: true,
            timingType: 'delay',
            timingValue: 1,
            channels: ['email']
        }).run();
    });

    it('should process delayed class_booked trigger', async () => {
        // Setup Booking: 90 mins ago. (Delay 1h).
        const ninetyMinsAgo = new Date(Date.now() - (90 * 60 * 1000));
        await db.insert(schema.bookings).values({
            id: 'booking_old',
            classId: 'class_1',
            memberId: MEMBER_ID,
            status: 'confirmed',
            createdAt: ninetyMinsAgo
        }).run();

        // 2. Run Service
        const emailService = new EmailService('re_mock_key', {}, { slug: 'autostudio' } as any, undefined, false, db, TENANT_ID);
        const service = new AutomationsService(db, TENANT_ID, emailService);

        await service.processTimeBasedAutomations();

        // 3. Check Logs
        const logs = await db.select().from(schema.automationLogs).all();
        expect(logs.length).toBe(1);
        expect(logs[0].automationId).toBe(AUTO_DELAY_ID);
        expect(logs[0].userId).toBe(USER_ID);
    });
});
