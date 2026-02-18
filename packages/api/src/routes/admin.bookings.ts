import { Hono } from 'hono';
import { createDb } from '../db';
import { bookings, classes, tenantMembers, users, tenants } from '@studio/db/src/schema';
import { eq, and, sql, desc, count as drizzleCount } from 'drizzle-orm';
import type { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// GET / - List all bookings platform-wide (Admin Only)
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
    const offset = parseInt(c.req.query('offset') || '0');
    const status = c.req.query('status');

    try {
        // Base where clause
        const conditions = [];
        if (status) {
            conditions.push(eq(bookings.status, status as any));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Get total count
        const countResult = await db.select({ count: drizzleCount() })
            .from(bookings)
            .where(whereClause)
            .get();
        const total = countResult?.count || 0;

        // Get paginated results with joins
        const results = await db.select({
            id: bookings.id,
            status: bookings.status,
            attendanceType: bookings.attendanceType,
            createdAt: bookings.createdAt,
            class: {
                id: classes.id,
                title: classes.title,
                startTime: classes.startTime,
            },
            tenant: {
                id: tenants.id,
                name: tenants.name,
                slug: tenants.slug,
            },
            student: {
                id: users.id,
                email: users.email,
                profile: users.profile,
            }
        })
            .from(bookings)
            .leftJoin(classes, eq(bookings.classId, classes.id))
            .leftJoin(tenants, eq(classes.tenantId, tenants.id))
            .leftJoin(tenantMembers, eq(bookings.memberId, tenantMembers.id))
            .leftJoin(users, eq(tenantMembers.userId, users.id))
            .where(whereClause)
            .orderBy(desc(bookings.createdAt))
            .limit(limit)
            .offset(offset)
            .all();

        return c.json({
            bookings: results,
            total,
            limit,
            offset
        });
    } catch (e: any) {
        console.error("Fetch Admin Bookings Failed:", e);
        return c.json({ error: "Failed to fetch bookings: " + e.message }, 500);
    }
});

export default app;
