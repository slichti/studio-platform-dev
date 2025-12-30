import { Hono } from 'hono';
import { waiverTemplates, waiverSignatures, tenants, tenantMembers } from 'db/src/schema';
import { createDb } from '../db';
import { eq, and } from 'drizzle-orm';

type Bindings = {
    DB: D1Database;
};

type Variables = {
    auth: {
        userId: string;
    };
    tenant?: any;
    member?: any;
    roles?: string[];
}

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// Force Tenant Middleware for this route to ensure context is available
import { tenantMiddleware } from '../middleware/tenant';
app.use('*', tenantMiddleware);

// GET /waivers: List templates (Owner) or get active waiver to sign (Student)
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const roles = c.get('roles') || [];
    const isOwner = roles.includes('owner');
    const member = c.get('member');

    if (isOwner) {
        // Return all templates
        const templates = await db.select().from(waiverTemplates).where(eq(waiverTemplates.tenantId, tenant.id));
        return c.json({ templates });
    } else {
        // Student View: Return active waiver and check if signed
        // 1. Get active template
        const activeTemplate = await db.query.waiverTemplates.findFirst({
            where: and(eq(waiverTemplates.tenantId, tenant.id), eq(waiverTemplates.active, true))
        });

        if (!activeTemplate) {
            return c.json({ required: false });
        }

        // 2. Check if member signed it
        // If member context missing (guest), they can't have signed it.
        if (!member) {
            return c.json({ required: true, waiver: activeTemplate, signed: false });
        }

        const signature = await db.query.waiverSignatures.findFirst({
            where: and(eq(waiverSignatures.memberId, member.id), eq(waiverSignatures.templateId, activeTemplate.id))
        });

        return c.json({
            required: !signature,
            waiver: activeTemplate,
            signed: !!signature,
            signatureDate: signature?.signedAt
        });
    }
});

// POST /waivers: Create/Update Template (Owner Only)
app.post('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];

    if (!roles.includes('owner')) {
        return c.json({ error: 'Access Denied' }, 403);
    }

    const { title, content, pdfUrl } = await c.req.json();
    if (!title || !content) return c.json({ error: 'Title and Content required' }, 400);

    const id = crypto.randomUUID();

    await db.insert(waiverTemplates).values({
        id,
        tenantId: tenant.id,
        title,
        content,
        pdfUrl: pdfUrl || null,
        active: true
    });

    return c.json({ id, title }, 201);
});

// POST /waivers/:id/sign: Sign a waiver (Authenticated Member Only)
app.post('/:id/sign', async (c) => {
    const db = createDb(c.env.DB);
    const templateId = c.req.param('id');
    const member = c.get('member');
    const tenant = c.get('tenant');

    if (!member) {
        return c.json({ error: 'Must be logged in to sign waiver' }, 401);
    }

    const { signatureData, ipAddress } = await c.req.json();

    // Check if template exists and is active
    const template = await db.query.waiverTemplates.findFirst({
        where: and(eq(waiverTemplates.id, templateId), eq(waiverTemplates.tenantId, tenant.id))
    });

    if (!template) return c.json({ error: 'Waiver not found' }, 404);

    // Check if already signed
    const existing = await db.query.waiverSignatures.findFirst({
        where: and(eq(waiverSignatures.memberId, member.id), eq(waiverSignatures.templateId, templateId))
    });

    if (existing) return c.json({ error: 'Already signed' }, 400);

    const id = crypto.randomUUID();
    await db.insert(waiverSignatures).values({
        id,
        templateId,
        memberId: member.id,
        ipAddress: ipAddress || 'unknown', // Should extract from request headers in real app
        signatureData,
        signedAt: new Date()
    });

    return c.json({ success: true, signedAt: new Date() });
});

// PATCH /waivers/:id: Update Waiver (Owner Only) - e.g. toggle active
app.patch('/:id', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];
    const id = c.req.param('id');

    if (!roles.includes('owner')) {
        return c.json({ error: 'Access Denied' }, 403);
    }

    const { active, title, content } = await c.req.json();

    // Build update object dynamically
    const updateData: any = {};
    if (typeof active !== 'undefined') updateData.active = active;
    if (title) updateData.title = title;
    if (content) updateData.content = content;

    if (Object.keys(updateData).length === 0) return c.json({ error: 'No fields to update' }, 400);

    await db.update(waiverTemplates)
        .set(updateData)
        .where(and(eq(waiverTemplates.id, id), eq(waiverTemplates.tenantId, tenant.id)))
        .run();

    return c.json({ success: true });
});

export default app;
