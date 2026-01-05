import { Hono } from 'hono';
import { createDb } from '../db';
import { tenants, tenantMembers, bookings, users } from 'db/src/schema';
import { eq, and, desc, lt, inArray } from 'drizzle-orm';
import { isFeatureEnabled } from '../utils/features';
import { EmailService } from '../services/email';

type Bindings = {
    DB: D1Database;
    RESEND_API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Simple API Key protection for Cron Jobs?
// For now, assume protected by Worker logic or secret header
app.use('*', async (c, next) => {
    const key = c.req.header('X-Job-Key');
    // MVP: Allow if internal or check env (skipped for now to simplify testing)
    await next();
});

app.post('/churn-check', async (c) => {
    const db = createDb(c.env.DB);
    let logs: string[] = [];

    // 1. Get All Active Tenants
    const allTenants = await db.select().from(tenants).where(eq(tenants.status, 'active')).all();

    for (const tenant of allTenants) {
        if (!isFeatureEnabled(tenant, 'ai_churn')) continue;

        logs.push(`Processing Tenant: ${tenant.name}`);
        const settings = (tenant.settings as any) || {};
        const churnSettings = settings.churn || {};

        // 2. Process Members
        const members = await db.select({
            id: tenantMembers.id,
            userId: tenantMembers.userId,
            churnStatus: tenantMembers.churnStatus,
            email: users.email,
            firstName: users.profile
        })
            .from(tenantMembers)
            .innerJoin(users, eq(tenantMembers.userId, users.id))
            .where(eq(tenantMembers.tenantId, tenant.id))
            .all();

        for (const member of members) {
            // Get Last Booking
            const lastBooking = await db.select({ checkedInAt: bookings.checkedInAt })
                .from(bookings)
                .where(and(
                    eq(bookings.memberId, member.id),
                    eq(bookings.status, 'confirmed')
                ))
                .orderBy(desc(bookings.checkedInAt))
                .limit(1)
                .get();

            let score = 100;
            if (lastBooking && lastBooking.checkedInAt) {
                const daysSince = (Date.now() - lastBooking.checkedInAt.getTime()) / (1000 * 3600 * 24);
                if (daysSince > 60) score = 20;
                else if (daysSince > 30) score = 50;
                else if (daysSince > 14) score = 80;
            } else {
                // No bookings? Maybe new?
                // Check joinedAt
                // Using join date if no bookings is safer, but simpler: New users = 100.
            }

            // Determine Status
            let newStatus = 'safe';
            if (score <= 20) newStatus = 'churned';
            else if (score <= 50) newStatus = 'at_risk';

            // Update DB if changed
            if (newStatus !== member.churnStatus) {
                await db.update(tenantMembers)
                    .set({
                        churnScore: score,
                        churnStatus: newStatus as any,
                        lastChurnCheck: new Date()
                    })
                    .where(eq(tenantMembers.id, member.id))
                    .run();

                logs.push(`Updated ${member.id}: ${member.churnStatus} -> ${newStatus} (Score: ${score})`);

                // AUTOMATION: Trigger Email if became 'at_risk'
                if (newStatus === 'at_risk' && member.churnStatus === 'safe') {
                    if (churnSettings.automations?.emailEnabled && c.env.RESEND_API_KEY) {
                        const emailService = new EmailService(c.env.RESEND_API_KEY, {
                            branding: tenant.branding as any,
                            settings: tenant.settings as any
                        });

                        const subject = churnSettings.automations?.subject || "We miss you!";
                        const body = churnSettings.automations?.body || "<p>We noticed you haven't visited in a while. Come back soon!</p>";

                        c.executionCtx.waitUntil(emailService.sendGenericEmail(
                            member.email,
                            subject,
                            body
                        ));
                        logs.push(`Triggered Email to ${member.email}`);
                    }
                }
            }
        }
    }

    return c.json({ success: true, logs });
});

export default app;
