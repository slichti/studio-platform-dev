import { Hono } from 'hono';
import { eq, and, sql, desc, ne } from 'drizzle-orm';
import { createDb } from '../db';
import { subRequests, classes, tenantMembers, tenantRoles, users } from '@studio/db/src/schema';
import { HonoContext } from '../types';

const app = new Hono<HonoContext>();

function formatShortDate(date: Date) {
    if (!date) return '';
    return new Date(date).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// GET /items - List open
app.get('/items', async (c) => {
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant missing' }, 400);
    const db = createDb(c.env.DB);

    const requests = await db.select({
        id: subRequests.id, status: subRequests.status, message: subRequests.message, createdAt: subRequests.createdAt,
        classTitle: classes.title, startTime: classes.startTime, classId: classes.id,
        originalInstructorName: sql<string>`json_extract(${tenantMembers.profile}, '$.firstName')`
    })
        .from(subRequests).innerJoin(classes, eq(subRequests.classId, classes.id)).innerJoin(tenantMembers, eq(subRequests.originalInstructorId, tenantMembers.id))
        .where(and(eq(subRequests.tenantId, tenant.id), eq(subRequests.status, 'open'))).orderBy(desc(classes.startTime)).all();

    return c.json({ requests });
});

// POST /classes/:classId/request
app.post('/classes/:classId/request', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');
    if (!tenant || !member) return c.json({ error: 'Context required' }, 401);

    const classData = await db.select().from(classes).where(and(eq(classes.id, c.req.param('classId')), eq(classes.tenantId, tenant.id))).get();
    if (!classData) return c.json({ error: 'Class not found' }, 404);

    if (classData.instructorId !== member.id && !c.get('can')('manage_classes')) {
        return c.json({ error: 'Unauthorized' }, 403);
    }

    // Can't request sub for class with no instructor
    if (!classData.instructorId) {
        return c.json({ error: 'Class has no instructor assigned' }, 400);
    }

    const { message } = await c.req.json();
    const existing = await db.select().from(subRequests).where(and(eq(subRequests.classId, classData.id), eq(subRequests.status, 'open'))).get();
    if (existing) return c.json({ error: 'Already exists' }, 400);

    const requestId = crypto.randomUUID();
    await db.insert(subRequests).values({ id: requestId, tenantId: tenant.id, classId: classData.id, originalInstructorId: classData.instructorId, message, status: 'open', createdAt: new Date(), updatedAt: new Date() }).run();

    c.executionCtx.waitUntil((async () => {
        try {
            const { EmailService } = await import('../services/email');
            const { SmsService } = await import('../services/sms');
            const { PushService } = await import('../services/push');
            const email = new EmailService(c.env.RESEND_API_KEY as string, tenant.settings as any, { slug: tenant.slug }, undefined, false, db, tenant.id);
            const sms = new SmsService(undefined, c.env, undefined, db, tenant.id);
            const push = new PushService(db, tenant.id);

            const instructors = await db.select({ email: users.email, phone: sql<string>`json_extract(${users.profile}, '$.phoneNumber')`, pushToken: users.pushToken, settings: tenantMembers.settings, memberId: tenantMembers.id })
                .from(tenantMembers).innerJoin(users, eq(tenantMembers.userId, users.id)).innerJoin(tenantRoles, eq(tenantRoles.memberId, tenantMembers.id))
                .where(and(eq(tenantMembers.tenantId, tenant.id), eq(tenantRoles.role, 'instructor'), ne(tenantMembers.id, member.id))).all();

            const dateStr = formatShortDate(classData.startTime);
            const reqName = member.profile && typeof member.profile === 'string' ? JSON.parse(member.profile).firstName : member.profile?.firstName;

            for (const inst of instructors) {
                const s = (inst.settings as any)?.notifications?.substitutions || { email: true, sms: false, push: false };
                if (s.email !== false) await email.sendSubRequestAlert(inst.email, { classTitle: classData.title, date: dateStr, requestingInstructor: String(reqName), message: message || '', link: `https://${tenant.slug}.studio-platform.com/studio/${tenant.slug}/substitutions` });
                if (s.sms && inst.phone) await sms.sendSms(inst.phone, `[${tenant.name}] SUB: ${reqName} needs cover for ${classData.title} on ${dateStr}`, inst.memberId);
                if (s.push && inst.pushToken) await push.sendPush(inst.pushToken, `Sub Needed`, `${reqName} needs cover on ${dateStr}`, { requestId, classId: classData.id });
            }
        } catch (e) { console.error(e); }
    })());

    return c.json({ success: true, requestId });
});

