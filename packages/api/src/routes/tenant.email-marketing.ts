import { createRoute, z } from '@hono/zod-openapi';
import { createOpenAPIApp } from '../lib/openapi';
import { tenants } from '@studio/db/src/schema';
import { createDb } from '../db';
import { eq } from 'drizzle-orm';
import { StudioVariables } from '../types';
import { ResendManagementService } from '../services/resend';

const app = createOpenAPIApp<StudioVariables>();

// --- Schemas ---

const EmailDomainSchema = z.object({
    domainId: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    records: z.any().nullable().optional(),
}).openapi('EmailDomain');

const AddEmailDomainSchema = z.object({
    domain: z.string().min(4)
});

const BroadcastSchema = z.object({
    subject: z.string().min(1),
    htmlContent: z.string().min(1),
    fromEmail: z.string().email()
});

// --- Routes ---

// GET /domain - Get email marketing domain status
app.openapi(createRoute({
    method: 'get',
    path: '/domain',
    tags: ['EmailMarketing'],
    summary: 'Get email domain status',
    responses: {
        200: { content: { 'application/json': { schema: EmailDomainSchema } }, description: 'Domain details' }
    }
}), async (c) => {
    const tenant = c.get('tenant');
    const db = createDb(c.env.DB);

    // Fetch fresh tenant data
    const currentTenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, tenant.id)
    });

    return c.json({
        domainId: currentTenant?.resendDomainId,
        status: currentTenant?.resendDomainStatus,
        records: currentTenant?.resendDomainRecords ? JSON.parse(currentTenant.resendDomainRecords as string) : null
    } as any);
});

// POST /domain - Add email marketing domain
app.openapi(createRoute({
    method: 'post',
    path: '/domain',
    tags: ['EmailMarketing'],
    summary: 'Add custom email domain',
    request: {
        body: { content: { 'application/json': { schema: AddEmailDomainSchema } } }
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'Domain added' },
        400: { description: 'Invalid domain' },
        500: { description: 'Server Error' }
    }
}), async (c) => {
    const tenant = c.get('tenant');
    const { domain } = c.req.valid('json');
    const db = createDb(c.env.DB);

    const resend = new ResendManagementService(c.env.RESEND_API_KEY, db);

    try {
        await resend.setupTenantDomain(tenant.id, domain);
        return c.json({ success: true } as any);
    } catch (e: any) {
        return c.json({ error: e.message } as any, 500);
    }
});

// DELETE /domain - Remove email marketing domain
app.openapi(createRoute({
    method: 'delete',
    path: '/domain',
    tags: ['EmailMarketing'],
    summary: 'Remove custom email domain',
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'Domain removed' }
    }
}), async (c) => {
    const tenant = c.get('tenant');
    const db = createDb(c.env.DB);
    const resend = new ResendManagementService(c.env.RESEND_API_KEY, db);

    try {
        await resend.revokeTenantAccess(tenant.id);
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message } as any, 500);
    }
});

// POST /domain/verify - Trigger Verification
app.openapi(createRoute({
    method: 'post',
    path: '/domain/verify',
    tags: ['EmailMarketing'],
    summary: 'Verify custom email domain',
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), status: z.string().optional() }) } }, description: 'Verification refreshed' },
        400: { description: 'No domain configured' },
        500: { description: 'Server Error' }
    }
}), async (c) => {
    const tenant = c.get('tenant');
    const db = createDb(c.env.DB);

    const resend = new ResendManagementService(c.env.RESEND_API_KEY, db);

    try {
        const updates = await resend.verifyTenantDomain(tenant.id);
        return c.json({ success: true, status: updates.resendDomainStatus as string });
    } catch (e: any) {
        return c.json({ error: e.message } as any, 500);
    }
});

// POST /broadcast - Send a broadcast
app.openapi(createRoute({
    method: 'post',
    path: '/broadcast',
    tags: ['EmailMarketing'],
    summary: 'Send email broadcast',
    request: {
        body: { content: { 'application/json': { schema: BroadcastSchema } } }
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean(), id: z.string().optional() }) } }, description: 'Broadcast sent' },
        500: { description: 'Server Error' }
    }
}), async (c) => {
    const tenant = c.get('tenant');
    const { subject, htmlContent, fromEmail } = c.req.valid('json');
    const db = createDb(c.env.DB);

    const resend = new ResendManagementService(c.env.RESEND_API_KEY, db);

    try {
        const data = await resend.sendBroadcast(tenant.id, subject, htmlContent, fromEmail);
        return c.json({ success: true, id: data?.id } as any);
    } catch (e: any) {
        return c.json({ error: e.message } as any, 500);
    }
});

export default app;
