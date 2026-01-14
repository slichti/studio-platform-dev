
import { Hono } from 'hono';
import { createDb } from '../db';
import { tenants } from 'db/src/schema';
import { eq } from 'drizzle-orm';
import { EmailService } from 'shared';
import { UsageService } from 'shared';

type Bindings = {
    DB: D1Database;
    RESEND_API_KEY: string;
};

type Variables = {
    tenant: any;
};

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// GET /domain - Get current domain status
app.get('/domain', async (c) => {
    const tenant = c.get('tenant') as any;
    const db = createDb(c.env.DB);

    if (!tenant.customDomain) {
        return c.json({ domain: null, status: 'none' });
    }

    const usageService = new UsageService(db, tenant.id);
    const emailService = new EmailService(
        tenant.resendCredentials?.apiKey || c.env.RESEND_API_KEY,
        tenant,
        { slug: tenant.slug, customDomain: tenant.customDomain },
        usageService,
        !!tenant.resendCredentials
    );

    try {
        const domainData = await emailService.getDomain(tenant.customDomain);
        if (!domainData) {
            // Domain in DB but not in Resend? Anomaly.
            return c.json({
                domain: tenant.customDomain,
                status: 'pending_configuration',
                dns_records: []
            });
        }

        return c.json({
            domain: domainData.name,
            status: domainData.status,
            dns_records: domainData.records
        });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /domain - Add custom domain
app.post('/domain', async (c) => {
    const tenant = c.get('tenant') as any;
    const { domain } = await c.req.json();
    const db = createDb(c.env.DB);

    if (!domain) return c.json({ error: "Domain required" }, 400);

    // TODO: Verify Tier (Scale only) - Middleware likely handles this or we check here
    if (tenant.tier !== 'scale' && !tenant.billingExempt) {
        return c.json({ error: "Custom domains are available on the Scale plan only." }, 403);
    }

    const usageService = new UsageService(db, tenant.id);
    const emailService = new EmailService(
        tenant.resendCredentials?.apiKey || c.env.RESEND_API_KEY,
        tenant,
        { slug: tenant.slug },
        usageService,
        !!tenant.resendCredentials
    );

    try {
        // 1. Create in Resend
        await emailService.createDomain(domain);

        // 2. Save to DB
        await db.update(tenants)
            .set({ customDomain: domain })
            .where(eq(tenants.id, tenant.id))
            .run();

        return c.json({ success: true, domain });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// DELETE /domain - Remove custom domain
app.delete('/domain', async (c) => {
    const tenant = c.get('tenant') as any;
    const db = createDb(c.env.DB);

    if (!tenant.customDomain) return c.json({ error: "No domain configured" }, 400);

    const usageService = new UsageService(db, tenant.id);
    const emailService = new EmailService(
        tenant.resendCredentials?.apiKey || c.env.RESEND_API_KEY,
        tenant,
        { slug: tenant.slug, customDomain: tenant.customDomain },
        usageService,
        !!tenant.resendCredentials
    );

    try {
        // 1. Start Resend Deletion (Async/Best Effort - we need ID)
        // Issue: We need Domain ID to delete, but we only stored name.
        // We must fetch ID first.
        const domainData = await emailService.getDomain(tenant.customDomain);
        if (domainData?.id) {
            await emailService.deleteDomain(domainData.id);
        }

        // 2. Clear DB
        await db.update(tenants)
            .set({ customDomain: null })
            .where(eq(tenants.id, tenant.id))
            .run();

        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /domain/verify - Trigger Verification
app.post('/domain/verify', async (c) => {
    const tenant = c.get('tenant') as any;
    const db = createDb(c.env.DB);

    if (!tenant.customDomain) return c.json({ error: "No domain configured" }, 400);

    const usageService = new UsageService(db, tenant.id);
    const emailService = new EmailService(
        tenant.resendCredentials?.apiKey || c.env.RESEND_API_KEY,
        tenant,
        { slug: tenant.slug, customDomain: tenant.customDomain },
        usageService,
        !!tenant.resendCredentials
    );

    try {
        const domainData = await emailService.getDomain(tenant.customDomain);
        if (!domainData?.id) return c.json({ error: "Domain not found in provider" }, 404);

        await emailService.verifyDomain(domainData.id);

        return c.json({ success: true, message: "Verification triggered" });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default app;
