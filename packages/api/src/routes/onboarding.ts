import { Hono } from 'hono';
import { createDb } from '../db';
import { tenants, tenantMembers, tenantRoles, users, auditLogs, websitePages, platformPlans, locations, classes, classSeries } from '@studio/db/src/schema';
import { eq, and, sql } from 'drizzle-orm';
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

// GET /check-slug?slug=example
app.get('/check-slug', async (c) => {
    const { slug } = c.req.query();
    if (!slug) return c.json({ error: "Slug required" }, 400);

    // Validate format: alphanumeric and dashes only, min 3 chars
    if (!/^[a-z0-9-]{3,}$/.test(slug)) {
        return c.json({ valid: false, reason: "Invalid format. Use a-z, 0-9, and dashes. Min 3 chars." });
    }

    const reserved = ['admin', 'api', 'www', 'app', 'studio'];
    if (reserved.includes(slug)) {
        return c.json({ valid: false, reason: "Reserved word" });
    }

    const db = createDb(c.env.DB);
    const existing = await db.select().from(tenants).where(eq(tenants.slug, slug)).get();

    return c.json({ valid: !existing });
});

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
    if (!/^[a-z0-9-]{3,}$/.test(slug)) {
        return c.json({ error: "Invalid slug format" }, 400);
    }

    // 2. Reserved Slugs
    const reserved = ['admin', 'api', 'www', 'app', 'studio'];
    if (reserved.includes(slug.toLowerCase())) {
        return c.json({ error: "Slug is reserved" }, 400);
    }

    // 2b. Dynamic Plan Lookup
    const plan = await db.select().from(platformPlans).where(eq(platformPlans.slug, tier)).get();

    // Fallback for legacy hardcoded tiers if they haven't been migrated to DB yet (optional, but good for safety)
    // For this refactor, we assume all valid tiers are in the DB.
    if (!plan && tier !== 'launch') {
        // Allow 'launch' as a hardcoded fallback if db is empty? 
        // Actually, let's assume 'Launch' is in DB too.
        // If user sends a tier that isn't in DB, they might be trying to hack or using old UI.
        // Let's enforce DB existence unless it's 'launch' and we want to be lenient during migration.
        return c.json({ error: "Invalid plan selected" }, 400);
    }

    // 3. Create Tenant
    const tenantId = crypto.randomUUID();
    const newTenant = {
        id: tenantId,
        name,
        slug: slug.toLowerCase(),
        tier: tier,
        status: 'active' as const,
        createdAt: new Date(),
        settings: { enableStudentRegistration: true }
    };

    try {
        await db.insert(tenants).values(newTenant).run();

        // 4. Add User as Owner
        let user = await db.query.users.findFirst({
            where: eq(users.id, auth.userId)
        });


        if (!user) {
            return c.json({ error: "User profile not yet synced. Please try again in a few seconds." }, 404);
        }

        // Phase 14: SaaS Billing (Dynamic)
        let stripeCustomerId = null;
        let stripeSubscriptionId = null;
        let subscriptionStatus = 'active';

        // Check if plan has a price for the selected interval
        const { interval } = await c.req.json(); // Re-read interval
        const priceId = interval === 'annual' ? plan?.stripePriceIdAnnual : plan?.stripePriceIdMonthly;

        if (priceId) {
            // Check for System Admin Bypass
            if (user.isPlatformAdmin) {
                subscriptionStatus = 'active';
                stripeSubscriptionId = 'COMPED_ADMIN';
            } else {
                try {
                    const { StripeService } = await import('../services/stripe');
                    const stripe = new StripeService(c.env.STRIPE_SECRET_KEY as string);

                    // 1. Create Customer
                    const profile = user.profile as any;
                    const customer = await stripe.createCustomer({ email: user.email, name: `${name} (Owner: ${profile?.firstName || ''} ${profile?.lastName || ''})` });
                    stripeCustomerId = customer.id;

                    // 2. Create Subscription (Trial from Plan)
                    // Default to 14 days if not set in plan
                    const trialDays = plan?.trialDays ?? 14;

                    if (priceId) {
                        const sub = await stripe.createSubscription(stripeCustomerId, priceId, trialDays);
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
            id: crypto.randomUUID(),
            memberId: memberId,
            role: 'owner'
        }).run();

        // 4b. Create Default Home Page for Public Access
        try {
            const defaultHomePageContent = {
                root: {
                    props: {
                        title: newTenant.name,
                        chatEnabled: true
                    }
                },
                content: [
                    {
                        type: 'Hero',
                        props: {
                            title: `Welcome to ${newTenant.name}`,
                            subtitle: 'Discover your practice with us',
                            ctaText: 'View Schedule',
                            ctaLink: `/studio/${newTenant.slug}/classes`,
                            backgroundImage: ''
                        }
                    },
                    {
                        type: 'ClassSchedule',
                        props: {
                            title: 'Upcoming Classes',
                            showDays: 7,
                            tenantSlug: newTenant.slug
                        }
                    },
                    {
                        type: 'ContactForm',
                        props: {
                            title: 'Get in Touch',
                            email: user.email
                        }
                    }
                ],
                zones: {}
            };

            await db.insert(websitePages).values({
                id: crypto.randomUUID(),
                tenantId: tenantId,
                slug: 'home',
                title: 'Home',
                content: defaultHomePageContent,
                isPublished: true,
                seoTitle: newTenant.name,
                seoDescription: `Welcome to ${newTenant.name}. View our class schedule and book your next session.`
            }).run();
        } catch (e) {
            console.error('Failed to create default home page', e);
            // Non-blocking - studio still works, just no public page
        }

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
                    c.env.RESEND_API_KEY as string,
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

// POST /quick-start - Update Tenant & Create First Class
app.post('/quick-start', rateLimit({ limit: 10, window: 60, keyPrefix: 'quick-start' }), async (c) => {
    const auth = c.get('auth');
    if (!auth?.userId) return c.json({ error: "Unauthorized" }, 401);

    const { tenantId, name, timezone, currency, branding, firstClass } = await c.req.json();
    if (!tenantId) return c.json({ error: "Tenant ID required" }, 400);

    const db = createDb(c.env.DB);

    // Verify Ownership
    const member = await db.query.tenantMembers.findFirst({
        where: and(eq(tenantMembers.userId, auth.userId), eq(tenantMembers.tenantId, tenantId))
    });

    if (!member) return c.json({ error: "Not a member" }, 403);

    // Check Role
    const role = await db.select().from(tenantRoles).where(eq(tenantRoles.memberId, member.id)).get();
    if (role?.role !== 'owner') return c.json({ error: "Must be owner" }, 403);

    // 1. Update Tenant Settings (Branding, Name, Timezone indirectly via Location)
    const currentTenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    if (!currentTenant) return c.json({ error: "Tenant not found" }, 404);

    const newSettings = {
        ...(currentTenant.settings || {}),
        onboardingCompleted: true
    };

    await db.update(tenants).set({
        name,
        currency: currency || 'usd',
        branding, // { primaryColor: '#...', logoUrl: '...' }
        settings: newSettings
    }).where(eq(tenants.id, tenantId)).run();


    // 2. Create/Update Primary Location
    let locationId: string;
    const existingLoc = await db.select().from(locations).where(and(eq(locations.tenantId, tenantId), eq(locations.isPrimary, true))).get();

    if (!existingLoc) {
        locationId = crypto.randomUUID();
        await db.insert(locations).values({
            id: locationId,
            tenantId,
            name: 'Main Studio',
            timezone: timezone || 'UTC',
            isPrimary: true,
            isActive: true
        }).run();
    } else {
        locationId = existingLoc.id;
        await db.update(locations).set({ timezone: timezone || 'UTC' }).where(eq(locations.id, locationId)).run();
    }

    // 3. Create First Class (if provided)
    if (firstClass) {
        const { title, startTime, duration } = firstClass;

        const seriesId = crypto.randomUUID();
        const start = new Date(startTime);

        // Create Series
        await db.insert(classSeries).values({
            id: seriesId,
            tenantId,
            instructorId: member.id,
            locationId: locationId,
            title: title || 'My First Class',
            durationMinutes: duration || 60,
            recurrenceRule: '', // One-off
            validFrom: start,
            createdAt: new Date()
        }).run();

        // Create Instance
        await db.insert(classes).values({
            id: crypto.randomUUID(),
            tenantId,
            instructorId: member.id,
            locationId: locationId,
            seriesId: seriesId,
            title: title || 'My First Class',
            startTime: start,
            durationMinutes: duration || 60,
            status: 'active',
            capacity: 20, // Default
            createdAt: new Date()
        }).run();
    }

    return c.json({ success: true, onboardingCompleted: true });
});

// POST /quick-start/skip - Mark onboarding as complete without setup
app.post('/quick-start/skip', rateLimit({ limit: 10, window: 60, keyPrefix: 'quick-start' }), async (c) => {
    const auth = c.get('auth');
    if (!auth?.userId) return c.json({ error: "Unauthorized" }, 401);

    const { tenantId } = await c.req.json();
    if (!tenantId) return c.json({ error: "Tenant ID required" }, 400);

    const db = createDb(c.env.DB);

    // Verify Ownership
    const member = await db.query.tenantMembers.findFirst({
        where: and(eq(tenantMembers.userId, auth.userId), eq(tenantMembers.tenantId, tenantId))
    });

    if (!member) return c.json({ error: "Not a member" }, 403);

    // Check Role
    const role = await db.select().from(tenantRoles).where(eq(tenantRoles.memberId, member.id)).get();
    if (role?.role !== 'owner' && role?.role !== 'admin') return c.json({ error: "Must be owner or admin" }, 403);

    const currentTenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    if (!currentTenant) return c.json({ error: "Tenant not found" }, 404);

    const newSettings = {
        ...(currentTenant.settings || {}),
        onboardingCompleted: true
    };

    await db.update(tenants).set({
        settings: newSettings
    }).where(eq(tenants.id, tenantId)).run();

    return c.json({ success: true, onboardingCompleted: true });
});

export default app;
