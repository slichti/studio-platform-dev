import { Hono } from 'hono';
import { createDb } from '../db';
import { ZoomService } from '../services/zoom';
import { StreamService } from '../services/stream';
import * as schema from '@studio/db/src/schema'; // Import all as schema
import { classes, users, classPackDefinitions, purchasedPacks, giftCards, giftCardTransactions, tenantMembers, tenants, tenantFeatures, tenantRoles } from '@studio/db/src/schema'; // Keep explicit for existing code
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
    PLATFORM_ADMIN_EMAIL?: string;
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
                            isByok,
                            db,
                            member.tenantId
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

                        // Explicitly trigger contact_updated for profile changes
                        c.executionCtx.waitUntil(autoService.dispatchTrigger('contact_updated', {
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
            const { tenantRoles, tenantMembers, tenants } = await import('@studio/db/src/schema');
            const ownerData = await db.select({ email: users.email, tenant: tenants })
                .from(tenantMembers)
                .innerJoin(tenantRoles, eq(tenantMembers.id, tenantRoles.memberId))
                .innerJoin(users, eq(tenantMembers.userId, users.id))
                .innerJoin(tenants, eq(tenantMembers.tenantId, tenants.id))
                .where(and(eq(tenantMembers.tenantId, meta.tenantId), eq(tenantRoles.role, 'owner')))
                .limit(1).get();
            if (ownerData && c.env.RESEND_API_KEY) {
                const { EmailService } = await import('../services/email');
                const emailService = new EmailService(
                    c.env.RESEND_API_KEY,
                    { branding: ownerData.tenant.branding as any, settings: ownerData.tenant.settings as any },
                    undefined,
                    undefined,
                    false,
                    db,
                    meta.tenantId as string
                );
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
        const { auditLogs } = await import('@studio/db/src/schema');

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
    const secret = c.env.STRIPE_WEBHOOK_SECRET;

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

    const db = createDb(c.env.DB);
    const { processedWebhooks } = await import('@studio/db/src/schema');

    // Idempotency Check
    const existing = await db.select().from(processedWebhooks).where(eq(processedWebhooks.id, event.id)).get();
    if (existing) {
        return c.json({ received: true });
    }

    // Process Event
    try {
        const { StripeWebhookHandler } = await import('../services/stripe-webhook');
        const handler = new StripeWebhookHandler(c.env);
        await handler.process(event);

        // Mark as Processed
        await db.insert(processedWebhooks).values({ id: event.id, type: 'stripe' }).run();

    } catch (err) {
        console.error('Webhook Processing Failed:', err);
        // We return 200 to Stripe to stop retries if it's a logic error we can't fix, 
        // OR 500 if we want retry. Secure default is usually 200 + alert, but standard pattern is 500 for retry.
        // Given we are logging errors in Handler, let's return 200 if we want to suppress noise, or 500 if critical.
        // Let's return 500 to allow retry for transient issues.
        return c.json({ error: 'Internal Server Error' }, 500);
    }

    return c.json({ received: true });
});

// Twilio SMS Webhook - Handle STOP opt-outs (TCPA Compliance)
app.post('/twilio/sms', async (c) => {
    // Twilio sends form-urlencoded data
    const formData = await c.req.formData();
    const from = formData.get('From') as string;
    const body = (formData.get('Body') as string || '').trim().toUpperCase();

    console.log(`[Twilio SMS] Received from ${from}: ${body}`);

    // Handle STOP keyword for opt-out
    if (['STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'].includes(body)) {
        const db = createDb(c.env.DB);
        const { SmsService } = await import('../services/sms');

        // Create a minimal SmsService just for opt-out handling
        const smsService = new SmsService(undefined, c.env, undefined, db, 'system');
        const result = await smsService.handleOptOut(from);

        console.log(`[Twilio SMS] Opt-out processed for ${from}: ${result.membersUpdated} members updated`);

        // TwiML response confirming opt-out
        return new Response(
            `<?xml version="1.0" encoding="UTF-8"?>
            <Response>
                <Message>You have been unsubscribed from SMS messages. Reply START to re-subscribe.</Message>
            </Response>`,
            { headers: { 'Content-Type': 'text/xml' } }
        );
    }

    // Handle START keyword for re-subscription
    if (['START', 'YES', 'UNSTOP'].includes(body)) {
        // Note: Re-subscription would require finding and updating the user
        // For now, we just acknowledge the intent
        return new Response(
            `<?xml version="1.0" encoding="UTF-8"?>
            <Response>
                <Message>To re-subscribe to SMS messages, please update your preferences in your account settings.</Message>
            </Response>`,
            { headers: { 'Content-Type': 'text/xml' } }
        );
    }

    // Default: Empty TwiML response (no reply needed for other messages)
    return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
    );
});

export default app;
