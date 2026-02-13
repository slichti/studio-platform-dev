import { Hono } from 'hono';
import { createDb } from '../db';
import { bookings, classes, tenantMembers, users, tenants, tenantRoles } from '@studio/db/src/schema';
import { eq, and, sql } from 'drizzle-orm';
import { checkAndPromoteWaitlist } from './waitlist';
import { HonoContext } from '../types';
import { BookingService } from '../services/bookings';
import { ConflictService } from '../services/conflicts';

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

// GET /:id
app.get('/:id', async (c) => {
    const db = createDb(c.env.DB);
    const b = await db.query.bookings.findFirst({
        where: eq(bookings.id, c.req.param('id')),
        with: { class: true }
    });
    if (!b) return c.json({ error: "Not found" }, 404);
    if ((b as any).class?.tenantId !== c.get('tenant')!.id) {
        return c.json({ error: "Forbidden" }, 403);
    }

    const auth = c.get('auth')!;
    const roles = c.get('roles') || [];
    const member = await db.select().from(tenantMembers).where(and(eq(tenantMembers.userId, auth.userId), eq(tenantMembers.tenantId, c.get('tenant')!.id))).get();

    if (!member) return c.json({ error: "Unauthorized" }, 401);

    // Security: Only the member who booked or someone with manage_classes permission can view the booking
    if (b.memberId !== member.id && !c.get('can')('manage_classes')) {
        return c.json({ error: "Forbidden" }, 403);
    }

    return c.json(b);
});

// POST /
app.post('/', async (c) => {
    const json = await c.req.json();
    const { classId, attendanceType, memberId } = json;
    console.log(`[DEBUG] POST /bookings - Class: ${classId}, AuthUser: ${c.get('auth')?.userId}, Tenant: ${c.get('tenant')?.id}`);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant')!;

    let targetId = memberId;
    if (!targetId) {
        const m = await db.select().from(tenantMembers).where(and(eq(tenantMembers.userId, c.get('auth')!.userId), eq(tenantMembers.tenantId, tenant.id))).get();

        if (!m && c.get('isPlatformAdmin')) {
            // Auto-create a member record for platform admins to allow the DB constraints to pass
            const newMemberId = crypto.randomUUID();
            await db.insert(tenantMembers).values({
                id: newMemberId,
                tenantId: tenant.id,
                userId: c.get('auth')!.userId,
                status: 'active',
                joinedAt: new Date()
            }).run();

            // Also insert the role record
            await db.insert(tenantRoles).values({
                id: crypto.randomUUID(),
                memberId: newMemberId,
                role: 'owner',
                createdAt: new Date()
            }).run();

            targetId = newMemberId;
            console.log(`[DEBUG] POST /bookings - Auto-created member ${newMemberId} and owner role for platform admin`);
        } else if (!m) {
            return c.json({ error: "Member not found" }, 403);
        } else {
            targetId = m.id;
        }
    }

    const cl = await db.select().from(classes).where(and(eq(classes.id, classId), eq(classes.tenantId, tenant.id))).get();
    if (!cl) return c.json({ error: "Not found" }, 404);

    const existing = await db.select().from(bookings).where(and(eq(bookings.classId, classId), eq(bookings.memberId, targetId), eq(bookings.status, 'confirmed'))).all();
    if (existing.length > 0) return c.json({ error: "Already booked" }, 400);

    const count = (await db.select({ c: sql<number>`count(*)` }).from(bookings).where(and(eq(bookings.classId, classId), eq(bookings.status, 'confirmed'))).get())?.c || 0;
    if (!cl.zoomEnabled && cl.capacity && count >= cl.capacity) return c.json({ error: "Class is full" }, 400);

    const id = crypto.randomUUID();
    await db.insert(bookings).values({ id, classId, memberId: targetId, status: 'confirmed', attendanceType: attendanceType || 'in_person', createdAt: new Date() }).run();

    c.executionCtx.waitUntil((async () => {
        try {
            const { EmailService } = await import('../services/email');
            const { AutomationsService } = await import('../services/automations');
            const { SmsService } = await import('../services/sms');
            const { PushService } = await import('../services/push');
            const { UsageService } = await import('../services/pricing');
            const m = await db.query.tenantMembers.findFirst({ where: eq(tenantMembers.id, targetId), with: { user: true } });
            if (m?.user) {
                const us = new UsageService(db, tenant.id);
                const es = new EmailService((tenant.resendCredentials as any)?.apiKey || c.env.RESEND_API_KEY!, { branding: tenant.branding as any, settings: tenant.settings as any }, { slug: tenant.slug }, us, !!(tenant.resendCredentials as any)?.apiKey, db, tenant.id);
                const ps = new PushService(db, tenant.id);
                const as = new AutomationsService(db, tenant.id, es, new SmsService(tenant.twilioCredentials as any, c.env, us, db, tenant.id), ps);
                await as.dispatchTrigger('class_booked', { userId: m.user.id, email: m.user.email, firstName: (m.user.profile as any)?.firstName, data: { classId, classTitle: cl.title, startTime: cl.startTime, bookingId: id } });
            }
        } catch (e) { console.error(e); }
    })());
    return c.json({ success: true, id });
});

// DELETE /:id
app.delete('/:id', async (c) => {
    const db = createDb(c.env.DB);
    const bid = c.req.param('id');
    const auth = c.get('auth')!;
    const tenant = c.get('tenant')!;

    const b = await db.query.bookings.findFirst({
        where: eq(bookings.id, bid),
        with: { member: true }
    });
    if (!b) return c.json({ error: "Not found" }, 404);

    if (b.member.userId !== auth.userId && !c.get('can')('manage_classes')) {
        return c.json({ error: "Forbidden" }, 403);
    }

    const service = new BookingService(db, c.env as any);
    await service.cancelBooking(bid);
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
