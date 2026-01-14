
import { Hono } from 'hono';
import { eq, and, sql, desc, asc } from 'drizzle-orm';
import { createDb } from '../db';
import { waitlist, classes, bookings, users, tenants } from 'db/src/schema'; // Ensure this path matches
import { authMiddleware } from '../middleware/auth';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const app = new Hono();

// Middleware to ensure tenant context
app.use('*', authMiddleware);

// Join Waitlist
app.post('/:classId/join', async (c) => {
    const classId = c.req.param('classId');
    // @ts-ignore
    const tenant = c.get('tenant');
    // @ts-ignore
    const user = c.get('user');
    const db = createDb(c.env.DB);

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
        .where(and(eq(waitlist.classId, classId), eq(waitlist.userId, user.id), eq(waitlist.status, 'pending')))
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
        userId: user.id,
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
    // 1. specific logic to check capacity
    const classData = await db.select().from(classes).where(eq(classes.id, classId)).get();
    if (!classData || !classData.capacity) return;

    const bookingCount = await db.select({ count: sql<number>`count(*)` })
        .from(bookings)
        .where(and(eq(bookings.classId, classId), eq(bookings.status, 'confirmed')))
        .get();

    const spotsAvailable = classData.capacity - (bookingCount?.count || 0);

    if (spotsAvailable > 0) {
        // Find next eligible person
        const candidates = await db.select().from(waitlist)
            .where(and(
                eq(waitlist.classId, classId),
                eq(waitlist.status, 'pending')
            ))
            .orderBy(asc(waitlist.position))
            .limit(spotsAvailable)
            .all();

        for (const candidate of candidates) {
            // Offer spot
            await db.update(waitlist)
                .set({
                    status: 'offered',
                    // offers expire in 2 hours
                    offerExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
                    updatedAt: new Date()
                })
                .where(eq(waitlist.id, candidate.id));

            // TODO: Send Notification (Push/SMS)
            console.log(`[Waitlist] Offered spot to user ${candidate.userId} for class ${classId}`);
        }
    }
};

export default app;
