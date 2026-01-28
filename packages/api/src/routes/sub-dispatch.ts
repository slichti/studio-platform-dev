
import { Hono } from 'hono';
import { eq, and, sql, desc, ne } from 'drizzle-orm';
import { createDb } from '../db';
import { subRequests, classes, tenantMembers, tenantRoles, tenants, users } from '@studio/db/src/schema'; // users imported
import { authMiddleware } from '../middleware/auth';
import { z } from 'zod';
import { EmailService } from '../services/email';
import { SmsService } from '../services/sms';
import { PushService } from '../services/push';

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
        const smsService = new SmsService(undefined, c.env, undefined, db, tenant.id);
        const pushService = new PushService(db, tenant.id);

        // Find all instructors except the requester with settings
        // Must join with users to get email and tenantMembers for settings
        const instructors = await db.select({
            email: users.email,
            phone: sql<string>`json_extract(${users.profile}, '$.phoneNumber')`,
            pushToken: users.pushToken,
            settings: tenantMembers.settings,
            memberId: tenantMembers.id
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

        const dateStr = new Date(classData.startTime).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' });
        // @ts-ignore
        const requesterName = member.profile?.firstName ? `${member.profile.firstName} ${member.profile.lastName || ''}` : member.id;
        const link = `https://${tenant.slug}.studio-platform.com/studio/${tenant.slug}/substitutions`;

        // Send alerts based on preferences
        const uniqueInstructors = [...new Map(instructors.map(item => [item.memberId, item])).values()];

        await Promise.all(uniqueInstructors.map(async (inst) => {
            const settings = (inst.settings as any)?.notifications?.substitutions || { email: true, sms: false, push: false };

            // Email (Default True)
            if (settings.email !== false) {
                await emailService.sendSubRequestAlert(inst.email, {
                    classTitle: classData.title,
                    date: dateStr,
                    requestingInstructor: requesterName,
                    message,
                    link
                });
            }

            // SMS (Default False)
            if (settings.sms === true && inst.phone) {
                const smsBody = `[${tenant.name}] SUB REQUEST: ${requesterName} needs coverage for ${formatShortDate(classData.startTime)} - ${classData.title}. Reply or check app to accept.`;
                await smsService.sendSms(inst.phone, smsBody, inst.memberId);
            }

            // Push (Default True if token exists? Or False? Let's default False for safety unless opted in)
            // User requested "Notification Preferences", implying Opt-in/out. 
            // Let's assume default OFF for now until UI toggled ON? 
            // actually, app users usually EXPECT push. But let's stick to safe defaults or mirrored settings.
            if (settings.push === true && inst.pushToken) {
                await pushService.sendPush(inst.pushToken, `Sub Needed: ${classData.title}`, `${requesterName} needs coverage on ${formatShortDate(classData.startTime)}`, { requestId: requestId, classId: classId });
            }
        }));

        console.log(`[SubDispatch] Processed notifications for ${uniqueInstructors.length} instructors`);
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
        const smsService = new SmsService(undefined, c.env, undefined, db, tenant.id);
        const pushService = new PushService(db, tenant.id);

        const originalInstructorMember = await db.select().from(tenantMembers).where(eq(tenantMembers.id, request.originalInstructorId!)).get();

        if (originalInstructorMember) {
            // Get User to get Email & Phone
            const originalUser = await db.select().from(users).where(eq(users.id, originalInstructorMember.userId)).get();

            if (originalUser) {
                const classData = await db.select().from(classes).where(eq(classes.id, request.classId)).get();
                const dateStr = classData ? new Date(classData.startTime).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' }) : 'Unknown Date';
                // @ts-ignore
                const covererName = member.profile?.firstName ? `${member.profile.firstName} ${member.profile.lastName || ''}` : member.id;

                const settings = (originalInstructorMember.settings as any)?.notifications?.substitutions || { email: true, sms: false, push: false };

                // Email
                if (settings.email !== false) {
                    await emailService.sendSubRequestFilled(originalUser.email, {
                        classTitle: classData?.title || 'Class',
                        date: dateStr,
                        coveringInstructor: covererName
                    });
                }

                // SMS
                // @ts-ignore
                const startStr = formatShortDate(classData.startTime);
                // @ts-ignore
                const phone = originalUser.profile?.phoneNumber;

                if (settings.sms === true && phone) {
                    const smsBody = `[${tenant.name}] SUB FILLED: ${covererName} accepted your request for ${startStr}.`;
                    await smsService.sendSms(phone, smsBody, originalInstructorMember.id);
                }

                if (settings.push === true && originalUser.pushToken) {
                    await pushService.sendPush(originalUser.pushToken, `Sub Filled: ${classData?.title}`, `${covererName} accepted your request on ${startStr}.`, { requestId: requestId, classId: request.classId });
                }

                console.log(`[SubDispatch] Notified original instructor ${originalUser.email}`);
            }
        }
    } catch (e) {
        console.error("Failed to send sub filled notification", e);
    }

    return c.json({ success: true });
});

function formatShortDate(date: Date) {
    if (!date) return '';
    return new Date(date).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default app;
