
import { Hono } from 'hono';
import { eq, and, sql, desc, asc } from 'drizzle-orm';
import { createDb } from '../db';
import { waitlist, classes, bookings, users, tenants } from '@studio/db/src/schema'; // Ensure this path matches
import { authMiddleware } from '../middleware/auth';
import { HonoContext } from '../types';
import { z } from 'zod';
// import { zValidator } from '@hono/zod-validator';

const app = new Hono<HonoContext>();

// Middleware to ensure tenant context
app.use('*', authMiddleware);

// Join Waitlist
app.post('/:classId/join', async (c) => {
    const classId = c.req.param('classId');
    // @ts-ignore
    const tenant = c.get('tenant') as any;
    const auth = c.get('auth') as any;
    const db = createDb((c.env as any).DB);

    // 1. Check if class exists and is full
    const classData = await db.select().from(classes)
        .where(and(eq(classes.id, classId), eq(classes.tenantId, tenant.id)))
        .get();

    if (!classData) return c.json({ error: 'Class not found' }, 404);

    // Count bookings
    const bookingCount = await db.select({ count: sql<number>`count(*)` })
        .from(bookings)
        .where(and(eq(bookings.classId, classId), eq(bookings.status, 'confirmed')))
        .get();

    const currentBookings = bookingCount?.count || 0;
    if (classData.capacity && currentBookings < classData.capacity) {
        return c.json({ error: 'Class is not full, you can book directly' }, 400);
    }

    // 2. Check if already on waitlist
    const existing = await db.select().from(waitlist)
        .where(and(eq(waitlist.classId, classId), eq(waitlist.userId, auth.userId), eq(waitlist.status, 'pending')))
        .get();

    if (existing) return c.json({ error: 'Already on waitlist' }, 400);

    // 3. Get next position
    const lastItem = await db.select().from(waitlist)
        .where(eq(waitlist.classId, classId))
        .orderBy(desc(waitlist.position))
        .limit(1)
        .get();

    const nextPosition = (lastItem?.position || 0) + 1;

    // 4. Add to waitlist
    await db.insert(waitlist).values({
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        classId,
        userId: auth.userId,
        position: nextPosition,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
    });

    return c.json({ success: true, position: nextPosition });
});

// Helper: Trigger Auto Promotion (Internal or Admin trigger)
export const checkAndPromoteWaitlist = async (classId: string, tenantId: string, env: any) => {
    const db = createDb(env.DB);
    // 1. Get Class & Tenant Data
    const classData = await db.select().from(classes).where(eq(classes.id, classId)).get();
    if (!classData || !classData.capacity) return;

    // 2. Check Capacity
    const bookingCount = await db.select({ count: sql<number>`count(*)` })
        .from(bookings)
        .where(and(eq(bookings.classId, classId), eq(bookings.status, 'confirmed')))
        .get();

    const spotsAvailable = classData.capacity - (bookingCount?.count || 0);

    if (spotsAvailable > 0) {
        // 3. Find Candidates
        const candidates = await db.query.waitlist.findMany({
            where: and(
                eq(waitlist.classId, classId),
                eq(waitlist.status, 'pending')
            ),
            orderBy: asc(waitlist.position),
            limit: spotsAvailable,
            with: {
                user: true // Ensure we get user details
            }
        });

        if (candidates.length === 0) return;

        // 4. Initialize Services
        const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) });
        if (!tenant) return;

        // Dynamic Imports to avoid circular deps or context issues
        const { EmailService } = await import('../services/email');
        const { UsageService } = await import('../services/pricing');

        const usageService = new UsageService(db, tenant.id);
        const resendKey = (tenant.resendCredentials as any)?.apiKey || env.RESEND_API_KEY;
        const isByok = !!(tenant.resendCredentials as any)?.apiKey;

        const emailService = new EmailService(
            resendKey,
            { branding: tenant.branding as any, settings: tenant.settings as any },
            { slug: tenant.slug },
            usageService,
            isByok,
            db,
            tenant.id
        );

        for (const candidate of candidates) {
            // Offer spot
            await db.update(waitlist)
                .set({
                    status: 'offered',
                    offerExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 Hours
                    updatedAt: new Date()
                })
                .where(eq(waitlist.id, candidate.id));

            console.log(`[Waitlist] Offered spot to user ${candidate.userId} for class ${classData.title}`);

            // Send Notification
            const user = candidate.user as any;
            if (user) {
                // Email
                if (user.email) {
                    await emailService.sendGenericEmail(
                        user.email,
                        `Spot Open: ${classData.title}`,
                        `<h1>Good news! A spot opened up!</h1>
                        <p>Hi ${(user.profile as any)?.firstName || 'there'},</p>
                        <p>A spot has become available in <strong>${classData.title}</strong> on ${new Date(classData.startTime).toLocaleDateString()}.</p>
                        <p>You have 2 hours to claim this spot before it is offered to the next person.</p>
                        <p><a href="https://${tenant.slug}.studio.platform/schedule">Claim Spot Now</a></p>`
                    );
                }

                // Push Notification
                if (user.pushToken) {
                    try {
                        await fetch('https://exp.host/--/api/v2/push/send', {
                            method: 'POST',
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                to: user.pushToken,
                                sound: 'default',
                                title: 'Spot Available! 🎉',
                                body: `A spot opened up in ${classData.title}. Tap to claim it!`,
                                data: { classId: classData.id, action: 'claim_spot' },
                            }),
                        });
                        console.log(`[Waitlist] Push sent to ${user.id}`);
                    } catch (pushErr) {
                        console.error("[Waitlist] Push Failed", pushErr);
                    }
                }
            }
        }
    }
};

export default app;
