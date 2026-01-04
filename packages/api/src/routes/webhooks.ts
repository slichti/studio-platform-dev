import { Hono } from 'hono';
import { createDb } from '../db';
import { ZoomService } from '../services/zoom';
import { StreamService } from '../services/stream';
import { classes, users, classPackDefinitions, purchasedPacks, giftCards, giftCardTransactions, tenantMembers, tenants } from 'db/src/schema';
import { eq, and } from 'drizzle-orm';
// import { verifyWebhookSignature } from '../services/zoom'; 

type Bindings = {
    DB: D1Database;
    ZOOM_ACCOUNT_ID: string;
    ZOOM_CLIENT_ID: string;
    ZOOM_CLIENT_SECRET: string;
    ZOOM_WEBHOOK_SECRET_TOKEN: string;
    CLOUDFLARE_ACCOUNT_ID: string;
    CLOUDFLARE_API_TOKEN: string;
    CLERK_WEBHOOK_SECRET: string;
    RESEND_API_KEY: string;
    STRIPE_SECRET_KEY: string;
    STRIPE_WEBHOOK_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.post('/zoom', async (c) => {
    // Zoom Webhook Logic (Preserved)
    const body = await c.req.json();
    if (body.event === 'endpoint.url_validation') {
        const plainToken = body.payload.plainToken;
        const secret = c.env.ZOOM_WEBHOOK_SECRET_TOKEN;
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(plainToken));
        const signature = Array.from(new Uint8Array(signatureBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        return c.json({ plainToken: plainToken, encryptedToken: signature });
    }

    if (body.event === 'recording.completed') {
        const payload = body.payload.object;
        const recordingFile = payload.recording_files?.find((f: any) => f.file_type === 'MP4');
        if (recordingFile && recordingFile.download_url && c.env.ZOOM_ACCOUNT_ID && c.env.CLOUDFLARE_ACCOUNT_ID) {
            try {
                // Fix: Pass DB (c.env.DB) to ZoomService
                const zoomService = new ZoomService(c.env.ZOOM_ACCOUNT_ID, c.env.ZOOM_CLIENT_ID, c.env.ZOOM_CLIENT_SECRET, c.env.DB);
                // @ts-ignore - Assuming getAccessToken might be private/protected
                const zoomToken = await zoomService.getAccessToken();
                const streamService = new StreamService(c.env.CLOUDFLARE_ACCOUNT_ID, c.env.CLOUDFLARE_API_TOKEN);
                const downloadUrlWithToken = `${recordingFile.download_url}?access_token=${zoomToken}`;
                await streamService.uploadViaLink(downloadUrlWithToken, { name: payload.topic || `Meeting ${payload.id}` });
            } catch (e) {
                console.error("Failed to process recording upload", e);
            }
        }
    }
    return c.json({ received: true });
});

app.post('/clerk', async (c) => {
    // Clerk Webhook Logic (Preserved)
    const WEBHOOK_SECRET = c.env.CLERK_WEBHOOK_SECRET;
    if (!WEBHOOK_SECRET) return c.json({ error: 'Missing Clerk Webhook Secret' }, 500);

    const svix_id = c.req.header('svix-id');
    const svix_timestamp = c.req.header('svix-timestamp');
    const svix_signature = c.req.header('svix-signature');
    if (!svix_id || !svix_timestamp || !svix_signature) return c.json({ error: 'Missing Svix Headers' }, 400);

    const body = await c.req.text();
    const { Webhook } = await import('svix');
    let evt: any;
    try {
        const wh = new Webhook(WEBHOOK_SECRET);
        evt = wh.verify(body, { 'svix-id': svix_id, 'svix-timestamp': svix_timestamp, 'svix-signature': svix_signature });
    } catch (err: any) {
        return c.json({ error: 'Verification Failed' }, 400);
    }

    const eventType = evt.type;
    const { id, email_addresses, first_name, last_name, image_url, phone_numbers } = evt.data;
    const db = createDb(c.env.DB);

    if (eventType === 'user.created' || eventType === 'user.updated') {
        const email = email_addresses?.[0]?.email_address;
        if (!email) return c.json({ received: true });

        const profile: any = { firstName: first_name, lastName: last_name, portraitUrl: image_url, phoneNumber: phone_numbers?.[0]?.phone_number };

        if (eventType === 'user.created') {
            const existing = await db.select().from(users).where(eq(users.id, id)).get();
            if (!existing) {
                await db.insert(users).values({ id, email, profile, createdAt: new Date() }).run();
                if (c.env.RESEND_API_KEY) {
                    const { EmailService } = await import('../services/email');
                    const emailService = new EmailService(c.env.RESEND_API_KEY);
                    c.executionCtx.waitUntil(emailService.sendWelcome(email, first_name));
                }
            } else {
                await db.update(users).set({ email, profile }).where(eq(users.id, id)).run();
            }
        } else {
            await db.update(users).set({ email, profile }).where(eq(users.id, id)).run();
        }

        const meta = evt.data.unsafe_metadata || evt.data.public_metadata;
        if (meta && meta.tenantId) {
            const { tenantRoles, tenantMembers, tenants } = await import('db/src/schema');
            const ownerData = await db.select({ email: users.email, tenant: tenants })
                .from(tenantMembers)
                .innerJoin(tenantRoles, eq(tenantMembers.id, tenantRoles.memberId))
                .innerJoin(users, eq(tenantMembers.userId, users.id))
                .innerJoin(tenants, eq(tenantMembers.tenantId, tenants.id))
                .where(and(eq(tenantMembers.tenantId, meta.tenantId), eq(tenantRoles.role, 'owner')))
                .limit(1).get();
            if (ownerData && c.env.RESEND_API_KEY) {
                const { EmailService } = await import('../services/email');
                const emailService = new EmailService(c.env.RESEND_API_KEY, { branding: ownerData.tenant.branding as any, settings: ownerData.tenant.settings as any });
                c.executionCtx.waitUntil(emailService.notifyOwnerNewStudent(ownerData.email, `${first_name} ${last_name}`));
            }
        }
    }
    return c.json({ received: true });
});

app.post('/stripe', async (c) => {
    const signature = c.req.header('stripe-signature');
    const secret = (c.env as any).STRIPE_WEBHOOK_SECRET;

    if (!signature || !secret || !c.env.STRIPE_SECRET_KEY) return c.json({ error: 'Configuration Error' }, 500);

    const body = await c.req.text();
    const { Stripe } = await import('stripe');
    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, { apiVersion: '2025-12-15.clover' as any });

    let event;
    try {
        event = stripe.webhooks.constructEvent(body, signature, secret);
    } catch (err: any) {
        return c.json({ error: `Webhook Error: ${err.message}` }, 400);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as any;
        const { metadata, amount_total } = session;

        if (metadata && metadata.tenantId) {
            const db = createDb(c.env.DB);
            const { FulfillmentService } = await import('../services/fulfillment');
            const fulfillment = new FulfillmentService(db, c.env.RESEND_API_KEY);

            // 1. Pack Purchase Logic
            if (metadata.packId) {
                await fulfillment.fulfillPackPurchase(metadata, session.payment_intent as string, amount_total);
            }

            // 2. Gift Card Purchase Logic
            if (metadata.type === 'gift_card_purchase') {
                const amount = parseInt(metadata.amount || '0');
                if (amount > 0) {
                    await fulfillment.fulfillGiftCardPurchase(metadata, session.payment_intent as string, amount);
                }
            }

            // 3. Gift Card Redemption Logic
            if (metadata.usedGiftCardId && metadata.creditApplied) {
                const creditUsed = parseInt(metadata.creditApplied);
                if (creditUsed > 0) {
                    await fulfillment.redeemGiftCard(metadata.usedGiftCardId, creditUsed, session.payment_intent as string);
                }
            }
        }
    }

    return c.json({ received: true });
});

export default app;
