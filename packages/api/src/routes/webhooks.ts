import { Hono } from 'hono';
import { createDb } from '../db';
import { ZoomService } from '../services/zoom';
import { StreamService } from '../services/stream';
import * as schema from '@studio/db/src/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { HonoContext } from '../types';
import { AggregatorService } from '../services/aggregators';
import { tenants, processedWebhooks } from '@studio/db/src/schema'; // For lookup
import { verifyHmacSignature } from '../utils/security';
import { AppError, NotFoundError, UnauthorizedError, BadRequestError } from '../utils/errors';

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
                const results = await db.select().from(schema.classes).innerJoin(schema.tenants, eq(schema.classes.tenantId, schema.tenants.id)).where(eq(schema.classes.zoomMeetingId, String(payload.id))).limit(1).all();
                const cl = results[0];
                if (cl && (['growth', 'scale'].includes(cl.tenants.tier))) {
                    const zs = new ZoomService(c.env.ZOOM_ACCOUNT_ID!, c.env.ZOOM_CLIENT_ID!, c.env.ZOOM_CLIENT_SECRET!, c.env.DB);
                    const ss = new StreamService(c.env.CLOUDFLARE_ACCOUNT_ID!, c.env.CLOUDFLARE_API_TOKEN!);
                    await ss.uploadViaLink(`${recording.download_url}?access_token=${await (zs as any).getAccessToken()}`, { name: payload.topic || `Meeting ${payload.id}`, meta: { classId: cl.classes.id, tenantId: cl.classes.tenantId } });

                    await db.insert(schema.auditLogs).values({
                        id: crypto.randomUUID(),
                        action: 'zoom.recording_uploaded',
                        actorId: 'system',
                        tenantId: cl.classes.tenantId,
                        targetId: cl.classes.id,
                        details: { meetingId: payload.id, topic: payload.topic },
                        createdAt: new Date()
                    }).run();
                }
            } catch (e) { console.error(e); }
        }
    }
    return c.json({ received: true });
});

app.post('/clerk', async (c) => {
    const secret = c.env.CLERK_WEBHOOK_SECRET;
    if (!secret) throw new AppError('Server configuration missing for webhooks', 500, 'MISSING_SECRET');
    const { Webhook } = await import('svix');
    let evt: any;
    try {
        evt = new Webhook(secret).verify(await c.req.text(), {
            'svix-id': c.req.header('svix-id')!,
            'svix-timestamp': c.req.header('svix-timestamp')!,
            'svix-signature': c.req.header('svix-signature')!
        });
    } catch (e) {
        throw new UnauthorizedError('Clerk signature verification failed');
    }

    const db = createDb(c.env.DB);
    const { id, email_addresses, first_name, last_name, image_url, phone_numbers } = evt.data;
    if (evt.type === 'user.created' || evt.type === 'user.updated') {
        const email = email_addresses?.[0]?.email_address;
        if (email) {
            const profile = { firstName: first_name, lastName: last_name, portraitUrl: image_url, phoneNumber: phone_numbers?.[0]?.phone_number };
            await db.insert(schema.users).values({ id, email, profile, createdAt: new Date() }).onConflictDoUpdate({ target: schema.users.id, set: { email, profile } }).run();

            // [NEW] Audit Log user lifecycle
            await db.insert(schema.auditLogs).values({
                id: crypto.randomUUID(),
                action: evt.type === 'user.created' ? 'user.signed_up' : 'user.profile_updated',
                actorId: id,
                targetId: id,
                details: { email, type: evt.type },
                createdAt: new Date()
            }).run();

            // Dispatch triggers...
            c.executionCtx.waitUntil((async () => {
                const mems = await db.query.tenantMembers.findMany({ where: eq(schema.tenantMembers.userId, id), with: { tenant: true } });
                const { EmailService } = await import('../services/email');
                const { AutomationsService } = await import('../services/automations');
                const { SmsService } = await import('../services/sms');
                const { PushService } = await import('../services/push');
                const { UsageService } = await import('../services/pricing');
                for (const m of mems) {
                    const us = new UsageService(db, m.tenantId);
                    const es = new EmailService((m.tenant.resendCredentials as any)?.apiKey || c.env.RESEND_API_KEY!, { branding: m.tenant.branding as any, settings: m.tenant.settings as any }, { slug: m.tenant.slug }, us, !!(m.tenant.resendCredentials as any)?.apiKey, db, m.tenantId);
                    const ps = new PushService(db, m.tenantId);
                    const as = new AutomationsService(db, m.tenantId, es, new SmsService(m.tenant.twilioCredentials as any, c.env, us, db, m.tenantId), ps);
                    await as.dispatchTrigger('contact_updated', { userId: id, email, firstName: first_name, lastName: last_name, data: { memberId: m.id } });
                }
            })());
        }
    }
    if (evt.type === 'user.deleted') {
        const mems = await db.select({ id: schema.tenantMembers.id }).from(schema.tenantMembers).where(eq(schema.tenantMembers.userId, id)).all();
        if (mems.length) await db.delete(schema.tenantRoles).where(inArray(schema.tenantRoles.memberId, mems.map(m => m.id))).run();
        await db.delete(schema.tenantMembers).where(eq(schema.tenantMembers.userId, id)).run();
        await db.delete(schema.users).where(eq(schema.users.id, id)).run();

        // [NEW] Audit Log user deletion
        await db.insert(schema.auditLogs).values({
            id: crypto.randomUUID(),
            action: 'user.deleted',
            actorId: 'system',
            targetId: id,
            details: { type: 'user.deleted' },
            createdAt: new Date()
        }).run();
    }
    return c.json({ received: true });
});

