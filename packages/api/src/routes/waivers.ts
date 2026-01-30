import { Hono } from 'hono';
import { waiverTemplates, waiverSignatures, tenantMembers, users, tenantRoles, userRelationships } from '@studio/db/src/schema';
import { createDb } from '../db';
import { eq, and, inArray } from 'drizzle-orm';
import { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// GET /status
app.get('/status', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');
    if (!tenant) return c.json({ error: "Tenant missing" }, 400);

    const active = await db.query.waiverTemplates.findFirst({ where: and(eq(waiverTemplates.tenantId, tenant.id), eq(waiverTemplates.active, true)) });
    if (!active) return c.json({ needsSignature: false });
    if (!member) return c.json({ needsSignature: true, waiver: active });

    const sig = await db.query.waiverSignatures.findFirst({ where: and(eq(waiverSignatures.memberId, member.id), eq(waiverSignatures.templateId, active.id)) });
    return c.json({ needsSignature: !sig, waiver: active, signedAt: sig?.signedAt });
});

// GET /
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant missing' }, 400);

    if (c.get('can')('manage_members')) {
        const list = await db.select().from(waiverTemplates).where(eq(waiverTemplates.tenantId, tenant.id)).all();
        return c.json({ templates: list });
    } else {
        const active = await db.query.waiverTemplates.findFirst({ where: and(eq(waiverTemplates.tenantId, tenant.id), eq(waiverTemplates.active, true)) });
        if (!active) return c.json({ required: false });

        const member = c.get('member');
        if (!member) return c.json({ required: true, waiver: active, signed: false });

        const sig = await db.query.waiverSignatures.findFirst({ where: and(eq(waiverSignatures.memberId, member.id), eq(waiverSignatures.templateId, active.id)) });
        const rels = await db.query.userRelationships.findMany({ where: eq(userRelationships.parentUserId, member.userId) });

        const familyIds = [member.id];
        let family: any[] = [];
        if (rels.length > 0) {
            const childIds = rels.map(r => r.childUserId);
            const children = await db.query.users.findMany({ where: (u, { inArray }) => inArray(u.id, childIds) });
            const studioMems = await db.query.tenantMembers.findMany({ where: (m, { and, eq, inArray }) => and(eq(m.tenantId, tenant.id), inArray(m.userId, childIds)) });
            family = children.map(ch => {
                const m = studioMems.find(sm => sm.userId === ch.id);
                if (m) familyIds.push(m.id);
                const p = ch.profile && typeof ch.profile === 'string' ? JSON.parse(ch.profile) : ch.profile;
                return { userId: ch.id, memberId: m?.id || null, firstName: p?.firstName || 'Unknown', lastName: p?.lastName || '' };
            }).filter(f => f.memberId);
        }

        const signedSigs = await db.query.waiverSignatures.findMany({ where: (s, { and, eq, inArray }) => and(eq(s.templateId, active.id), inArray(s.memberId, familyIds)) });
        const signedIds = signedSigs.map(s => s.memberId);

        return c.json({ required: !signedIds.includes(member.id), waiver: active, signed: signedIds.includes(member.id), signatureDate: signedSigs.find(s => s.memberId === member.id)?.signedAt, family, signedMemberIds: signedIds });
    }
});

