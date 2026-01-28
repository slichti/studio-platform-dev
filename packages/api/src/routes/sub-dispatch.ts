
import { Hono } from 'hono';
import { eq, and, sql, desc, ne } from 'drizzle-orm';
import { createDb } from '../db';
import { subRequests, classes, tenantMembers, tenantRoles, tenants, users } from '@studio/db/src/schema'; // users imported
import { authMiddleware } from '../middleware/auth';
import { z } from 'zod';
import { EmailService } from '../services/email';

type Bindings = {
    DB: D1Database;
    RESEND_API_KEY: string;
};

type Variables = {
    tenant: typeof tenants.$inferSelect;
    member?: typeof tenantMembers.$inferSelect;
    roles?: string[];
};

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

app.use('*', authMiddleware);

// GET /items - List open sub requests for the tenant
app.get('/items', async (c) => {
    // @ts-ignore
    const tenant = c.get('tenant');
    const db = createDb(c.env.DB);

    // Fetch open requests with class and original instructor details
    // Note: In real app, might want to filter by date (future classes only)
    const requests = await db.select({
        id: subRequests.id,
        status: subRequests.status,
        message: subRequests.message,
        createdAt: subRequests.createdAt,
        classTitle: classes.title,
        startTime: classes.startTime,
        originalInstructorName: sql<string>`json_extract(${tenantMembers.profile}, '$.firstName')`, // Simplified profile access
        classId: classes.id
    })
        .from(subRequests)
        .innerJoin(classes, eq(subRequests.classId, classes.id))
        .innerJoin(tenantMembers, eq(subRequests.originalInstructorId, tenantMembers.id))
        .where(and(
            eq(subRequests.tenantId, tenant.id),
            eq(subRequests.status, 'open')
        ))
        .orderBy(desc(classes.startTime))
        .all();

    return c.json({ requests });
});

// POST /classes/:classId/request - Create a sub request
app.post('/classes/:classId/request', async (c) => {
    const classId = c.req.param('classId');
    // @ts-ignore
    const tenant = c.get('tenant');
    // @ts-ignore
    const member = c.get('member'); // Required: Logged in as a member (Instructor)
    const db = createDb(c.env.DB);

    if (!member) return c.json({ error: 'Member context required' }, 401);

    const body = await c.req.json();
    const message = body.message;

    // Verify ownership or admin
    const classData = await db.select().from(classes)
        .where(and(eq(classes.id, classId), eq(classes.tenantId, tenant.id)))
        .get();

    if (!classData) return c.json({ error: 'Class not found' }, 404);

    // Allow if user is the instructor OR is an admin
    // We assume 'member' has roles attached or we query them. 
    // For simplicity, strict check on instructorId unless admin.
    if (classData.instructorId !== member.id) {
        // @ts-ignore
        const roles = c.get('roles') || [];
        if (!roles.includes('admin') && !roles.includes('owner')) {
            return c.json({ error: 'Not authorized: Must be the instructor or an admin' }, 403);
        }
    }

    // Check if request already exists
    const existing = await db.select().from(subRequests)
        .where(and(eq(subRequests.classId, classId), eq(subRequests.status, 'open')))
        .get();

    if (existing) return c.json({ error: 'Open request already exists' }, 400);

    const requestId = crypto.randomUUID();
    await db.insert(subRequests).values({
        id: requestId,
        tenantId: tenant.id,
        classId,
        originalInstructorId: classData.instructorId,
        message,
        status: 'open',
        createdAt: new Date(),
        updatedAt: new Date()
    });

    // Notify other instructors
    try {
        const emailService = new EmailService(c.env.RESEND_API_KEY || 're_123', tenant.settings as any, { slug: tenant.slug }, undefined, false, db, tenant.id);

        // Find all instructors except the requester
        // Must join with users to get email
        const instructors = await db.select({
            email: users.email
        })
            .from(tenantMembers)
            .innerJoin(users, eq(tenantMembers.userId, users.id))
            .innerJoin(tenantRoles, eq(tenantRoles.memberId, tenantMembers.id))
            .where(and(
                eq(tenantMembers.tenantId, tenant.id),
                eq(tenantRoles.role, 'instructor'),
                ne(tenantMembers.id, member.id) // Exclude requester
            ))
            .all();

        const uniqueEmails = [...new Set(instructors.map(i => i.email))];
        const dateStr = new Date(classData.startTime).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' });
        // @ts-ignore
        const requesterName = member.profile?.firstName ? `${member.profile.firstName} ${member.profile.lastName || ''}` : member.id;

        // Send alerts in parallel
        await Promise.all(uniqueEmails.map(email =>
            emailService.sendSubRequestAlert(email, {
                classTitle: classData.title,
                date: dateStr,
                requestingInstructor: requesterName,
                message,
                link: `https://${tenant.slug}.studio-platform.com/studio/${tenant.slug}/substitutions`
            })
        ));

        console.log(`[SubDispatch] Notified ${uniqueEmails.length} instructors`);
    } catch (e) {
        console.error("Failed to send sub notifications", e);
    }

    return c.json({ success: true, requestId });
});

// POST /items/:requestId/accept - Accept a sub request
app.post('/items/:requestId/accept', async (c) => {
    const requestId = c.req.param('requestId');
    // @ts-ignore
    const tenant = c.get('tenant');
    // @ts-ignore
    const member = c.get('member');
    const db = createDb(c.env.DB);

    if (!member) return c.json({ error: 'Member context required' }, 401);

    const request = await db.select().from(subRequests)
        .where(and(eq(subRequests.id, requestId), eq(subRequests.tenantId, tenant.id)))
        .get();

    if (!request) return c.json({ error: 'Request not found' }, 404);
    if (request.status !== 'open') return c.json({ error: 'Request is not open' }, 400);
    // @ts-ignore
    if (request.originalInstructorId === member.id) return c.json({ error: 'Cannot accept your own request' }, 400);

    // Atomic update: Mark filled AND update class instructor
    await db.transaction(async (tx) => {
        // 1. Update request
        await tx.update(subRequests)
            .set({
                status: 'filled',
                coveredByUserId: member.id,
                updatedAt: new Date()
            })
            .where(eq(subRequests.id, requestId));

        // 2. Update class instructor
        await tx.update(classes)
            .set({ instructorId: member.id })
            .where(eq(classes.id, request.classId));
    });

    // Notify original instructor
    try {
        const emailService = new EmailService(c.env.RESEND_API_KEY || 're_123', tenant.settings as any, { slug: tenant.slug }, undefined, false, db, tenant.id);

        const originalInstructorMember = await db.select().from(tenantMembers).where(eq(tenantMembers.id, request.originalInstructorId!)).get();

        if (originalInstructorMember) {
            // Get User to get Email
            const originalUser = await db.select().from(users).where(eq(users.id, originalInstructorMember.userId)).get();

            if (originalUser) {
                const classData = await db.select().from(classes).where(eq(classes.id, request.classId)).get();
                const dateStr = classData ? new Date(classData.startTime).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' }) : 'Unknown Date';
                // @ts-ignore
                const covererName = member.profile?.firstName ? `${member.profile.firstName} ${member.profile.lastName || ''}` : member.id;

                await emailService.sendSubRequestFilled(originalUser.email, {
                    classTitle: classData?.title || 'Class',
                    date: dateStr,
                    coveringInstructor: covererName
                });
                console.log(`[SubDispatch] Notified original instructor ${originalUser.email}`);
            }
        }
    } catch (e) {
        console.error("Failed to send sub filled notification", e);
    }

    return c.json({ success: true });
});

export default app;
