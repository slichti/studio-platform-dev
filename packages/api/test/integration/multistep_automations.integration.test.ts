import { env } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import * as schema from '@studio/db/src/schema';
import { AutomationsService } from '../../src/services/automations';
import { EmailService } from '../../src/services/email';
import { setupTestDb } from './test-utils';
import { eq, and } from 'drizzle-orm';

describe('Multi-Step Automations Integration', () => {
    const TENANT_ID = 'multi_tenant_1';
    const USER_ID = 'multi_user_1';
    const AUTO_ID = 'multi_auto_1';

    let db: any;

    beforeAll(async () => {
        db = await setupTestDb(env.DB);

        await db.insert(schema.tenants).values({
            id: TENANT_ID,
            slug: 'multistudio',
            name: 'Multi Studio',
            status: 'active'
        }).run();

        await db.insert(schema.users).values({
            id: USER_ID,
            email: 'multi@example.com',
            profile: { firstName: 'Multi' }
        }).run();

        await db.insert(schema.tenantMembers).values({
            id: 'm1',
            tenantId: TENANT_ID,
            userId: USER_ID,
            status: 'active'
        }).run();
    });

    it('should execute a 3-step sequence: Email -> Delay -> Email', async () => {
        // 1. Create Automation
        await db.insert(schema.marketingAutomations).values({
            id: AUTO_ID,
            tenantId: TENANT_ID,
            triggerEvent: 'membership_started',
            isEnabled: true,
            steps: [
                { type: 'email', subject: 'Step 1: Immediate', content: 'Welcome!', channels: ['email'] },
                { type: 'delay', delayHours: 2 },
                { type: 'email', subject: 'Step 2: After 2h', content: 'Checking in', channels: ['email'] }
            ]
        }).run();

        const emailService = new EmailService('mock', {}, { slug: 'multi' } as any, undefined, false, db, TENANT_ID);
        const service = new AutomationsService(db, TENANT_ID, emailService);
        const automation = await db.select().from(schema.marketingAutomations).where(eq(schema.marketingAutomations.id, AUTO_ID)).get();

        // 2. Enroll User (Triggers Step 0 immediately)
        await service.enrollUser(automation, {
            userId: USER_ID,
            email: 'multi@example.com',
            firstName: 'Multi'
        });

        // 3. Verify Step 0 (Email) executed
        const logsStep0 = await db.select().from(schema.automationLogs)
            .where(and(eq(schema.automationLogs.automationId, AUTO_ID), eq(schema.automationLogs.stepIndex, 0))).all();
        expect(logsStep0.length).toBe(1);
        expect(logsStep0[0].stepIndex).toBe(0);
        const meta0 = typeof logsStep0[0].metadata === 'string' ? JSON.parse(logsStep0[0].metadata) : logsStep0[0].metadata;
        expect(meta0.recipientType).toBe('student'); // Depending on log schema

        // 4. Verify Enrollment is at Step 2 (waiting for the email after delay)
        const enrollment = await db.select().from(schema.automationEnrollments)
            .where(eq(schema.automationEnrollments.automationId, AUTO_ID)).get();
        expect(enrollment.currentStepIndex).toBe(2);
        expect(enrollment.status).toBe('active');

        // Wait, step 0 was email, it advanced to step 1 (delay) during the recursive call.
        // Step 1 is a delay, so it updated nextExecutionAt and currentStepIndex to 2? 
        // No, processSingleEnrollment for delay:
        // updates (nextIndex, nextExec) and returns.
        // So it should be at currentStepIndex = 1, with nextExec in 2 hours.
        // Wait, did it advance twice?
        // Step 0: email -> advanceStep=true -> nextIndex=1 -> processSingleEnrollment(1)
        // Step 1: delay -> updates nextExec, currentStepIndex=2 (wait, let's check code).

        /* 
        Code check:
        if (step.type === 'delay') {
            nextExecutionAt = now + hours;
            advanceStep = true;
        }
        ...
        if (advanceStep) {
            const nextIndex = stepIndex + 1;
            if (step.type === 'delay') {
                await db.update(automationEnrollments).set({ currentStepIndex: nextIndex, nextExecutionAt: nextExecutionAt ... })
            } else {
                await db.update(automationEnrollments).set({ currentStepIndex: nextIndex ... })
                await this.processSingleEnrollment(nextIndex)
            }
        }
        */

        // Correct logic:
        // Step 0 (Email) -> advances to Step 1 (Delay) -> processSingleEnrollment(1)
        // Step 1 (Delay) -> updates enrollment to currentStepIndex=2, nextExec=now+2h, return.

        expect(enrollment.currentStepIndex).toBe(2);

        // 5. Simulate Time Pass by updating nextExecutionAt
        const past = new Date(Date.now() - 1000); // 1 sec ago
        await db.update(schema.automationEnrollments)
            .set({ nextExecutionAt: past })
            .where(eq(schema.automationEnrollments.id, enrollment.id)).run();

        // 6. Run Cron Processing
        await service.processActiveEnrollments();

        // 7. Verify Step 2 (Email) executed
        const logsStep2 = await db.select().from(schema.automationLogs)
            .where(and(eq(schema.automationLogs.automationId, AUTO_ID), eq(schema.automationLogs.stepIndex, 2))).all();
        expect(logsStep2.length).toBe(1);
        expect(logsStep2[0].stepIndex).toBe(2);

        // 8. Verify Enrollment Completed
        const finalEnrollment = await db.select().from(schema.automationEnrollments)
            .where(eq(schema.automationEnrollments.id, enrollment.id)).get();
        expect(finalEnrollment.status).toBe('completed');
    });
});
