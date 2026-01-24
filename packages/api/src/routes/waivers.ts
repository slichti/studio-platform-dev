import { Hono } from 'hono';
import { waiverTemplates, waiverSignatures, tenants, tenantMembers, users } from '@studio/db/src/schema'; // Added users
import { createDb } from '../db';
import { eq, and } from 'drizzle-orm';

type Bindings = {
    DB: D1Database;
    RESEND_API_KEY: string;
};

type Variables = {
    tenant: typeof tenants.$inferSelect;
    member?: any;
    roles?: string[];
    auth: {
        userId: string | null;
        claims: any;
    };
    features: Set<string>;
    isImpersonating?: boolean;
};

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// GET /status: Check if current member needs to sign a waiver
app.get('/status', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');

    const activeTemplate = await db.query.waiverTemplates.findFirst({
        where: and(eq(waiverTemplates.tenantId, tenant.id), eq(waiverTemplates.active, true))
    });

    if (!activeTemplate) {
        return c.json({ needsSignature: false });
    }

    if (!member) {
        return c.json({ needsSignature: true, waiver: activeTemplate });
    }

    const signature = await db.query.waiverSignatures.findFirst({
        where: and(eq(waiverSignatures.memberId, member.id), eq(waiverSignatures.templateId, activeTemplate.id))
    });

    return c.json({
        needsSignature: !signature,
        waiver: activeTemplate,
        signedAt: signature?.signedAt
    });
});

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

        // 3. Get family members to allow signing for them
        const { userRelationships } = await import('@studio/db/src/schema');
        const relationships = await db.query.userRelationships.findMany({
            where: eq(userRelationships.parentUserId, member.userId)
        });

        const allMemberIdsInFamily = [member.id];
        let family: any[] = [];
        if (relationships.length > 0) {
            const childUserIds = relationships.map(r => r.childUserId);
            const children = await db.query.users.findMany({
                where: (users, { inArray }) => inArray(users.id, childUserIds)
            });

            const studioMembers = await db.query.tenantMembers.findMany({
                where: (members, { and, eq, inArray }) => and(
                    eq(members.tenantId, tenant.id),
                    inArray(members.userId, childUserIds)
                )
            });

            family = children.map(child => {
                const m = studioMembers.find(sm => sm.userId === child.id);
                if (m) allMemberIdsInFamily.push(m.id);
                return {
                    userId: child.id,
                    memberId: m?.id || null,
                    firstName: (child.profile as any)?.firstName || 'Unknown',
                    lastName: (child.profile as any)?.lastName || ''
                };
            }).filter(f => f.memberId); // Only show if they are a member of this studio
        }

        // 4. Find which family members have signed
        const signedSignatures = await db.query.waiverSignatures.findMany({
            where: (signatures, { and, eq, inArray }) => and(
                eq(signatures.templateId, activeTemplate.id),
                inArray(signatures.memberId, allMemberIdsInFamily)
            )
        });

        const signedMemberIds = signedSignatures.map(s => s.memberId);

        return c.json({
            required: !signedMemberIds.includes(member.id),
            waiver: activeTemplate,
            signed: signedMemberIds.includes(member.id),
            signatureDate: signedSignatures.find(s => s.memberId === member.id)?.signedAt,
            family,
            signedMemberIds
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

    // Security: Prevent impersonators from signing waivers
    const isImpersonating = c.get('isImpersonating');
    if (isImpersonating) {
        return c.json({ error: 'System admins cannot sign waivers on behalf of customers.' }, 403);
    }

    const body = await c.req.json();
    const { signatureData, ipAddress, onBehalfOfMemberId } = body;
    let targetMemberId = member.id;

    // 1. Check if signing for child
    if (onBehalfOfMemberId && onBehalfOfMemberId !== member.id) {
        const { userRelationships } = await import('@studio/db/src/schema');

        // Find target member to get their userId
        const targetMember = await db.query.tenantMembers.findFirst({
            where: eq(tenantMembers.id, onBehalfOfMemberId)
        });

        if (!targetMember) return c.json({ error: "Target member not found" }, 404);

        // Verify Relationship: Auth User (member.userId) MUST be Parent of Target User (targetMember.userId)
        const relationship = await db.query.userRelationships.findFirst({
            where: and(
                eq(userRelationships.parentUserId, member.userId),
                eq(userRelationships.childUserId, targetMember.userId)
            )
        });

        if (!relationship) return c.json({ error: "You are not authorized to sign for this member" }, 403);

        targetMemberId = onBehalfOfMemberId;
    }

    // Check if template exists and is active
    const template = await db.query.waiverTemplates.findFirst({
        where: and(eq(waiverTemplates.id, templateId), eq(waiverTemplates.tenantId, tenant.id))
    });

    if (!template) return c.json({ error: 'Waiver not found' }, 404);

    // Check if already signed
    const existing = await db.query.waiverSignatures.findFirst({
        where: and(eq(waiverSignatures.memberId, targetMemberId), eq(waiverSignatures.templateId, templateId))
    });

    if (existing) return c.json({ error: 'Already signed' }, 400);

    const id = crypto.randomUUID();
    await db.insert(waiverSignatures).values({
        id,
        templateId,
        memberId: targetMemberId,
        signedByMemberId: (targetMemberId !== member.id) ? member.id : null,
        ipAddress: ipAddress || 'unknown', // Should extract from request headers in real app
        signatureData,
        signedAt: new Date()
    });

    // Send copy via email
    if (c.env.RESEND_API_KEY) {
        const { EmailService } = await import('../services/email');
        const emailService = new EmailService(c.env.RESEND_API_KEY, {
            branding: tenant.branding as any
        });
        // Get User Email
        const user = await db.select({ email: users.email }).from(users).where(eq(users.id, member.userId)).get();

        if (user) {
            // Generate PDF Buffer locally again? Or abstract PDF gen?
            // Ideally we shouldn't duplicate PDF generation logic. A helper function would be best.
            // For now, let's duplicate the jspdf logic briefly or refactor.

            // Quick Inline PDF Gen (Duplicated for speed but risky for maintainability. Let's do it for MVP)
            // Ideally, move PDF gen to a service later.
            c.executionCtx.waitUntil((async () => {
                const { jsPDF } = await import('jspdf');
                const doc = new jsPDF();
                doc.setFontSize(22);
                doc.text(template.title, 20, 20);
                doc.setFontSize(12);
                const splitText = doc.splitTextToSize(template.content, 170);
                doc.text(splitText, 20, 40);
                const finalY = 40 + (splitText.length * 5) + 20;
                doc.text(`Signed by Member ID: ${member.id} (as likely Parent/Self)`, 20, finalY);
                doc.text(`For Member ID: ${targetMemberId}`, 20, finalY + 10);
                doc.text(`Date: ${new Date().toLocaleString()}`, 20, finalY + 10);
                doc.text(`IP Address: ${ipAddress || 'unknown'}`, 20, finalY + 20);
                if (signatureData && signatureData.startsWith('data:image')) {
                    try { doc.addImage(signatureData, 'PNG', 20, finalY + 30, 100, 40); } catch (e) { }
                } else { doc.text("[Electronically Signed]", 20, finalY + 30); }
                const buffer = doc.output('arraybuffer');

                await emailService.sendWaiverCopy(user.email, template.title, buffer);
            })());
        }
    }

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