app.post('/stripe', async (c) => {
    const sig = c.req.header('stripe-signature');
    const secret = c.env.STRIPE_WEBHOOK_SECRET;
    if (!sig || !secret || !c.env.STRIPE_SECRET_KEY) throw new AppError('Server configuration missing for Stripe', 500, 'MISSING_SECRET');

    const { Stripe } = await import('stripe');
    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY as string, { apiVersion: '2026-01-28.clover' as any });
    let event;
    try {
        event = stripe.webhooks.constructEvent(await c.req.text(), sig, secret);
    } catch (e: any) {
        throw new UnauthorizedError(`Stripe signature verification failed: ${e.message}`);
    }

    const db = createDb(c.env.DB);
    if (await db.select().from(schema.processedWebhooks).where(eq(schema.processedWebhooks.id, event.id)).get()) return c.json({ received: true });

    // [NEW] Audit Log inbound Stripe event
    await db.insert(schema.auditLogs).values({
        id: crypto.randomUUID(),
        action: 'webhook.received',
        actorId: 'system',
        targetId: event.id,
        details: { source: 'stripe', type: event.type },
        createdAt: new Date()
    }).run();

    try {
        const { StripeWebhookHandler } = await import('../services/stripe-webhook');
        await new StripeWebhookHandler(c.env).process(event);
        await db.insert(schema.processedWebhooks).values({ id: event.id, type: 'stripe' }).run();
    } catch (e: any) {
        throw new AppError(e.message || 'Failed to process Stripe event', 500, 'STRIPE_WEBHOOK_ERROR');
    }
    return c.json({ received: true });
});

// --- Aggregator Webhooks ---

/**
 * ClassPass Booking/Cancellation Webhook
 */
