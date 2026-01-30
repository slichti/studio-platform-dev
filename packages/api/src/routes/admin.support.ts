import { Hono } from 'hono';
import { createDb } from '../db';
import { chatRooms, tenants } from '@studio/db/src/schema';
import { eq, desc, and, or, sql } from 'drizzle-orm';
import type { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// GET /tickets - Global Support Ticket Queue
app.get('/tickets', async (c) => {
    const db = createDb(c.env.DB);
    const status = c.req.query('status'); // open, closed
    const assignedTo = c.req.query('assignedTo');
    const conditions = [];

    if (status) conditions.push(eq(chatRooms.status, status as any));
    if (assignedTo === 'unassigned') conditions.push(sql`${chatRooms.assignedToId} IS NULL`);

    const tickets = await db.select({
        id: chatRooms.id,
        tenantName: tenants.name,
        status: chatRooms.status,
        createdAt: chatRooms.createdAt,
    })
        .from(chatRooms)
        .leftJoin(tenants, eq(chatRooms.tenantId, tenants.id))
        .where(and(...conditions))
        .orderBy(desc(chatRooms.createdAt))
        .all();

    return c.json(tickets);
});

// GET /rooms/:id - Get room details across any tenant
app.get('/rooms/:id', async (c) => {
    const db = createDb(c.env.DB);
    const id = c.req.param('id');
    const room = await db.query.chatRooms.findFirst({
        where: eq(chatRooms.id, id),
        with: { tenant: true }
    });
    if (!room) return c.json({ error: 'Room not found' }, 404);
    return c.json(room);
});

// PATCH /rooms/:id - Update room details across any tenant
app.patch('/rooms/:id', async (c) => {
    const db = createDb(c.env.DB);
    const id = c.req.param('id');
    const body = await c.req.json();
    const updates: any = {};
    if (body.status) updates.status = body.status;
    if (body.assignedToId) updates.assignedToId = body.assignedToId;

    await db.update(chatRooms).set(updates).where(eq(chatRooms.id, id)).run();
    return c.json({ success: true, ...updates });
});

export default app;