// POST / - Create Template
app.post('/', async (c) => {
    if (!c.get('can')('manage_members')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant required" }, 400);

    const { title, content, pdfUrl } = await c.req.json();
    if (!title || !content) return c.json({ error: 'Title/Content required' }, 400);

    const id = crypto.randomUUID();
    await db.insert(waiverTemplates).values({ id, tenantId: tenant.id, title, content, pdfUrl: pdfUrl || null, active: true }).run();
    return c.json({ id, title }, 201);
});

// POST /:id/sign
app.post('/:id/sign', async (c) => {
    const db = createDb(c.env.DB);
    const member = c.get('member');
    const tenant = c.get('tenant');
    if (!member || !tenant) return c.json({ error: 'Context required' }, 401);
    if (c.get('isImpersonating')) return c.json({ error: 'Impersonators cannot sign' }, 403);

    const { signatureData, ipAddress, onBehalfOfMemberId } = await c.req.json();
    let targetId = member.id;

    if (onBehalfOfMemberId && onBehalfOfMemberId !== member.id) {
        const target = await db.query.tenantMembers.findFirst({ where: eq(tenantMembers.id, onBehalfOfMemberId) });
        if (!target) return c.json({ error: "Not found" }, 404);
        const rel = await db.query.userRelationships.findFirst({ where: and(eq(userRelationships.parentUserId, member.userId), eq(userRelationships.childUserId, target.userId)) });
        if (!rel) return c.json({ error: "Unauthorized" }, 403);
        targetId = onBehalfOfMemberId;
    }

    const template = await db.query.waiverTemplates.findFirst({ where: and(eq(waiverTemplates.id, c.req.param('id')), eq(waiverTemplates.tenantId, tenant.id)) });
    if (!template) return c.json({ error: 'Not found' }, 404);

    const existing = await db.query.waiverSignatures.findFirst({ where: and(eq(waiverSignatures.memberId, targetId), eq(waiverSignatures.templateId, template.id)) });
    if (existing) return c.json({ error: 'Signed' }, 400);

    const id = crypto.randomUUID();
    await db.insert(waiverSignatures).values({ id, templateId: template.id, memberId: targetId, signedByMemberId: (targetId !== member.id) ? member.id : null, ipAddress: ipAddress || 'unknown', signatureData, signedAt: new Date() }).run();

    if (c.env.RESEND_API_KEY) {
        c.executionCtx.waitUntil((async () => {
            try {
                const { EmailService } = await import('../services/email');
                const u = await db.select({ email: users.email }).from(users).where(eq(users.id, member.userId)).get();
                if (u) {
                    const { jsPDF } = await import('jspdf');
                    const d = new jsPDF();
                    d.setFontSize(22); d.text(template.title, 20, 20); d.setFontSize(12);
                    const split = d.splitTextToSize(template.content, 170); d.text(split, 20, 40);
                    const y = 40 + (split.length * 5) + 20; d.text(`Date: ${new Date().toLocaleString()}`, 20, y);
                    if (signatureData?.startsWith('data:image')) d.addImage(signatureData, 'PNG', 20, y + 10, 100, 40);
                    await new EmailService(c.env.RESEND_API_KEY, { branding: tenant.branding as any }).sendWaiverCopy(u.email, template.title, d.output('arraybuffer'));
                }
            } catch (e) { console.error(e); }
        })());
    }
    return c.json({ success: true, signedAt: new Date() });
});

// POST /sign/public
app.post('/sign/public', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant missing" }, 400);
    const { firstName, lastName, email, signatureData, templateId, ipAddress } = await c.req.json();

    let u = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (!u) {
        const uid = crypto.randomUUID();
        await db.insert(users).values({ id: uid, email, role: 'user', profile: { firstName, lastName, portraitUrl: null } }).run();
        u = await db.query.users.findFirst({ where: eq(users.id, uid) });
    }
    if (!u) return c.json({ error: "User error" }, 500);

    let m = await db.query.tenantMembers.findFirst({ where: and(eq(tenantMembers.userId, u.id), eq(tenantMembers.tenantId, tenant.id)) });
    if (!m) {
        const mid = crypto.randomUUID();
        await db.insert(tenantMembers).values({ id: mid, userId: u.id, tenantId: tenant.id, status: 'active', joinedAt: new Date() }).run();
        await db.insert(tenantRoles).values({ id: crypto.randomUUID(), memberId: mid, role: 'student' }).run();
        m = await db.query.tenantMembers.findFirst({ where: eq(tenantMembers.id, mid) });
    }
    if (!m) return c.json({ error: "Member error" }, 500);

    const t = await db.query.waiverTemplates.findFirst({ where: and(eq(waiverTemplates.id, templateId), eq(waiverTemplates.tenantId, tenant.id)) });
    if (!t) return c.json({ error: 'Waiver error' }, 404);

    const sig = await db.query.waiverSignatures.findFirst({ where: and(eq(waiverSignatures.memberId, m.id), eq(waiverSignatures.templateId, templateId)) });
    if (sig) return c.json({ success: true, signedAt: sig.signedAt });

    await db.insert(waiverSignatures).values({ id: crypto.randomUUID(), templateId, memberId: m.id, signedByMemberId: m.id, ipAddress: ipAddress || 'unknown', signatureData, signedAt: new Date() }).run();

    if (c.env.RESEND_API_KEY) {
        c.executionCtx.waitUntil((async () => {
            try {
                const { jsPDF } = await import('jspdf');
                const d = new jsPDF();
                d.setFontSize(22); d.text(t.title, 20, 20); d.setFontSize(12);
                const split = d.splitTextToSize(t.content, 170); d.text(split, 20, 40);
                const y = 40 + (split.length * 5) + 20; d.text(`Signed by: ${firstName} ${lastName}`, 20, y);
                if (signatureData?.startsWith('data:image')) d.addImage(signatureData, 'PNG', 20, y + 10, 100, 40);
                const buf = d.output('arraybuffer');
                const { EmailService } = await import('../services/email');
                const es = new EmailService(c.env.RESEND_API_KEY, { branding: tenant.branding as any });
                await es.sendWaiverCopy(email, t.title, buf);
                const studioEmail = (tenant.settings as any)?.notifications?.adminEmail;
                if (studioEmail) await es.sendWaiverCopy(studioEmail, `${t.title} signed by ${firstName}`, buf);
            } catch (e) { console.error(e); }
        })());
    }
    return c.json({ success: true, signedAt: new Date() });
});

// PATCH /:id
app.patch('/:id', async (c) => {
    if (!c.get('can')('manage_members')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const { active, title, content } = await c.req.json();
    const up: any = {};
    if (typeof active !== 'undefined') up.active = active;
    if (title) up.title = title;
    if (content) up.content = content;
    await db.update(waiverTemplates).set(up).where(and(eq(waiverTemplates.id, c.req.param('id')), eq(waiverTemplates.tenantId, tenant!.id))).run();
    return c.json({ success: true });
});

// GET /:id/pdf
app.get('/:id/pdf', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');
    if (!member || !tenant) return c.json({ error: 'Unauthorized' }, 401);

    const t = await db.query.waiverTemplates.findFirst({ where: and(eq(waiverTemplates.id, c.req.param('id')), eq(waiverTemplates.tenantId, tenant.id)) });
    const s = await db.query.waiverSignatures.findFirst({ where: and(eq(waiverSignatures.templateId, c.req.param('id')), eq(waiverSignatures.memberId, member.id)) });
    if (!t || !s) return c.json({ error: 'Not found' }, 404);

    const { jsPDF } = await import('jspdf');
    const d = new jsPDF();
    d.setFontSize(22); d.text(t.title, 20, 20); d.setFontSize(12);
    const split = d.splitTextToSize(t.content, 170); d.text(split, 20, 40);
    const y = 40 + (split.length * 5) + 20; d.text(`Signed: ${new Date(s.signedAt!).toLocaleString()}`, 20, y);
    if (s.signatureData?.startsWith('data:image')) d.addImage(s.signatureData, 'PNG', 20, y + 10, 100, 40);
    return c.body(d.output('arraybuffer') as any, 200, { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment' });
});

export default app;
