
import { createRoute, z } from '@hono/zod-openapi';
import { createOpenAPIApp } from '../lib/openapi';
import { tenants } from '@studio/db/src/schema';
import { createDb } from '../db';
import { eq } from 'drizzle-orm';
import { CloudflareService } from '../services/cloudflare';
import { StudioVariables } from '../types';

const app = createOpenAPIApp<StudioVariables>();

// --- Schemas ---

const DomainSchema = z.object({
    domain: z.string().min(4),
    status: z.enum(['active', 'pending', 'failed', 'not_started', 'temporary_failure', 'validation_failed', 'active']).optional(), // active is confirmed
    dns_records: z.array(z.object({
        record: z.string().optional(),
        name: z.string().optional(),
        type: z.string().optional(),
        ttl: z.string().optional(),
        status: z.string().optional(),
        value: z.string().optional(),
        priority: z.number().optional(),
        txt_name: z.string().optional(),
        txt_value: z.string().optional()
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

    const cloudflare = new CloudflareService(
        c.env.CLOUDFLARE_ACCOUNT_ID,
        c.env.CLOUDFLARE_API_TOKEN
    );

    try {
        const domainData = await cloudflare.getDomain(tenant.customDomain);

        if (!domainData) {
            return c.json({
                domain: tenant.customDomain,
                status: 'pending',
                dns_records: []
            });
        }

        // Map Cloudflare status to our internal enum
        // Cloudflare statuses: active, pending, temporary_failure, etc.
        return c.json({
            domain: domainData.name,
            status: domainData.status,
            dns_records: [] // Pages doesn't return specific records here usually, CNAME is standard
        } as any);
    } catch (e: any) {
        console.error("Failed to fetch domain from Cloudflare", e);
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
    if (!tenant) return c.json({ error: "Tenant not found" } as any, 404);

    const { domain } = c.req.valid('json');

    // Verify Tier (Scale only)
    const isScale = tenant.tier === 'scale';
    const isExempt = tenant.billingExempt;

    if (!isScale && !isExempt) {
        return c.json({ error: "Custom domains are available on the Scale plan only." } as any, 403);
    }

    const db = createDb(c.env.DB);
    const cloudflare = new CloudflareService(
        c.env.CLOUDFLARE_ACCOUNT_ID,
        c.env.CLOUDFLARE_API_TOKEN
    );

    try {
        const domainData = await cloudflare.addDomain(domain);

        await db.update(tenants).set({ customDomain: domain }).where(eq(tenants.id, tenant.id)).run();

        return c.json({
            domain: domainData.name,
            status: domainData.status,
            dns_records: []
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

    const cloudflare = new CloudflareService(
        c.env.CLOUDFLARE_ACCOUNT_ID,
        c.env.CLOUDFLARE_API_TOKEN
    );

    try {
        await cloudflare.deleteDomain(tenant.customDomain);
    } catch (e) {
        console.error("Failed to delete domain from Cloudflare", e);
    }

    await db.update(tenants).set({ customDomain: null }).where(eq(tenants.id, tenant.id)).run();
    return c.json({ success: true });
});

// POST /domain/verify - Trigger Verification (Refreshes status)
app.openapi(createRoute({
    method: 'post',
    path: '/verify',
    tags: ['Tenant'],
    summary: 'Verify custom domain',
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), message: z.string().optional() }) } }, description: 'Verification refreshed' },
        404: { description: 'Domain not found' }
    }
}), async (c) => {
    const tenant = c.get('tenant');
    if (!tenant.customDomain) return c.json({ error: "No domain configured" } as any, 400);

    const cloudflare = new CloudflareService(
        c.env.CLOUDFLARE_ACCOUNT_ID,
        c.env.CLOUDFLARE_API_TOKEN
    );

    try {
        const d = await cloudflare.getDomain(tenant.customDomain);
        if (!d) return c.json({ error: "Domain not found in provider" } as any, 404);

        // Pages auto-verifies once CNAME is detected, so "verify" is just a status check
        return c.json({ success: true, message: `Status is currently: ${d.status}` });
    } catch (e: any) {
        return c.json({ error: e.message } as any, 500);
    }
});

export default app;
