import { Hono } from 'hono';
import { createDb } from '../db';
import { substitutions, classes, tenantMembers, users, tenants, tenantRoles } from 'db/src/schema'; // Ensure these match schema exports
import { eq, and, desc } from 'drizzle-orm';

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

// GET / - List all substitution requests for the tenant
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');

    const subs = await db.query.substitutions.findMany({
        where: eq(substitutions.tenantId, tenant.id),
        with: {
            class: true,
            requestingInstructor: { with: { user: true } },
            coveringInstructor: { with: { user: true } }
        },
        orderBy: desc(substitutions.createdAt)
    });

    return c.json({ substitutions: subs });
});

// POST /request - Create a substitution request
app.post('/request', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');
    if (!member) return c.json({ error: "Unauthorized: Member context missing" }, 401);

    const { classId, notes } = await c.req.json();

    if (!classId) return c.json({ error: "Class ID required" }, 400);

    // Verify class belongs to tenant and instructor
    const cls = await db.query.classes.findFirst({
        where: and(eq(classes.id, classId), eq(classes.tenantId, tenant.id))
    });

    if (!cls) return c.json({ error: "Class not found" }, 404);

    // Check if the requester is the instructor of the class OR an owner (owners can request on behalf)
    const roles = c.get('roles') || [];
    const isOwner = roles.includes('owner');
    if (cls.instructorId !== member.id && !isOwner) {
        return c.json({ error: "You can only request subs for your own classes" }, 403);
    }

    const subId = crypto.randomUUID();
    await db.insert(substitutions).values({
        id: subId,
        tenantId: tenant.id,
        classId,
        requestingInstructorId: cls.instructorId, // The person who NEEDS the sub
        status: 'pending',
        notes
    }).run();

    // Notify Owners? Or just let them see it in dashboard.
    // Ideally notify Owners that "A sub request needs approval" if it was claimed? 
    // Or notify pending.
    // Let's notify Owners about the request.
    const owners = await db.select({ email: users.email })
        .from(tenantMembers)
        .innerJoin(users, eq(tenantMembers.userId, users.id))
        .innerJoin(tenantRoles, eq(tenantMembers.id, tenantRoles.memberId))
        .where(and(eq(tenantMembers.tenantId, tenant.id), eq(tenantRoles.role, 'owner')))
        .all();

    c.executionCtx.waitUntil((async () => {
        for (const owner of owners) {
            await sendSubEmail(c.env, tenant, owner.email,
                `New Sub Request: ${cls.title}`,
                `<p><strong>${member.user.profile?.firstName} ${member.user.profile?.lastName}</strong> requested coverage for <strong>${cls.title}</strong> on ${new Date(cls.startTime).toLocaleString()}.</p><p>Check the admin dashboard to manage requests.</p>`
            );
        }
    })());

    return c.json({ id: subId, status: 'pending' }, 201);
});

async function sendSubEmail(env: Bindings, tenant: any, to: string, subject: string, html: string) {
    if (!env.RESEND_API_KEY) return;
    try {
        const { EmailService } = await import('../services/email');
        const emailService = new EmailService(env.RESEND_API_KEY, {
            branding: tenant.branding,
            settings: tenant.settings
        });
        await emailService.sendGenericEmail(to, subject, html);
    } catch (e) {
        console.error("Failed to send sub email", e);
    }
}

