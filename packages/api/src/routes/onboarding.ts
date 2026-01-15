import { Hono } from 'hono';
import { createDb } from '../db';
import { tenants, tenantMembers, tenantRoles, users, auditLogs } from 'db/src/schema'; // Ensure exported
import { eq } from 'drizzle-orm';
import { rateLimit } from '../middleware/rateLimit';

type Bindings = {
    STRIPE_SECRET_KEY: string;
    STRIPE_PRICE_GROWTH?: string;
    STRIPE_PRICE_SCALE?: string;
    CLERK_SECRET_KEY: string;
    RESEND_API_KEY: string;
    PLATFORM_ADMIN_EMAIL?: string; // Optional config for alerts
    DB: D1Database;
};

type Variables = {
    auth: {
        userId: string;
        claims?: any;
    };
}

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// POST /studio - Create new tenant & cleanup user
app.post('/studio', rateLimit({ limit: 5, window: 300, keyPrefix: 'onboarding' }), async (c) => {
    const auth = c.get('auth');
    if (!auth?.userId) {
        return c.json({ error: "Unauthorized" }, 401);
    }

    // Enforce Email Verification
    // 1. Try checking the token claim (fastest)
    let isVerified = auth.claims?.email_verified;

    // 2. If claim is missing/false, check the Clerk API directly (slower but robust)
    // This handles cases where the JWT template is missing the 'email_verified' claim (common in default Clerk setups)
    if (!isVerified) {
        try {
            const clerkRes = await fetch(`https://api.clerk.com/v1/users/${auth.userId}`, {
                headers: {
                    'Authorization': `Bearer ${c.env.CLERK_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (clerkRes.ok) {
                const clerkUser: any = await clerkRes.json();
                const primaryEmailId = clerkUser.primary_email_address_id;
                const primaryEmail = clerkUser.email_addresses.find((e: any) => e.id === primaryEmailId);

                if (primaryEmail?.verification?.status === 'verified') {
                    isVerified = true;
                }
            } else {
                console.error("Clerk API Verification Check Failed:", await clerkRes.text());
            }
        } catch (err) {
            console.error("Clerk API Fetch Error:", err);
        }
    }

    if (!isVerified) {
        return c.json({
            error: "Email verification required",
            code: "EMAIL_NOT_VERIFIED",
            // Debug info to help diagnose if this persists
            debug: { claim: auth.claims?.email_verified }
        }, 403);
    }

    const { name, slug, tier } = await c.req.json();
    const db = createDb(c.env.DB);

    // 1. Validate Input
    if (!name || !slug) {
        return c.json({ error: "Name and Slug are required" }, 400);
    }

    // 2. Reserved Slugs
    const reserved = ['admin', 'api', 'www', 'app', 'studio'];
    if (reserved.includes(slug.toLowerCase())) {
        return c.json({ error: "Slug is reserved" }, 400);
    }

    // 3. Create Tenant
    const tenantId = crypto.randomUUID();
    const newTenant = {
        id: tenantId,
        name,
        slug: slug.toLowerCase(),
        tier: tier || 'basic',
        status: 'active' as const,
        createdAt: new Date(),
        settings: { enableStudentRegistration: true } // Default to enabling public registration for new self-service studios
    };

    try {
        await db.insert(tenants).values(newTenant).run();

        // 4. Add User as Owner
        // First check if user exists in our DB (Synced from Clerk Webhook)
        // If not, we might need to insert them? 
        // Typically Clerk webhook handles this. If user just signed up, webhook might trail slightly.
        // We can upsert user here if needed, but 'users' table is mainly for caching profile.
        // Assuming user exists or foreign key might fail? 
        // Our schema: `tenantMembers.userId` references `users.id`.
        // So user MUST exist in `users` table.
        // We can force a check/insert.

        let user = await db.query.users.findFirst({
            where: eq(users.id, auth.userId)
        });

        if (!user) {
            return c.json({ error: "User profile not yet synced. Please try again in a few seconds." }, 404);
        }

        // Phase 14: SaaS Billing
        let stripeCustomerId = null;
        let stripeSubscriptionId = null;
        let subscriptionStatus = 'active';

        if (['growth', 'scale'].includes(tier)) {
            // Check for System Admin Bypass
            if (user.isPlatformAdmin) {
                subscriptionStatus = 'active';
                stripeSubscriptionId = 'COMPED_ADMIN';
            } else {
                try {
                    const { StripeService } = await import('../services/stripe');
                    const stripe = new StripeService(c.env.STRIPE_SECRET_KEY);

                    // 1. Create Customer
                    const profile = user.profile as any;
                    const customer = await stripe.createCustomer({ email: user.email, name: `${name} (Owner: ${profile?.firstName || ''} ${profile?.lastName || ''})` });
                    stripeCustomerId = customer.id;

                    // 2. Create Subscription (Trial)
                    const priceId = tier === 'growth' ? c.env.STRIPE_PRICE_GROWTH : c.env.STRIPE_PRICE_SCALE;

                    if (priceId) {
                        const sub = await stripe.createSubscription(stripeCustomerId, priceId, 14); // 14 day trial
                        stripeSubscriptionId = sub.id;
                        subscriptionStatus = 'trialing';
                    }
                } catch (err: any) {
                    console.error("Stripe Onboarding Error:", err);
                }
            }
        }

        // Update Tenant with Stripe Info
        if (stripeCustomerId) {
            await db.update(tenants).set({
                stripeCustomerId,
                stripeSubscriptionId,
                subscriptionStatus: subscriptionStatus as any
            }).where(eq(tenants.id, tenantId)).run();
        }

        const memberId = crypto.randomUUID();
        await db.insert(tenantMembers).values({
            id: memberId,
            tenantId,
            userId: auth.userId,
            status: 'active'
        }).run();

        await db.insert(tenantRoles).values({
            memberId,
            role: 'owner'
        }).run();

        // 5. Admin Audit Log (New Tenant)
        try {
            await db.insert(auditLogs).values({
                id: crypto.randomUUID(),
                action: 'tenant.created',
                actorId: auth.userId,
                targetId: tenantId,
                details: {
                    name: newTenant.name,
                    slug: newTenant.slug,
                    tier: newTenant.tier,
                    ownerEmail: user.email,
                    ownerName: `${(user.profile as any)?.firstName} ${(user.profile as any)?.lastName}`
                },
                ipAddress: c.req.header('CF-Connecting-IP') || 'unknown'
            }).run();
        } catch (e) {
            console.error("Failed to log audit event", e);
            // Non-blocking
        }

        // 6. Notifications
        if (c.env.RESEND_API_KEY) {
            try {
                const { EmailService } = await import('../services/email');
                // Use Platform API Key for onboarding notifications
                // Pass db and tenantId for logging
                const emailService = new EmailService(
                    c.env.RESEND_API_KEY,
                    undefined,
                    undefined,
                    undefined,
                    false,
                    db,
                    tenantId
                );

                const profile = user.profile as any || {};
                const ownerName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Studio Owner';
                // Construct Login URL - assuming standard subdomain or main app
                // For dev/test: http://localhost:5173 or similar, but in prod it's ...
                // Let's use origin logic helper or just hardcode main app URL?
                // `c.req.url` origin might be API. Web is usually `studio-platform-web.pages.dev`
                // Let's make a best guess or use env var if we had `WEB_URL`.
                // For now: https://studio-platform-web.pages.dev
                const loginUrl = 'https://studio-platform-web.pages.dev/login';

                // 6a. Welcome Owner
                c.executionCtx.waitUntil(emailService.sendWelcomeOwner(user.email, ownerName, newTenant.name, loginUrl));

                // 6b. Alert Admin
                // Use configured admin email or fallback to a known hardcoded one for now if ENV missing
                const adminEmail = c.env.PLATFORM_ADMIN_EMAIL || 'slichti@gmail.com'; // Fallback
                c.executionCtx.waitUntil(emailService.sendNewTenantAlert(adminEmail, {
                    name: newTenant.name,
                    slug: newTenant.slug,
                    tier: newTenant.tier,
                    ownerEmail: user.email
                }));

            } catch (e) {
                console.error("Failed to send onboarding notifications", e);
            }
        }

        return c.json({ tenant: newTenant }, 201);
    } catch (e: any) {
        if (e.message?.includes('UNIQUE constraint failed')) {
            return c.json({ error: "Slug already taken" }, 409);
        }
        return c.json({ error: e.message }, 500);
    }
});

export default app;
