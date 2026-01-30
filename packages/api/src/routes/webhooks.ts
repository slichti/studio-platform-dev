import { Hono } from 'hono';
import { createDb } from '../db';
import { ZoomService } from '../services/zoom';
import { StreamService } from '../services/stream';
import * as schema from '@studio/db/src/schema';
import { eq, and } from 'drizzle-orm';
import { HonoContext } from '../types';

const app = new Hono<HonoContext>();

app.post('/zoom', async (c) => {
    const body = await c.req.json();
    if (body.event === 'endpoint.url_validation') {
        const secret = c.env.ZOOM_WEBHOOK_SECRET_TOKEN;
        const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        const sig = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body.payload.plainToken)))).map(b => b.toString(16).padStart(2, '0')).join('');
        return c.json({ plainToken: body.payload.plainToken, encryptedToken: sig });
    }

    if (body.event === 'recording.completed') {
        const payload = body.payload.object;
        const recording = payload.recording_files?.find((f: any) => f.file_type === 'MP4');
        if (recording && c.env.ZOOM_ACCOUNT_ID && c.env.CLOUDFLARE_ACCOUNT_ID) {
            try {
                const db = createDb(c.env.DB);
                const cl = await db.select().from(schema.classes).innerJoin(schema.tenants, eq(schema.classes.tenantId, schema.tenants.id)).where(eq(schema.classes.zoomMeetingId, String(payload.id))).limit(1).get();
                if (cl && (['growth', 'scale'].includes(cl.tenants.tier))) {
                    const zs = new ZoomService(c.env.ZOOM_ACCOUNT_ID, c.env.ZOOM_CLIENT_ID, c.env.ZOOM_CLIENT_SECRET, c.env.DB);
                    const ss = new StreamService(c.env.CLOUDFLARE_ACCOUNT_ID, c.env.CLOUDFLARE_API_TOKEN);
                    await ss.uploadViaLink(`${recording.download_url}?access_token=${await (zs as any).getAccessToken()}`, { name: payload.topic || `Meeting ${payload.id}`, meta: { classId: cl.classes.id, tenantId: cl.classes.tenantId } });
                }
            } catch (e) { console.error(e); }
        }
    }
    return c.json({ received: true });
});

app.post('/clerk', async (c) => {
    const secret = c.env.CLERK_WEBHOOK_SECRET;
    if (!secret) return c.json({ error: 'Missing secret' }, 500);
    const { Webhook } = await import('svix');
    let evt: any;
    try { evt = new Webhook(secret).verify(await c.req.text(), { 'svix-id': c.req.header('svix-id')!, 'svix-timestamp': c.req.header('svix-timestamp')!, 'svix-signature': c.req.header('svix-signature')! }); } catch (e) { return c.json({ error: 'Auth fail' }, 400); }

    const db = createDb(c.env.DB);
    const { id, email_addresses, first_name, last_name, image_url, phone_numbers } = evt.data;
    if (evt.type === 'user.created' || evt.type === 'user.updated') {
        const email = email_addresses?.[0]?.email_address;
        if (email) {
            const profile = { firstName: first_name, lastName: last_name, portraitUrl: image_url, phoneNumber: phone_numbers?.[0]?.phone_number };
            await db.insert(schema.users).values({ id, email, profile, createdAt: new Date() }).onConflictDoUpdate({ target: schema.users.id, set: { email, profile } }).run();
            // Dispatch triggers...
            c.executionCtx.waitUntil((async () => {
                const mems = await db.query.tenantMembers.findMany({ where: eq(schema.tenantMembers.userId, id), with: { tenant: true } });
                const { EmailService } = await import('../services/email');
                const { AutomationsService } = await import('../services/automations');
                const { SmsService } = await import('../services/sms');
                const { UsageService } = await import('../services/pricing');
                for (const m of mems) {
                    const us = new UsageService(db, m.tenantId);
                    const es = new EmailService((m.tenant.resendCredentials as any)?.apiKey || c.env.RESEND_API_KEY!, { branding: m.tenant.branding as any, settings: m.tenant.settings as any }, { slug: m.tenant.slug }, us, !!(m.tenant.resendCredentials as any)?.apiKey);
                    const as = new AutomationsService(db, m.tenantId, es, new SmsService(m.tenant.twilioCredentials as any, c.env, us, db, m.tenantId));
                    await as.dispatchTrigger('contact_updated', { userId: id, email, firstName: first_name, lastName: last_name, data: { memberId: m.id } });
                }
            })());
        }
    }
    if (evt.type === 'user.deleted') {
        const mems = await db.select({ id: schema.tenantMembers.id }).from(schema.tenantMembers).where(eq(schema.tenantMembers.userId, id)).all();
        if (mems.length) await db.delete(schema.tenantRoles).where(sql`${schema.tenantRoles.memberId} IN ${mems.map(m => m.id)}`).run();
        await db.delete(schema.tenantMembers).where(eq(schema.tenantMembers.userId, id)).run();
        await db.delete(schema.users).where(eq(schema.users.id, id)).run();
    }
    return c.json({ received: true });
});

app.post('/stripe', async (c) => {
    const sig = c.req.header('stripe-signature');
    const secret = c.env.STRIPE_WEBHOOK_SECRET;
    if (!sig || !secret || !c.env.STRIPE_SECRET_KEY) return c.json({ error: 'Config' }, 500);

    const { Stripe } = await import('stripe');
    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, { apiVersion: '2025-12-15.clover' as any });
    let event;
    try { event = stripe.webhooks.constructEvent(await c.req.text(), sig, secret); } catch (e: any) { return c.json({ error: e.message }, 400); }

    const db = createDb(c.env.DB);
    if (await db.select().from(schema.processedWebhooks).where(eq(schema.processedWebhooks.id, event.id)).get()) return c.json({ received: true });

    try {
        const { StripeWebhookHandler } = await import('../services/stripe-webhook');
        await new StripeWebhookHandler(c.env).process(event);
        await db.insert(schema.processedWebhooks).values({ id: event.id, type: 'stripe' }).run();
    } catch (e) { console.error(e); return c.json({ error: 'Fail' }, 500); }
    return c.json({ received: true });
});

export default app;
