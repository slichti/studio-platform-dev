
import { createRoute, z } from '@hono/zod-openapi';
import { createOpenAPIApp } from '../lib/openapi';
import { tenants } from '@studio/db/src/schema';
import { createDb } from '../db';
import { eq } from 'drizzle-orm';
import { EmailService } from '../services/email';
import { StudioVariables } from '../types';

const app = createOpenAPIApp<StudioVariables>();

// --- Schemas ---

const DomainSchema = z.object({
    domain: z.string().min(4),
    status: z.enum(['active', 'pending', 'failed', 'not_started', 'temporary_failure', 'validation_failed']).optional(),
    dns_records: z.array(z.object({
        record: z.string().optional(),
        name: z.string().optional(),
        type: z.string().optional(),
        ttl: z.string().optional(),
        status: z.string().optional(),
        value: z.string().optional(),
        priority: z.number().optional(),
        txt_name: z.string().optional(), // Compatibility with frontend
        txt_value: z.string().optional() // Compatibility with frontend
    })).optional()
}).openapi('Domain');

const AddDomainSchema = z.object({
    domain: z.string().min(4)
});

// --- Routes ---

// GET /domain - Get custom domain status
app.openapi(createRoute({
    method: 'get',
    path: '/',
    tags: ['Tenant'],
    summary: 'Get custom domain',
    responses: {
        200: { content: { 'application/json': { schema: DomainSchema } }, description: 'Domain details' },
        404: { description: 'No domain connected' }
    }
}), async (c) => {
    const tenant = c.get('tenant');
    if (!tenant.customDomain) return c.json({ error: 'No domain connected' } as any, 404);

    const emailService = new EmailService(
        (tenant.resendCredentials as any)?.apiKey || c.env.RESEND_API_KEY as string
    );

    try {
        // List domains to find ours (Resend doesn't allow get by name directly easily without ID)
        const domains = await emailService.resendClient.domains.list();
        const domainSummary = domains.data?.data.find(d => d.name === tenant.customDomain);

        if (!domainSummary) {
            return c.json({
                domain: tenant.customDomain,
                status: 'pending',
                dns_records: []
            });
        }

        // Fetch full details including records
        const details = await emailService.resendClient.domains.get(domainSummary.id);
        const domainData = details.data;

        if (!domainData) {
            return c.json({
                domain: tenant.customDomain,
                status: 'pending',
                dns_records: []
            });
        }

        // Map Resend records to frontend expectation
        // Resend returns: records: [{ record: 'SPF', name: '...', value: '...', type: 'TXT', ... }]
        // Frontend expects: txt_name, txt_value for logic
        // We'll pass through the Resend records and also map standard ones
        const records = domainData.records?.map((r: any) => ({
            ...r,
            // shim for frontend compat if needed, mainly for verification instructions
            txt_name: r.name,
            txt_value: r.value
        })) || [];

        return c.json({
            domain: domainData.name,
            status: domainData.status,
            dns_records: records
        } as any);
    } catch (e: any) {
        console.error("Failed to fetch domain from Resend", e);
        // Fallback if API fails
        return c.json({
            domain: tenant.customDomain,
            status: 'pending',
            dns_records: []
        });
    }
});

// POST /domain - Add custom domain
app.openapi(createRoute({
    method: 'post',
    path: '/',
    tags: ['Tenant'],
    summary: 'Add custom domain',
    request: {
        body: { content: { 'application/json': { schema: AddDomainSchema } } }
    },
    responses: {
        200: { content: { 'application/json': { schema: DomainSchema } }, description: 'Domain added' },
        400: { description: 'Invalid domain' },
        403: { description: 'Upgrade required' }
    }
}), async (c) => {
    const tenant = c.get('tenant');
    const { domain } = c.req.valid('json');

    // Verify Tier (Scale only)
    const isScale = tenant.tier === 'scale';
    const isExempt = tenant.billingExempt;

    if (!isScale && !isExempt) {
        return c.json({ error: "Custom domains are available on the Scale plan only." } as any, 403);
    }

    const db = createDb(c.env.DB);
    const emailService = new EmailService(
        (tenant.resendCredentials as any)?.apiKey || c.env.RESEND_API_KEY as string
    );

    try {
        const res = await emailService.resendClient.domains.create({ name: domain });

        if (res.error) {
            return c.json({ error: res.error.message } as any, 400);
        }

        const domainData = res.data!;

        await db.update(tenants).set({ customDomain: domain }).where(eq(tenants.id, tenant.id)).run();

        // Create returns details with records typically
        const records = domainData.records?.map((r: any) => ({
            ...r,
            txt_name: r.name,
            txt_value: r.value
        })) || [];

        return c.json({
            domain: domainData.name,
            status: domainData.status,
            dns_records: records
        } as any);

    } catch (e: any) {
        return c.json({ error: e.message } as any, 500);
    }
});

// DELETE /domain - Remove custom domain
app.openapi(createRoute({
    method: 'delete',
    path: '/',
    tags: ['Tenant'],
    summary: 'Remove custom domain',
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'Domain removed' }
    }
}), async (c) => {
    const tenant = c.get('tenant');
    const db = createDb(c.env.DB);

    if (!tenant.customDomain) return c.json({ success: true });

    const emailService = new EmailService(
        (tenant.resendCredentials as any)?.apiKey || c.env.RESEND_API_KEY as string
    );

    try {
        // Needed ID to delete
        const list = await emailService.resendClient.domains.list();
        const d = list.data?.data.find(i => i.name === tenant.customDomain);

        if (d) {
            await emailService.resendClient.domains.remove(d.id);
        }
    } catch (e) {
        console.error("Failed to delete domain from Resend", e);
        // Proceed to clear from DB anyway
    }

    await db.update(tenants).set({ customDomain: null }).where(eq(tenants.id, tenant.id)).run();
    return c.json({ success: true });
});

// POST /domain/verify - Trigger Verification
app.openapi(createRoute({
    method: 'post',
    path: '/verify',
    tags: ['Tenant'],
    summary: 'Verify custom domain',
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), message: z.string().optional() }) } }, description: 'Verification triggered' },
        404: { description: 'Domain not found' }
    }
}), async (c) => {
    const tenant = c.get('tenant');
    if (!tenant.customDomain) return c.json({ error: "No domain configured" } as any, 400);

    const emailService = new EmailService(
        (tenant.resendCredentials as any)?.apiKey || c.env.RESEND_API_KEY as string
    );

    try {
        const list = await emailService.resendClient.domains.list();
        const d = list.data?.data.find(i => i.name === tenant.customDomain);

        if (!d) return c.json({ error: "Domain not found in provider" } as any, 404);

        await emailService.resendClient.domains.verify(d.id);

        return c.json({ success: true, message: "Verification triggered" });
    } catch (e: any) {
        return c.json({ error: e.message } as any, 500);
    }
});

export default app;