// POST /items/:requestId/approve
app.post('/items/:requestId/approve', async (c) => {
    if (!c.get('can')('manage_classes')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant missing' }, 400);

    const request = await db.select().from(subRequests).where(and(eq(subRequests.id, c.req.param('requestId')), eq(subRequests.tenantId, tenant.id))).get();
    if (!request || request.status !== 'pending_approval' || !request.coveredByUserId) return c.json({ error: 'Invalid request' }, 400);

    await db.transaction(async (tx) => {
        await tx.update(subRequests).set({ status: 'filled', updatedAt: new Date() }).where(eq(subRequests.id, request.id));
        await tx.update(classes).set({ instructorId: request.coveredByUserId! }).where(eq(classes.id, request.classId));
    });

    c.executionCtx.waitUntil((async () => {
        try {
            const { EmailService } = await import('../services/email');
            const email = new EmailService(c.env.RESEND_API_KEY as string, tenant.settings as any, { slug: tenant.slug }, undefined, false, db, tenant.id);
            const covMem = await db.select().from(tenantMembers).where(eq(tenantMembers.id, request.coveredByUserId!)).get();
            const origMem = await db.select().from(tenantMembers).where(eq(tenantMembers.id, request.originalInstructorId!)).get();
            const cls = await db.select().from(classes).where(eq(classes.id, request.classId)).get();
            const dateStr = formatShortDate(cls?.startTime || new Date());

            if (covMem) {
                const u = await db.select().from(users).where(eq(users.id, covMem.userId)).get();
                if (u) await email.sendGenericEmail(u.email, `Sub Approved`, `<p>Your claim for ${cls?.title} on ${dateStr} has been approved. You are now the assigned instructor.</p>`);
            }
            if (origMem) {
                const u = await db.select().from(users).where(eq(users.id, origMem.userId)).get();
                const coverName = covMem?.profile && typeof covMem.profile === 'string' ? JSON.parse(covMem.profile).firstName : (covMem?.profile as any)?.firstName;
                if (u) await email.sendSubRequestFilled(u.email, { classTitle: cls?.title || 'Class', date: dateStr, coveredBy: String(coverName) });
            }
        } catch (e) { console.error(e); }
    })());

    return c.json({ success: true });
});

// POST /items/:requestId/decline
app.post('/items/:requestId/decline', async (c) => {
    if (!c.get('can')('manage_classes')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant missing' }, 400);

    await db.update(subRequests).set({ status: 'open', coveredByUserId: null, updatedAt: new Date() }).where(and(eq(subRequests.id, c.req.param('requestId')), eq(subRequests.tenantId, tenant.id))).run();
    return c.json({ success: true });
});

// POST /items/:requestId/accept
app.post('/items/:requestId/accept', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');
    if (!tenant || !member) return c.json({ error: 'Context required' }, 401);

    const request = await db.select().from(subRequests).where(and(eq(subRequests.id, c.req.param('requestId')), eq(subRequests.tenantId, tenant.id))).get();
    if (!request || request.status !== 'open') return c.json({ error: 'Invalid request' }, 400);
    if (request.originalInstructorId === member.id) return c.json({ error: 'Cannot self-accept' }, 400);

    const requireApproval = (tenant.settings as any)?.substitutionsRequireApproval === true;
    const finalStatus = requireApproval ? 'pending_approval' : 'filled';

    await db.transaction(async (tx) => {
        await tx.update(subRequests).set({
            status: finalStatus as any,
            coveredByUserId: member.id,
            updatedAt: new Date()
        }).where(eq(subRequests.id, request.id));

        // Only update class instructor if approval is NOT required
        if (!requireApproval) {
            await tx.update(classes).set({ instructorId: member.id }).where(eq(classes.id, request.classId));
        }
    });

    c.executionCtx.waitUntil((async () => {
        try {
            const { EmailService } = await import('../services/email');
            const email = new EmailService(c.env.RESEND_API_KEY as string, tenant.settings as any, { slug: tenant.slug }, undefined, false, db, tenant.id);
            const coverName = member.profile && typeof member.profile === 'string' ? JSON.parse(member.profile).firstName : member.profile?.firstName;
            const cls = await db.select().from(classes).where(eq(classes.id, request.classId)).get();
            const dateStr = formatShortDate(cls?.startTime || new Date());

            if (requireApproval) {
                // Notify Owners of claim that needs approval
                const owners = await db.select({ email: users.email }).from(tenantMembers)
                    .innerJoin(users, eq(tenantMembers.userId, users.id))
                    .innerJoin(tenantRoles, eq(tenantRoles.memberId, tenantMembers.id))
                    .where(and(eq(tenantMembers.tenantId, tenant.id), eq(tenantRoles.role, 'owner'))).all();

                for (const o of owners) {
                    await email.sendGenericEmail(o.email, `Sub Claim Approval Needed`, `<p>${coverName} has claimed the sub for ${cls?.title} on ${dateStr}. Please approve in dashboard.</p>`);
                }
            } else {
                // Immediate acceptance notification
                const origMem = await db.select().from(tenantMembers).where(eq(tenantMembers.id, request.originalInstructorId!)).get();
                if (origMem) {
                    const u = await db.select().from(users).where(eq(users.id, origMem.userId)).get();
                    if (u) {
                        const s = (origMem.settings as any)?.notifications?.substitutions || { email: true, sms: false, push: false };
                        if (s.email !== false) await email.sendSubRequestFilled(u.email, { classTitle: cls?.title || 'Class', date: dateStr, coveredBy: String(coverName) });
                    }
                }
            }
        } catch (e) { console.error(e); }
    })());

    return c.json({ success: true, status: finalStatus });
});

export default app;