app.post('/classpass', async (c) => {
    const rawBody = await c.req.text();
    const body = JSON.parse(rawBody);
    const db = createDb(c.env.DB);

    const partnerId = c.req.header('X-Partner-Id');
    const signature = c.req.header('X-ClassPass-Signature');

    if (!partnerId || !signature) throw new UnauthorizedError('Missing authentication headers');

    const tenant = await db.query.tenants.findFirst({
        where: sql`${schema.tenants.aggregatorConfig}->'classpass'->>'partnerId' = ${partnerId}`
    });

    if (!tenant) throw new NotFoundError('Tenant matching partnerId not found');

    // 1. Verify Signature
    const secret = (tenant.aggregatorConfig as any)?.classpass?.webhookSecret;
    if (!secret) throw new BadRequestError('Tenant missing ClassPass secret');

    const isValid = await verifyHmacSignature(rawBody, secret, signature);
    if (!isValid) throw new UnauthorizedError('Invalid ClassPass signature');

    // 2. Track Idempotency
    const eventId = `classpass:${body.reservation?.id || body.event_id}`;
    const exists = await db.select().from(processedWebhooks).where(eq(processedWebhooks.id, eventId)).get();
    if (exists) return c.json({ success: true, duplicated: true });

    // [NEW] Audit Log inbound request
    await db.insert(schema.auditLogs).values({
        id: crypto.randomUUID(),
        action: 'webhook.received',
        actorId: 'system',
        tenantId: tenant.id,
        targetId: eventId,
        details: { source: 'classpass', type: body.type, body: body },
        createdAt: new Date()
    }).run();

    const service = new AggregatorService(db, c.env, tenant.id);

    try {
        if (body.type === 'RESERVATION_CREATE') {
            await service.processPartnerBooking({
                classId: body.reservation.class_id,
                externalSource: 'classpass',
                externalId: body.reservation.id,
                userEmail: body.user.email,
                userFirstName: body.user.first_name,
                userLastName: body.user.last_name
            });
        } else if (body.type === 'RESERVATION_CANCEL') {
            await service.processPartnerCancellation('classpass', body.reservation.id);
        }

        await db.insert(processedWebhooks).values({ id: eventId, type: 'classpass' }).run();
    } catch (e: any) {
        throw new AppError(e.message, 500, 'AGGREGATOR_ERROR');
    }

    return c.json({ success: true });
});

/**
 * Gympass (Wellhub) Notify Webhook
 */
app.post('/gympass', async (c) => {
    const rawBody = await c.req.text();
    const body = JSON.parse(rawBody);
    const db = createDb(c.env.DB);

    const signature = c.req.header('X-Gympass-Signature');
    if (!signature) throw new UnauthorizedError('Missing signature');

    // Validate gym_id format before any DB lookup (prevent enumeration/injection)
    const tenantId = body.gym_id;
    if (!tenantId || typeof tenantId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(tenantId)) {
        throw new BadRequestError('Invalid gym_id format');
    }

    const tenant = await db.query.tenants.findFirst({ where: eq(schema.tenants.id, tenantId) });
    if (!tenant) throw new NotFoundError('Invalid gym_id');

    // Verify signature before acting on payload
    const secret = (tenant.aggregatorConfig as any)?.gympass?.webhookSecret;
    if (!secret) throw new BadRequestError('Tenant missing Gympass secret');

    const isValid = await verifyHmacSignature(rawBody, secret, signature);
    if (!isValid) throw new UnauthorizedError('Invalid Gympass signature');

    // 2. Track Idempotency
    const eventId = `gympass:${body.data?.booking_id || body.event_id}`;
    const exists = await db.select().from(processedWebhooks).where(eq(processedWebhooks.id, eventId)).get();
    if (exists) return c.json({ success: true, duplicated: true });

    // [NEW] Audit Log inbound request
    await db.insert(schema.auditLogs).values({
        id: crypto.randomUUID(),
        action: 'webhook.received',
        actorId: 'system',
        tenantId: tenant.id,
        targetId: eventId,
        details: { source: 'gympass', type: body.event, body: body },
        createdAt: new Date()
    }).run();

    const service = new AggregatorService(db, c.env, tenant.id);

    try {
        if (body.event === 'booking.created') {
            await service.processPartnerBooking({
                classId: body.data.class_id,
                externalSource: 'gympass',
                externalId: body.data.booking_id,
                userEmail: body.user.email,
                userFirstName: body.user.first_name,
                userLastName: body.user.last_name
            });
        } else if (body.event === 'booking.cancelled') {
            await service.processPartnerCancellation('gympass', body.data.booking_id);
        }

        await db.insert(processedWebhooks).values({ id: eventId, type: 'gympass' }).run();
    } catch (e: any) {
        throw new AppError(e.message, 500, 'AGGREGATOR_ERROR');
    }

    return c.json({ success: true });
});

export default app;
