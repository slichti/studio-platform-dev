import { Hono } from 'hono';
import { createDb } from '../db';
import { substitutions, classes, tenantMembers, users, tenantRoles } from '@studio/db/src/schema';
import { eq, and, desc } from 'drizzle-orm';
import { ConflictService } from '../services/conflicts';
import { HonoContext } from '../types';

const app = new Hono<HonoContext>();

async function sendSubEmail(env: any, tenant: any, to: string, subject: string, html: string) {
    if (!env.RESEND_API_KEY) return;
    try {
        const { EmailService } = await import('../services/email');
        const db = createDb(env.DB);
        const emailService = new EmailService(env.RESEND_API_KEY, { branding: tenant.branding, settings: tenant.settings }, undefined, undefined, false, db, tenant.id);
        await emailService.sendGenericEmail(to, subject, html);
    } catch (e) { console.error("Email failed", e); }
}

// GET / - List all
app.get('/', async (c) => {
    if (!c.get('can')('view_classes')) return c.json({ error: "Access Denied" }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const list = await db.query.substitutions.findMany({ where: eq(substitutions.tenantId, tenant!.id), with: { class: true, requestingInstructor: { with: { user: true } }, coveringInstructor: { with: { user: true } } }, orderBy: desc(substitutions.createdAt) });
    return c.json({ substitutions: list });
});

// POST /request
app.post('/request', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');
    if (!member) return c.json({ error: "Member missing" }, 401);

    const { classId, notes } = await c.req.json();
    const cls = await db.query.classes.findFirst({ where: and(eq(classes.id, classId), eq(classes.tenantId, tenant!.id)) });
    if (!cls) return c.json({ error: "Class not found" }, 404);

    if (cls.instructorId !== member.id && !c.get('can')('manage_classes')) {
        return c.json({ error: "Unauthorized" }, 403);
    }

    // Can't request sub for class with no instructor
    if (!cls.instructorId) {
        return c.json({ error: "Class has no instructor assigned" }, 400);
    }

    const subId = crypto.randomUUID();
    await db.insert(substitutions).values({ id: subId, tenantId: tenant!.id, classId, requestingInstructorId: cls.instructorId, status: 'pending', notes }).run();

    const owners = await db.select({ email: users.email }).from(tenantMembers).innerJoin(users, eq(tenantMembers.userId, users.id)).innerJoin(tenantRoles, eq(tenantMembers.id, tenantRoles.memberId)).where(and(eq(tenantMembers.tenantId, tenant!.id), eq(tenantRoles.role, 'owner'))).all();

    c.executionCtx.waitUntil((async () => {
        const name = member.user.profile && typeof member.user.profile === 'string' ? JSON.parse(member.user.profile).firstName : member.user.profile?.firstName;
        for (const o of owners) await sendSubEmail(c.env, tenant, o.email, `Sub Request: ${cls.title}`, `<p>${name} needs cover for ${cls.title} on ${new Date(cls.startTime).toLocaleString()}.</p>`);
    })());

    return c.json({ id: subId, status: 'pending' }, 201);
});

// POST /:id/claim
app.post('/:id/claim', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');
    if (!member) return c.json({ error: "Unauthorized" }, 401);

    const sub = await db.query.substitutions.findFirst({ where: and(eq(substitutions.id, c.req.param('id')), eq(substitutions.tenantId, tenant!.id)), with: { class: true } });
    if (!sub || sub.status !== 'pending') return c.json({ error: "Invalid request" }, 404);
    if (sub.requestingInstructorId === member.id) return c.json({ error: "Cannot claim own" }, 400);

    const conflicts = await new ConflictService(db).checkInstructorConflict(member.id, sub.class.startTime, sub.class.durationMinutes);
    if (conflicts.length > 0) return c.json({ error: "Conflict", conflicts }, 409);

    await db.update(substitutions).set({ status: 'claimed', coveringInstructorId: member.id, updatedAt: new Date() }).where(eq(substitutions.id, sub.id)).run();

    const requester = await db.select({ email: users.email }).from(tenantMembers).innerJoin(users, eq(tenantMembers.userId, users.id)).where(eq(tenantMembers.id, sub.requestingInstructorId)).get();
    const owners = await db.select({ email: users.email }).from(tenantMembers).innerJoin(users, eq(tenantMembers.userId, users.id)).innerJoin(tenantRoles, eq(tenantMembers.id, tenantRoles.memberId)).where(and(eq(tenantMembers.tenantId, tenant!.id), eq(tenantRoles.role, 'owner'))).all();

    c.executionCtx.waitUntil((async () => {
        const coverName = member.user.profile && typeof member.user.profile === 'string' ? JSON.parse(member.user.profile).firstName : member.user.profile?.firstName;
        if (requester) await sendSubEmail(c.env, tenant, requester.email, `Sub Claimed: ${sub.class.title}`, `<p>${coverName} offered to cover ${sub.class.title}.</p>`);
        for (const o of owners) await sendSubEmail(c.env, tenant, o.email, `Sub Claimed`, `<p>${coverName} offered to cover ${sub.class.title}. Approve in dashboard.</p>`);
    })());

    return c.json({ success: true, status: 'claimed' });
});

// POST /:id/approve
app.post('/:id/approve', async (c) => {
    if (!c.get('can')('manage_classes')) return c.json({ error: "Unauthorized" }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const sub = await db.query.substitutions.findFirst({ where: and(eq(substitutions.id, c.req.param('id')), eq(substitutions.tenantId, tenant!.id)), with: { class: true } });

    if (!sub?.coveringInstructorId) return c.json({ error: "Invalid request" }, 400);

    await db.update(substitutions).set({ status: 'approved', updatedAt: new Date() }).where(eq(substitutions.id, sub.id)).run();
    await db.update(classes).set({ instructorId: sub.coveringInstructorId }).where(eq(classes.id, sub.classId)).run();

    const reqMem = await db.select({ email: users.email }).from(tenantMembers).innerJoin(users, eq(tenantMembers.userId, users.id)).where(eq(tenantMembers.id, sub.requestingInstructorId)).get();
    const covMem = await db.select({ email: users.email }).from(tenantMembers).innerJoin(users, eq(tenantMembers.userId, users.id)).where(eq(tenantMembers.id, sub.coveringInstructorId)).get();

    c.executionCtx.waitUntil((async () => {
        if (reqMem) await sendSubEmail(c.env, tenant, reqMem.email, `Sub Approved`, `<p>Your sub for ${sub.class.title} on ${new Date(sub.class.startTime).toLocaleString()} was approved.</p>`);
        if (covMem) await sendSubEmail(c.env, tenant, covMem.email, `Sub Approved`, `<p>You're now teaching ${sub.class.title} on ${new Date(sub.class.startTime).toLocaleString()}.</p>`);
    })());

    return c.json({ success: true, status: 'approved' });
});

// POST /:id/decline
app.post('/:id/decline', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');
    const sub = await db.query.substitutions.findFirst({ where: and(eq(substitutions.id, c.req.param('id')), eq(substitutions.tenantId, tenant!.id)) });
    if (!sub) return c.json({ error: "Not found" }, 404);

    if (sub.requestingInstructorId !== member?.id && !c.get('can')('manage_classes')) return c.json({ error: "Unauthorized" }, 403);

    await db.update(substitutions).set({ status: 'declined', updatedAt: new Date() }).where(eq(substitutions.id, sub.id)).run();
    return c.json({ success: true, status: 'declined' });
});

export default app;
