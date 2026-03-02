import { Hono } from 'hono';
import { createDb } from '../db';
import { tenants, users, automationLogs } from '@studio/db/src/schema';
import { eq, sql, and } from 'drizzle-orm';
import { Webhook } from 'svix'; // Although Resend does not use Svix, let's process the JSON body directly or use crypto for webhook signatures if needed.
// Resend currently sends webhooks as POST requests with a JSON body. 

const resendWebhooksApp = new Hono<{ Bindings: { DB: D1Database } }>();

resendWebhooksApp.post('/', async (c) => {
    try {
        const payload = await c.req.json();
        const type = payload.type;
        const data = payload.data; // The email event data
        const db = createDb(c.env.DB);

        console.log(`[Resend Webhook] Received event type: ${type}`);

        if (type === 'email.bounced' || type === 'email.complained') {
            const emailAddress = data.to[0]; // recipient email

            if (emailAddress) {
                // Mark user as unsubscribed globally
                await db.update(users).set({
                    isUnsubscribed: true
                }).where(eq(users.email, emailAddress));

                console.log(`[Resend Webhook] Marked user ${emailAddress} as unsubscribed due to ${type}`);
            }
        }

        if (type === 'email.opened' || type === 'email.clicked') {
            const tags = data.tags || {};
            const automationId = tags.automation_id;
            const stepIndexStr = tags.step_index;
            const emailAddress = data.to[0];

            if (automationId && emailAddress) {
                const stepIndex = stepIndexStr ? parseInt(stepIndexStr) : 0;

                // Find the user ID from email
                const user = await db.query.users.findFirst({
                    where: eq(users.email, emailAddress)
                });

                if (user) {
                    const updateData: any = {};
                    if (type === 'email.opened') updateData.openedAt = new Date();
                    if (type === 'email.clicked') updateData.clickedAt = new Date();

                    await db.update(automationLogs)
                        .set(updateData)
                        .where(and(
                            eq(automationLogs.automationId, automationId),
                            eq(automationLogs.userId, user.id),
                            eq(automationLogs.stepIndex, stepIndex),
                            // Only update if not already set (record first engagement)
                            type === 'email.opened' ? sql`opened_at IS NULL` : sql`clicked_at IS NULL`
                        )).run();

                    console.log(`[Resend Webhook] Recorded ${type} for automation ${automationId} step ${stepIndex} user ${user.id}`);
                }
            }
        }

        return c.json({ success: true }, 200);
    } catch (e: any) {
        console.error(`[Resend Webhook Error]: ${e.message}`);
        return c.json({ error: 'Webhook processing failed' }, 400);
    }
});

export default resendWebhooksApp;
