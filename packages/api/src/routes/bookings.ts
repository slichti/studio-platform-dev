import { Hono } from 'hono';
import { createDb } from '../db';
import { bookings, classes, tenantMembers, users, tenants } from '@studio/db/src/schema';
import { eq, and, sql } from 'drizzle-orm';
import { checkAndPromoteWaitlist } from './waitlist';
import { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// GET /my-upcoming
app.get('/my-upcoming', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const auth = c.get('auth')!;
    const member = await db.query.tenantMembers.findFirst({ where: and(eq(tenantMembers.userId, auth.userId), eq(tenantMembers.tenantId, tenant.id)) });
    if (!member) return c.json({ error: "Member not found" }, 403);

    const list = await db.query.bookings.findMany({ where: eq(bookings.memberId, member.id), with: { class: { with: { instructor: { with: { user: true } } } } }, limit: 50, orderBy: [sql`${bookings.createdAt} desc`] });
    return c.json(list.map(b => ({ id: b.id, status: b.status, waitlistPosition: b.waitlistPosition, class: { title: b.class.title, startTime: b.class.startTime, instructor: (b.class.instructor?.user?.profile as any)?.firstName || "Staff" } })).sort((a, b) => new Date(a.class.startTime).getTime() - new Date(b.class.startTime).getTime()));
});

// POST /
app.post('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;
    const { classId, attendanceType, memberId } = await c.req.json();

    let targetId = memberId;
    if (!targetId) {
        const m = await db.select().from(tenantMembers).where(and(eq(tenantMembers.userId, c.get('auth')!.userId), eq(tenantMembers.tenantId, tenant.id))).get();
        if (!m) return c.json({ error: "Member not found" }, 403);
        targetId = m.id;
    }

    const cl = await db.select().from(classes).where(and(eq(classes.id, classId), eq(classes.tenantId, tenant.id))).get();
    if (!cl) return c.json({ error: "Not found" }, 404);

    if (await db.select().from(bookings).where(and(eq(bookings.classId, classId), eq(bookings.memberId, targetId), eq(bookings.status, 'confirmed'))).get()) return c.json({ error: "Already booked" }, 400);

    const count = (await db.select({ c: sql<number>`count(*)` }).from(bookings).where(and(eq(bookings.classId, classId), eq(bookings.status, 'confirmed'))).get())?.c || 0;
    if (!cl.zoomEnabled && cl.capacity && count >= cl.capacity) return c.json({ error: "Full" }, 400);

    const id = crypto.randomUUID();
    await db.insert(bookings).values({ id, classId, memberId: targetId, status: 'confirmed', attendanceType: attendanceType || 'in_person', createdAt: new Date() }).run();

    c.executionCtx.waitUntil((async () => {
        try {
            const { EmailService } = await import('../services/email');
            const { AutomationsService } = await import('../services/automations');
            const { SmsService } = await import('../services/sms');
            const { UsageService } = await import('../services/pricing');
            const m = await db.query.tenantMembers.findFirst({ where: eq(tenantMembers.id, targetId), with: { user: true } });
            if (m?.user) {
                const us = new UsageService(db, tenant.id);
                const es = new EmailService((tenant.resendCredentials as any)?.apiKey || c.env.RESEND_API_KEY!, { branding: tenant.branding as any, settings: tenant.settings as any }, { slug: tenant.slug }, us, !!(tenant.resendCredentials as any)?.apiKey);
                const as = new AutomationsService(db, tenant.id, es, new SmsService(tenant.twilioCredentials as any, c.env, us, db, tenant.id));
                await as.dispatchTrigger('class_booked', { userId: m.user.id, email: m.user.email, firstName: (m.user.profile as any)?.firstName, data: { classId, classTitle: cl.title, startTime: cl.startTime, bookingId: id } });
            }
        } catch (e) { console.error(e); }
    })());
    return c.json({ success: true, id });
});

// DELETE /:id
app.delete('/:id', async (c) => {
    const db = createDb(c.env.DB);
    const b = await db.select().from(bookings).where(eq(bookings.id, c.req.param('id'))).get();
    if (!b) return c.json({ error: "Not found" }, 404);

    const auth = c.get('auth')!;
    const member = await db.select().from(tenantMembers).where(and(eq(tenantMembers.userId, auth.userId), eq(tenantMembers.tenantId, c.get('tenant')!.id))).get();
    if (!member) return c.json({ error: "Unauthorized" }, 401);

    if (b.memberId !== member.id && !c.get('can')('manage_classes')) return c.json({ error: "Forbidden" }, 403);

    await db.delete(bookings).where(eq(bookings.id, b.id)).run();
    c.executionCtx.waitUntil(checkAndPromoteWaitlist(b.classId, c.get('tenant')!.id, c.env));
    return c.json({ success: true });
});

// PATCH /:id
app.patch('/:id', async (c) => {
    const db = createDb(c.env.DB);
    const b = await db.select().from(bookings).where(eq(bookings.id, c.req.param('id'))).get();
    if (!b) return c.json({ error: "Not found" }, 404);

    const auth = c.get('auth')!;
    const member = await db.select().from(tenantMembers).where(and(eq(tenantMembers.userId, auth.userId), eq(tenantMembers.tenantId, c.get('tenant')!.id))).get();
    if (!member) return c.json({ error: "Unauthorized" }, 401);

    if (b.memberId !== member.id && !c.get('can')('manage_classes')) return c.json({ error: "Forbidden" }, 403);

    const { attendanceType } = await c.req.json();
    await db.update(bookings).set({ attendanceType }).where(eq(bookings.id, b.id)).run();
    return c.json({ success: true });
});

export default app;
