import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from 'db/src/schema';
import { authMiddleware } from '../middleware/auth';
import { tenantMiddleware, requireFeature } from '../middleware/tenant';
import { EmailService } from '../services/email';

const app = new Hono<{ Bindings: any; Variables: any }>();

// Apply auth & tenant middleware
// Note: Guest tokens (from /guest/token) are validated by authMiddleware
app.use('/*', authMiddleware);
app.use('/*', tenantMiddleware);
app.use('/*', requireFeature('chat'));

// --- Chat Rooms ---

// List rooms for tenant (filtered by type optionally)
app.get('/rooms', async (c) => {
    const db = drizzle(c.env.DB, { schema });
    const tenant = c.get('tenant');
    const tenantId = tenant?.id;
    if (!tenantId) return c.json({ error: 'Tenant context missing' }, 500);
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
    const tenant = c.get('tenant');
    const tenantId = tenant?.id;
    if (!tenantId) return c.json({ error: 'Tenant context missing' }, 500);
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
    const tenant = c.get('tenant');
    const tenantId = tenant?.id;
    if (!tenantId) return c.json({ error: 'Tenant context missing' }, 500);
    const body = await c.req.json<{
        type: 'support' | 'class' | 'community' | 'direct';
        name: string;
        metadata?: any;
        priority?: 'low' | 'normal' | 'high' | 'urgent';
        customer_email?: string;
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
        priority: body.priority || 'normal',
        customerEmail: body.customer_email,
        isArchived: false,
    });

    const created = await db.query.chatRooms.findFirst({
        where: eq(schema.chatRooms.id, id),
    });

    // Send Notification for Support Tickets
    if (body.type === 'support') {
        // Construct notification email
        const notifyEmail = tenant.settings?.chatConfig?.offlineEmail || tenant.settings?.notifications?.adminEmail;

        if (notifyEmail) {
            const apiKey = c.get('emailApiKey') || c.env.RESEND_API_KEY;
            // Ensure we catch email errors so we don't fail the request
            try {
                const emailService = new EmailService(apiKey, tenant, { slug: tenant.slug, customDomain: tenant.customDomain });
                await emailService.sendGenericEmail(
                    notifyEmail,
                    `New Support Request: ${body.name}`,
                    `<p>You have a new support request from <strong>${body.name}</strong> (${body.customer_email || 'Anonymous'}).</p>
                     <p>${body.metadata?.initialMessage ? `"${body.metadata.initialMessage}"` : ''}</p>
                     <p><a href="https://studio-platform-web.pages.dev/studio/${tenant.slug}/chat/${id}">View in Studio</a></p>`,
                    true
                );
            } catch (e) {
                console.error("Failed to send support notification", e);
            }
        }
    }

    return c.json(created, 201);
});

// Archive/unarchive room or update status/priority/assignment
app.patch('/rooms/:id', async (c) => {
    const db = drizzle(c.env.DB, { schema });
    const tenant = c.get('tenant');
    const tenantId = tenant?.id;
    if (!tenantId) return c.json({ error: 'Tenant context missing' }, 500);
    const id = c.req.param('id');
    const body = await c.req.json<{
        status?: 'open' | 'in_progress' | 'closed' | 'archived';
        priority?: 'low' | 'normal' | 'high' | 'urgent';
        assignedToId?: string | null;
        isArchived?: boolean; // Legacy support
    }>();

    const existing = await db.query.chatRooms.findFirst({
        where: and(
            eq(schema.chatRooms.id, id),
            eq(schema.chatRooms.tenantId, tenantId)
        ),
    });

    if (!existing) {
        return c.json({ error: 'Room not found' }, 404);
    }

    const updates: any = {};
    if (body.status) updates.status = body.status;
    if (body.priority) updates.priority = body.priority;
    if (body.assignedToId !== undefined) updates.assignedToId = body.assignedToId;
    if (body.isArchived !== undefined) {
        updates.isArchived = body.isArchived;
        if (body.isArchived) updates.status = 'archived'; // Sync status
    }

    await db.update(schema.chatRooms)
        .set(updates)
        .where(eq(schema.chatRooms.id, id));

    return c.json({ success: true, ...updates });
});

// Legacy POST for archive (Deprecated, forward to PATCH logic if needed or keep for backward compat)
app.post('/rooms/:id/archive', async (c) => {
    // ... logic same as above ...
    // Keeping this for now but it's redundant.
    const db = drizzle(c.env.DB, { schema });
    const tenant = c.get('tenant');
    const tenantId = tenant?.id;
    if (!tenantId) return c.json({ error: 'Tenant context missing' }, 500);
    const id = c.req.param('id');
    const body = await c.req.json<{ isArchived: boolean }>();

    await db.update(schema.chatRooms)
        .set({ isArchived: body.isArchived, status: body.isArchived ? 'archived' : 'open' })
        .where(and(eq(schema.chatRooms.id, id), eq(schema.chatRooms.tenantId, tenantId)));

    return c.json({ success: true, isArchived: body.isArchived });
});

// --- Chat Messages (REST fallback for history) ---

// Get message history for a room
app.get('/rooms/:id/messages', async (c) => {
    const db = drizzle(c.env.DB, { schema });
    const tenant = c.get('tenant');
    const tenantId = tenant?.id;
    if (!tenantId) return c.json({ error: 'Tenant context missing' }, 500);
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
    const tenant = c.get('tenant');
    const tenantId = tenant?.id;
    if (!tenantId) return c.json({ error: 'Tenant context missing' }, 500);
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
    const roomId = c.req.param('id');
    const upgradeHeader = c.req.header('Upgrade');

    if (!upgradeHeader || upgradeHeader !== 'websocket') {
        return c.json({ error: 'Expected Upgrade: websocket' }, 426);
    }

    // Pass user context to Durable Object via query params
    const userId = c.get('userId') || 'anon';
    const userRole = (c.get('roles') || [])[0] || 'student';
    // For now we assume the profile or user object is available on 'auth' or 'member' context
    // The simplified context in this file might need checking.
    // userMiddleware usually sets 'userId' and 'claims'.
    // tenantMiddleware sets 'tenantId'.
    // Let's pass what we have.
    const tenant = c.get('tenant');
    const tenantId = tenant?.id;
    if (!tenantId) return c.json({ error: 'Tenant context missing' }, 500);

    // We need to construct a URL to the DO that includes metadata
    const url = new URL(c.req.url);
    url.searchParams.set('roomId', roomId);
    url.searchParams.set('tenantId', tenantId);
    url.searchParams.set('userId', userId);
    url.searchParams.set('role', userRole);

    // Get the Durable Object stub
    const id = c.env.CHAT_ROOM.idFromString(roomId);
    const stub = c.env.CHAT_ROOM.get(id);

    // Forward the Upgrade request
    return stub.fetch(url.toString(), c.req.raw);
});

export default app;
