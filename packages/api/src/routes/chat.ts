import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from 'db/src/schema';
import { tenantMiddleware, requireFeature } from '../middleware/tenant';

const app = new Hono<{ Bindings: any; Variables: any }>();

// Apply tenant middleware and require chat feature
app.use('/*', tenantMiddleware);
app.use('/*', requireFeature('chat'));

// --- Chat Rooms ---

// List rooms for tenant (filtered by type optionally)
app.get('/rooms', async (c) => {
    const db = drizzle(c.env.DB, { schema });
    const tenantId = c.get('tenantId');
    const type = c.req.query('type');

    let query = db.query.chatRooms.findMany({
        where: type
            ? and(eq(schema.chatRooms.tenantId, tenantId), eq(schema.chatRooms.type, type as any))
            : eq(schema.chatRooms.tenantId, tenantId),
        orderBy: (rooms: any, { desc }: any) => [desc(rooms.createdAt)],
    });

    const rooms = await query;
    return c.json(rooms);
});

// Get single room
app.get('/rooms/:id', async (c) => {
    const db = drizzle(c.env.DB, { schema });
    const tenantId = c.get('tenantId');
    const id = c.req.param('id');

    const room = await db.query.chatRooms.findFirst({
        where: and(
            eq(schema.chatRooms.id, id),
            eq(schema.chatRooms.tenantId, tenantId)
        ),
    });

    if (!room) {
        return c.json({ error: 'Room not found' }, 404);
    }

    return c.json(room);
});

// Create room
app.post('/rooms', async (c) => {
    const db = drizzle(c.env.DB, { schema });
    const tenantId = c.get('tenantId');
    const body = await c.req.json<{
        type: 'support' | 'class' | 'community' | 'direct';
        name: string;
        metadata?: any;
    }>();

    if (!body.type || !body.name) {
        return c.json({ error: 'type and name are required' }, 400);
    }

    const id = crypto.randomUUID();
    await db.insert(schema.chatRooms).values({
        id,
        tenantId,
        type: body.type,
        name: body.name,
        metadata: body.metadata,
        isArchived: false,
    });

    const created = await db.query.chatRooms.findFirst({
        where: eq(schema.chatRooms.id, id),
    });

    return c.json(created, 201);
});

// Archive/unarchive room
app.post('/rooms/:id/archive', async (c) => {
    const db = drizzle(c.env.DB, { schema });
    const tenantId = c.get('tenantId');
    const id = c.req.param('id');
    const body = await c.req.json<{ isArchived: boolean }>();

    const existing = await db.query.chatRooms.findFirst({
        where: and(
            eq(schema.chatRooms.id, id),
            eq(schema.chatRooms.tenantId, tenantId)
        ),
    });

    if (!existing) {
        return c.json({ error: 'Room not found' }, 404);
    }

    await db.update(schema.chatRooms)
        .set({ isArchived: body.isArchived })
        .where(eq(schema.chatRooms.id, id));

    return c.json({ success: true, isArchived: body.isArchived });
});

// --- Chat Messages (REST fallback for history) ---

// Get message history for a room
app.get('/rooms/:id/messages', async (c) => {
    const db = drizzle(c.env.DB, { schema });
    const tenantId = c.get('tenantId');
    const roomId = c.req.param('id');
    const limit = parseInt(c.req.query('limit') || '50');
    const before = c.req.query('before'); // cursor for pagination

    // Verify room ownership
    const room = await db.query.chatRooms.findFirst({
        where: and(
            eq(schema.chatRooms.id, roomId),
            eq(schema.chatRooms.tenantId, tenantId)
        ),
    });

    if (!room) {
        return c.json({ error: 'Room not found' }, 404);
    }

    const messages = await db.query.chatMessages.findMany({
        where: eq(schema.chatMessages.roomId, roomId),
        orderBy: (messages: any, { desc }: any) => [desc(messages.createdAt)],
        limit: Math.min(limit, 100),
        with: {
            user: {
                columns: {
                    id: true,
                    email: true,
                    profile: true,
                },
            },
        },
    });

    return c.json(messages.reverse()); // Return in chronological order
});

// Post message (REST fallback, primarily use WebSocket)
app.post('/rooms/:id/messages', async (c) => {
    const db = drizzle(c.env.DB, { schema });
    const tenantId = c.get('tenantId');
    const roomId = c.req.param('id');
    const userId = c.get('userId');
    const body = await c.req.json<{ content: string }>();

    if (!body.content?.trim()) {
        return c.json({ error: 'content is required' }, 400);
    }

    // Verify room ownership
    const room = await db.query.chatRooms.findFirst({
        where: and(
            eq(schema.chatRooms.id, roomId),
            eq(schema.chatRooms.tenantId, tenantId)
        ),
    });

    if (!room) {
        return c.json({ error: 'Room not found' }, 404);
    }

    const id = crypto.randomUUID();
    await db.insert(schema.chatMessages).values({
        id,
        roomId,
        userId,
        content: body.content.trim(),
    });

    const created = await db.query.chatMessages.findFirst({
        where: eq(schema.chatMessages.id, id),
        with: {
            user: {
                columns: {
                    id: true,
                    email: true,
                    profile: true,
                },
            },
        },
    });

    // TODO: Broadcast to Durable Object WebSocket connections

    return c.json(created, 201);
});

// --- WebSocket Upgrade (Durable Object) ---
// This endpoint will be implemented with Durable Objects in Phase 6
app.get('/rooms/:id/websocket', async (c) => {
    // Placeholder - Will connect to Durable Object
    return c.json({
        message: 'WebSocket endpoint - coming in Phase 6',
        roomId: c.req.param('id'),
    });
});

export default app;
