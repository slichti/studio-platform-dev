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

// GET /waivers/:id/pdf: Generate PDF for signed waiver
app.get('/:id/pdf', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');
    const id = c.req.param('id'); // This effectively acts as the template ID for now, or signature ID? 
    // Logic: If member requests it, they get their signature on it. If owner, they can request for any member?
    // Let's stick to: Authenticated member gets THEIR signed waiver for a template ID.

    if (!member) return c.json({ error: 'Login required' }, 401);

    const template = await db.query.waiverTemplates.findFirst({
        where: and(eq(waiverTemplates.id, id), eq(waiverTemplates.tenantId, tenant.id))
    });

    if (!template) return c.json({ error: 'Waiver template not found' }, 404);

    const signature = await db.query.waiverSignatures.findFirst({
        where: and(eq(waiverSignatures.templateId, id), eq(waiverSignatures.memberId, member.id))
    });

    if (!signature) return c.json({ error: 'Waiver not signed yet' }, 404);

    // Generate PDF
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();

    // Header
    doc.setFontSize(22);
    doc.text(template.title, 20, 20);

    // Content (Split text to fit)
    doc.setFontSize(12);
    const splitText = doc.splitTextToSize(template.content, 170);
    doc.text(splitText, 20, 40);

    // Signature Area
    const finalY = (doc as any).lastAutoTable?.finalY || 40 + (splitText.length * 5) + 20; // fallback if no table

    doc.text(`Signed by Member ID: ${member.id}`, 20, finalY);
    doc.text(`Date: ${new Date(signature.signedAt!).toLocaleString()}`, 20, finalY + 10);
    doc.text(`IP Address: ${signature.ipAddress || 'N/A'}`, 20, finalY + 20);

    if (signature.signatureData && signature.signatureData.startsWith('data:image')) {
        try {
            doc.addImage(signature.signatureData, 'PNG', 20, finalY + 30, 100, 40);
        } catch (e) {
            doc.text("[Signature Image Error]", 20, finalY + 30);
        }
    } else {
        doc.text("[Electronically Signed]", 20, finalY + 30);
    }

    const pdfBuffer = doc.output('arraybuffer');

    return c.body(pdfBuffer as any, 200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="waiver-${id}.pdf"`
    });
});

export default app;
