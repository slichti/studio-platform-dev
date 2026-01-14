import { Hono } from 'hono';
import { createDb } from '../db';
import { ZoomService } from '../services/zoom';
import { StreamService } from '../services/stream';
import * as schema from 'db/src/schema'; // Import all as schema
import { classes, users, classPackDefinitions, purchasedPacks, giftCards, giftCardTransactions, tenantMembers, tenants, tenantFeatures, tenantRoles } from 'db/src/schema'; // Keep explicit for existing code
import { eq, and, sql } from 'drizzle-orm';
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
        const meetingId = payload.id; // Zoom Meeting ID (BigInt often, so keep as is or stringify)

        if (recordingFile && recordingFile.download_url && c.env.ZOOM_ACCOUNT_ID && c.env.CLOUDFLARE_ACCOUNT_ID) {
            try {
                const db = createDb(c.env.DB);

                // 1. Find the Class assoc with this Meeting ID
                // Note: Zoom sends Long (number), DB stores text.
                const meetingIdStr = String(meetingId);
                const classRecord = await db.select({
                    id: classes.id,
                    tenantId: classes.tenantId,
                    tenant: tenants
                })
                    .from(classes)
                    .innerJoin(tenants, eq(classes.tenantId, tenants.id))
                    .where(eq(classes.zoomMeetingId, meetingIdStr))
                    .limit(1)
                    .get();

                if (!classRecord) {
                    console.log(`Zoom Recording: No class found for meeting ID ${meetingIdStr}. Skipping.`);
                    return c.json({ received: true });
                }

                // 2. Check Permissions (VOD Feature or Tier)
                const feature = await db.select()
                    .from(tenantFeatures)
                    .where(and(eq(tenantFeatures.tenantId, classRecord.tenantId), eq(tenantFeatures.featureKey, 'vod')))
                    .get();

                // Explicit enable OR implicit tier entitlement
                const isEnabled = (feature && feature.enabled) || ['scale', 'growth'].includes(classRecord.tenant.tier);

                if (!isEnabled) {
                    console.log(`Zoom Recording: VOD not enabled for tenant ${classRecord.tenant.slug}. Skipping download.`);
                    return c.json({ received: true });
                }

                // 3. Process Download
                // Fix: Pass DB (c.env.DB) to ZoomService
                const zoomService = new ZoomService(c.env.ZOOM_ACCOUNT_ID, c.env.ZOOM_CLIENT_ID, c.env.ZOOM_CLIENT_SECRET, c.env.DB);
                // @ts-ignore - Assuming getAccessToken might be private/protected
                const zoomToken = await zoomService.getAccessToken();
                const streamService = new StreamService(c.env.CLOUDFLARE_ACCOUNT_ID, c.env.CLOUDFLARE_API_TOKEN);
                const downloadUrlWithToken = `${recordingFile.download_url}?access_token=${zoomToken}`;

                // Use classRecord.id to link it optionally later? Original code just uploaded.
                await streamService.uploadViaLink(downloadUrlWithToken, {
                    name: payload.topic || `Meeting ${payload.id}`,
                    meta: { classId: classRecord.id, tenantId: classRecord.tenantId }
                });

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

        if (eventType === 'user.updated') {
            const meta = evt.data.unsafe_metadata || evt.data.public_metadata;
            // Trigger 'student.updated' for ALL tenants this user is a member of
            // We need to find all tenants for this user.
            const userMemberships = await db.query.tenantMembers.findMany({
                where: eq(tenantMembers.userId, id),
                with: { tenant: true }
            });

            if (userMemberships.length > 0) {
                const { AutomationsService } = await import('../services/automations');
                const { EmailService } = await import('../services/email');
                const { SmsService } = await import('../services/sms');
                const { UsageService } = await import('../services/pricing');

                for (const member of userMemberships) {
                    try {
                        const usageService = new UsageService(db, member.tenantId);
                        const resendKey = (member.tenant.resendCredentials as any)?.apiKey || c.env.RESEND_API_KEY;
                        const isByok = !!(member.tenant.resendCredentials as any)?.apiKey;

                        const emailService = new EmailService(
                            resendKey,
                            { branding: member.tenant.branding as any, settings: member.tenant.settings as any },
                            { slug: member.tenant.slug },
                            usageService,
                            isByok
                        );

                        const smsService = new SmsService(member.tenant.twilioCredentials as any, c.env, usageService, db, member.tenantId);
                        const autoService = new AutomationsService(db, member.tenantId, emailService, smsService);

                        c.executionCtx.waitUntil(autoService.dispatchTrigger('student_updated', {
                            userId: id,
                            email: email,
                            firstName: first_name,
                            lastName: last_name,
                            data: { memberId: member.id, changes: evt.data }
                        }));
                    } catch (e) {
                        console.error(`Failed to dispatch student.updated for tenant ${member.tenantId}`, e);
                    }
                }
            }
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

    if (eventType === 'user.deleted') {
        const { id } = evt.data;
        if (id) {
            // Manual Cascade Delete (cleaning up local references)
            // 1. Find all memberships
            const members = await db.select({ id: tenantMembers.id }).from(tenantMembers).where(eq(tenantMembers.userId, id)).all();

            // 2. Delete roles for those memberships
            if (members.length > 0) {
                const memberIds = members.map(m => m.id);
                const { inArray } = await import('drizzle-orm');
                await db.delete(tenantRoles).where(inArray(tenantRoles.memberId, memberIds)).run();
            }

            // 3. Delete memberships
            await db.delete(tenantMembers).where(eq(tenantMembers.userId, id)).run();

            // 4. Delete user record
            await db.delete(users).where(eq(users.id, id)).run();
            console.log(`User deleted via webhook: ${id}`);
        }
    }

    // Session Events (Audit Logging)
    if (eventType === 'session.created' || eventType === 'session.ended' || eventType === 'session.removed') {
        const { user_id } = evt.data;
        // Try to get headers from request for context (IP/UA), though webhook request context is Clerk's, not User's.
        // Clerk payload might have context? Usually not deep. We just log the event.

        const action = eventType === 'session.created' ? 'USER_LOGIN' : 'USER_LOGOUT';
        const { auditLogs } = await import('db/src/schema');

        await db.insert(auditLogs).values({
            id: crypto.randomUUID(),
            actorId: user_id,
            action: action,
            details: {
                message: `User ${action === 'USER_LOGIN' ? 'logged in' : 'logged out'}`,
                sessionId: evt.data.id,
                timestamp: new Date().toISOString()
            },
            createdAt: new Date()
        }).run();
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

    const eventType = event.type;
    const { DunningService } = await import('../services/dunning');

    // Handle Failed Payments (Dunning)
    if (eventType === 'invoice.payment_failed') {
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription;
        const customerId = invoice.customer;

        // Find tenant associated with this Stripe account (via connect or metadata)
        // Note: In Connect, the webhook comes to the platform but on behalf of the connected account?
        // Or if using standard connect, we might rely on metadata in the invoice/subscription.
        // Assuming subscription has tenantId in metadata or we find it via subscription ID lookup in DB.

        // Finding subscription in our DB to get tenantId
        const db = createDb(c.env.DB);
        const sub = await db.query.subscriptions.findFirst({
            where: eq(schema.subscriptions.stripeSubscriptionId, subscriptionId)
        });

        if (sub) {
            const { EmailService } = await import('../services/email');

            // We need tenant settings for email service (branding, etc)
            const tenant = await db.query.tenants.findFirst({
                where: eq(schema.tenants.id, sub.tenantId)
            });

            if (tenant) {
                const emailService = c.env.RESEND_API_KEY
                    ? new EmailService(c.env.RESEND_API_KEY, { branding: tenant.branding as any, settings: tenant.settings as any })
                    : undefined;

                const dunningService = new DunningService(db, sub.tenantId, emailService);

                // Get member email
                const member = await db.query.tenantMembers.findFirst({
                    where: eq(schema.tenantMembers.id, sub.memberId as string),
                    with: { user: true }
                });

                if (member && member.user && member.user.email) {
                    const profile = member.user.profile as any || {};
                    const firstName = profile.first_name || profile.firstName || 'Member';

                    await dunningService.handleFailedPayment({
                        invoiceId: invoice.id,
                        customerId: customerId,
                        subscriptionId: subscriptionId,
                        amountDue: invoice.amount_due,
                        currency: invoice.currency,
                        attemptCount: invoice.attempt_count
                    }, member.user.email, firstName);
                }
            }
        }
    }

    // Handle Successful Payments (Recovery)
    if (eventType === 'invoice.paid') {
        const invoice = event.data.object as any;
        const subscriptionId = invoice.subscription;

        if (subscriptionId) {
            const db = createDb(c.env.DB);
            // Find subscription to look up tenant
            const sub = await db.query.subscriptions.findFirst({
                where: eq(schema.subscriptions.stripeSubscriptionId, subscriptionId)
            });

            if (sub) {
                const dunningService = new DunningService(db, sub.tenantId);
                await dunningService.handlePaymentRecovered(subscriptionId);
            }
        }
    }

    if (eventType === 'checkout.session.completed') {
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

            // 4. General Product Purchase Logic (Trigger Automation)
            // If items are present in metadata (passed from POS or Checkout)
            // Trigger 'product_purchase'
            // We need to resolve User ID. `session.customer` is Stripe Customer ID.
            // We need to find the local user linked to this Stripe Customer or Email.
            if (metadata.tenantId) {
                const { AutomationsService } = await import('../services/automations');
                const { EmailService } = await import('../services/email');
                const { SmsService } = await import('../services/sms');
                const { UsageService } = await import('../services/pricing');

                try {
                    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, metadata.tenantId) });
                    if (tenant) {
                        const usageService = new UsageService(db, tenant.id);
                        const resendKey = (tenant.resendCredentials as any)?.apiKey || c.env.RESEND_API_KEY;
                        const isByok = !!(tenant.resendCredentials as any)?.apiKey;
                        const emailService = new EmailService(resendKey, { branding: tenant.branding as any, settings: tenant.settings as any }, { slug: tenant.slug }, usageService, isByok);
                        const smsService = new SmsService(tenant.twilioCredentials as any, c.env, usageService, db, tenant.id);
                        const autoService = new AutomationsService(db, tenant.id, emailService, smsService);

                        // Resolve User
                        let userId = null;
                        const stripeCustomerId = session.customer as string;
                        const email = session.customer_details?.email;

                        if (stripeCustomerId) {
                            const u = await db.query.users.findFirst({ where: eq(users.stripeCustomerId, stripeCustomerId) });
                            if (!u && email) {
                                userId = (await db.query.users.findFirst({ where: eq(users.email, email) }))?.id;
                            } else {
                                userId = u?.id;
                            }
                        } else if (email) {
                            userId = (await db.query.users.findFirst({ where: eq(users.email, email) }))?.id;
                        }

                        if (userId) {
                            c.executionCtx.waitUntil(autoService.dispatchTrigger('product_purchase', {
                                userId,
                                email: email || '',
                                firstName: session.customer_details?.name?.split(' ')[0] || 'Friend',
                                data: { amount: amount_total, metadata: metadata }
                            }));
                        }
                    }
                } catch (e) { console.error('Failed to trigger product_purchase', e); }
            }
        }
    }

    if (event.type === 'customer.subscription.updated') {
        const subscription = event.data.object as any;
        const tenantId = subscription.metadata?.tenantId;

        // Check for Cancellation
        if (subscription.cancel_at_period_end && tenantId) {
            const db = createDb(c.env.DB);
            const { AutomationsService } = await import('../services/automations');
            const { EmailService } = await import('../services/email');
            const { SmsService } = await import('../services/sms');
            const { UsageService } = await import('../services/pricing');

            try {
                const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
                if (tenant) {
                    const usageService = new UsageService(db, tenant.id);
                    const resendKey = (tenant.resendCredentials as any)?.apiKey || c.env.RESEND_API_KEY;
                    const isByok = !!(tenant.resendCredentials as any)?.apiKey;
                    const emailService = new EmailService(resendKey, { branding: tenant.branding as any, settings: tenant.settings as any }, { slug: tenant.slug }, usageService, isByok);
                    const smsService = new SmsService(tenant.twilioCredentials as any, c.env, usageService, db, tenant.id);
                    const autoService = new AutomationsService(db, tenant.id, emailService, smsService);

                    // Resolve User
                    const stripeCustomerId = subscription.customer as string;
                    const user = await db.query.users.findFirst({ where: eq(users.stripeCustomerId, stripeCustomerId) });

                    if (user) {
                        c.executionCtx.waitUntil(autoService.dispatchTrigger('subscription_canceled', {
                            userId: user.id,
                            email: user.email,
                            firstName: (user.profile as any)?.firstName,
                            data: { planId: subscription.metadata?.planId, subscriptionId: subscription.id }
                        }));
                    }
                }
            } catch (e) { console.error('Failed to trigger subscription_canceled', e); }
        }
    }

    if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object as any;
        const tenantId = subscription.metadata?.tenantId;
        if (tenantId) {
            const db = createDb(c.env.DB);
            const { AutomationsService } = await import('../services/automations');
            const { EmailService } = await import('../services/email');
            const { SmsService } = await import('../services/sms');
            const { UsageService } = await import('../services/pricing');

            try {
                const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
                if (tenant) {
                    const usageService = new UsageService(db, tenant.id);
                    const resendKey = (tenant.resendCredentials as any)?.apiKey || c.env.RESEND_API_KEY;
                    const isByok = !!(tenant.resendCredentials as any)?.apiKey;
                    const emailService = new EmailService(resendKey, { branding: tenant.branding as any, settings: tenant.settings as any }, { slug: tenant.slug }, usageService, isByok);
                    const smsService = new SmsService(tenant.twilioCredentials as any, c.env, usageService, db, tenant.id);
                    const autoService = new AutomationsService(db, tenant.id, emailService, smsService);

                    // Resolve User
                    const stripeCustomerId = subscription.customer as string;
                    const user = await db.query.users.findFirst({ where: eq(users.stripeCustomerId, stripeCustomerId) });

                    if (user) {
                        c.executionCtx.waitUntil(autoService.dispatchTrigger('subscription_terminated', {
                            userId: user.id,
                            email: user.email,
                            firstName: (user.profile as any)?.firstName,
                            data: { planId: subscription.metadata?.planId }
                        }));
                    }
                }
            } catch (e) { console.error('Failed to trigger subscription_terminated', e); }
        }
    }

    return c.json({ received: true });
});

export default app;
