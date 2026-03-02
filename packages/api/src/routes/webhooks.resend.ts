import { Hono } from 'hono';
import { db } from '../db';
import { tenants, users } from '@studio/db';
import { eq } from 'drizzle-orm';
import { Webhook } from 'svix'; // Although Resend does not use Svix, let's process the JSON body directly or use crypto for webhook signatures if needed.
// Resend currently sends webhooks as POST requests with a JSON body. 

const resendWebhooksApp = new Hono();

resendWebhooksApp.post('/', async (c) => {
    try {
        const payload = await c.req.json();
        const type = payload.type;
        const data = payload.data; // The email event data

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

        return c.json({ success: true }, 200);
    } catch (e: any) {
        console.error(`[Resend Webhook Error]: ${e.message}`);
        return c.json({ error: 'Webhook processing failed' }, 400);
    }
});

export default resendWebhooksApp;