// POST /:id/claim - Claim a substitution request
app.post('/:id/claim', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const member = c.get('member');
    if (!member) return c.json({ error: "Unauthorized" }, 401);

    const subId = c.req.param('id');
    const sub = await db.query.substitutions.findFirst({
        where: and(eq(substitutions.id, subId), eq(substitutions.tenantId, tenant.id)),
        with: { class: true }
    });

    if (!sub) return c.json({ error: "Request not found" }, 404);
    if (sub.status !== 'pending') return c.json({ error: "Request is no longer pending" }, 400);
    if (sub.requestingInstructorId === member.id) {
        return c.json({ error: "You cannot claim your own sub request" }, 400);
    }

    // Update Status to Claimed
    await db.update(substitutions)
        .set({
            status: 'claimed',
            coveringInstructorId: member.id,
            updatedAt: new Date()
        })
        .where(eq(substitutions.id, subId))
        .run();

    // Notify Requesting Instructor & Owners
    const requester = await db.select({ email: users.email, profile: users.profile })
        .from(tenantMembers)
        .innerJoin(users, eq(tenantMembers.userId, users.id))
        .where(eq(tenantMembers.id, sub.requestingInstructorId))
        .get();

    const owners = await db.select({ email: users.email })
        .from(tenantMembers)
        .innerJoin(users, eq(tenantMembers.userId, users.id))
        .innerJoin(tenantRoles, eq(tenantMembers.id, tenantRoles.memberId))
        .where(and(eq(tenantMembers.tenantId, tenant.id), eq(tenantRoles.role, 'owner')))
        .all();

    c.executionCtx.waitUntil((async () => {
        const coverName = `${member.user.profile?.firstName} ${member.user.profile?.lastName}`;
        const className = sub.class?.title || 'Class';
        const classTime = new Date(sub.class?.startTime).toLocaleString();

        // To Requester
        if (requester) {
            await sendSubEmail(c.env, tenant, requester.email,
                `Sub Claimed: ${className}`,
                `<p><strong>${coverName}</strong> has offered to cover your class <strong>${className}</strong> on ${classTime}.</p><p>This request is now pending owner approval.</p>`
            );
        }

        // To Owners
        for (const owner of owners) {
            await sendSubEmail(c.env, tenant, owner.email,
                `Action Required: Sub Request Claimed`,
                `<p><strong>${coverName}</strong> has offered to cover <strong>${className}</strong>.</p><p>Please approve or decline this substitution in the dashboard.</p>`
            );
        }
    })());

    return c.json({ success: true, status: 'claimed' });
});

// POST /:id/approve - Approve a substitution
app.post('/:id/approve', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];

    if (!roles.includes('owner')) {
        return c.json({ error: "Only owners can approve substitutions" }, 403);
    }

    const subId = c.req.param('id');
    const sub = await db.query.substitutions.findFirst({
        where: and(eq(substitutions.id, subId), eq(substitutions.tenantId, tenant.id)),
        with: { class: true }
    });

    if (!sub || !sub.coveringInstructorId) {
        return c.json({ error: "Request not found or not claimed yet" }, 400);
    }

    // 1. Update Sub Status
    await db.update(substitutions)
        .set({ status: 'approved', updatedAt: new Date() })
        .where(eq(substitutions.id, subId))
        .run();

    // 2. SWAP Instructor on Class
    await db.update(classes)
        .set({ instructorId: sub.coveringInstructorId })
        .where(eq(classes.id, sub.classId))
        .run();

    // (Notification logic continues...)

    // Notify Both Instructors
    const requestingMember = await db.select({ email: users.email, profile: users.profile })
        .from(tenantMembers)
        .innerJoin(users, eq(tenantMembers.userId, users.id))
        .where(eq(tenantMembers.id, sub.requestingInstructorId))
        .get();

    const coveringMember = await db.select({ email: users.email, profile: users.profile })
        .from(tenantMembers)
        .innerJoin(users, eq(tenantMembers.userId, users.id))
        .where(eq(tenantMembers.id, sub.coveringInstructorId))
        .get();

    c.executionCtx.waitUntil((async () => {
        const className = sub.class?.title || 'Class';
        const classTime = new Date(sub.class?.startTime).toLocaleString();

        if (requestingMember) {
            await sendSubEmail(c.env, tenant, requestingMember.email,
                `Sub Approved: ${className}`,
                `<p>Create news! Your substitution request for <strong>${className}</strong> on ${classTime} has been <strong>approved</strong>.</p>`
            );
        }

        if (coveringMember) {
            await sendSubEmail(c.env, tenant, coveringMember.email,
                `Sub Approved: ${className}`,
                `<p>You are now the official instructor for <strong>${className}</strong> on ${classTime}.</p>`
            );
        }
    })());

    return c.json({ success: true, status: 'approved' });
});

// POST /:id/decline - Decline/Cancel a request
app.post('/:id/decline', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const roles = c.get('roles') || [];
    const member = c.get('member');

    const subId = c.req.param('id');
    const sub = await db.query.substitutions.findFirst({
        where: and(eq(substitutions.id, subId), eq(substitutions.tenantId, tenant.id))
    });

    if (!sub) return c.json({ error: "Not found" }, 404);

    // Only owner or the requesting instructor can cancel/decline
    const isOwner = roles.includes('owner');
    if (!isOwner && sub.requestingInstructorId !== member?.id) {
        return c.json({ error: "Unauthorized" }, 403);
    }

    await db.update(substitutions)
        .set({ status: 'declined', updatedAt: new Date() })
        .where(eq(substitutions.id, subId))
        .run();

    return c.json({ success: true, status: 'declined' });
});

export default app;
