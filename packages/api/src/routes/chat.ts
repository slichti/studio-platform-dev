import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '@studio/db/src/schema';
import { EmailService } from '../services/email';
import { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// GET /rooms
app.get('/rooms', async (c) => {
    const db = drizzle(c.env.DB, { schema });
    const tenantId = c.get('tenant')!.id;
    const type = c.req.query('type');
    const routedRole = c.req.query('routedRole');

    let list = await db.query.chatRooms.findMany({ where: type ? and(eq(schema.chatRooms.tenantId, tenantId), eq(schema.chatRooms.type, type as any)) : eq(schema.chatRooms.tenantId, tenantId), orderBy: [desc(schema.chatRooms.createdAt)] });

    // Filter by routedRole if not manage_marketing/manage_tenant
    if (!c.get('can')('manage_marketing') && !c.get('can')('manage_tenant')) {
        const myRoles = c.get('member')?.roles.map((r: any) => r.role) || [];
        list = list.filter((r: any) => !r.metadata?.routedRole || myRoles.includes(r.metadata.routedRole));
    }
    if (routedRole) list = list.filter((r: any) => r.metadata?.routedRole === routedRole);

    return c.json(list);
});

// POST /rooms
app.post('/rooms', async (c) => {
    const db = drizzle(c.env.DB, { schema });
    const tenant = c.get('tenant')!;
    const { type, name, metadata, priority, customer_email, routedRole } = await c.req.json();
    if (!type || !name) return c.json({ error: 'Required fields' }, 400);

    const id = crypto.randomUUID();
    const meta = { ...metadata, ...(routedRole ? { routedRole } : {}) };
    await db.insert(schema.chatRooms).values({ id, tenantId: tenant.id, type, name, metadata: Object.keys(meta).length ? meta : null, priority: priority || 'normal', customerEmail: customer_email, isArchived: false }).run();

    if (type === 'support') {
        const notify = (tenant.settings as any)?.chatConfig?.offlineEmail || (tenant.settings as any)?.notifications?.adminEmail;
        if (notify && c.env.RESEND_API_KEY) {
            try {
                const es = new EmailService(c.env.RESEND_API_KEY, { branding: tenant.branding as any, settings: tenant.settings as any }, { slug: tenant.slug });
                await es.sendGenericEmail(notify, `New Support: ${name}`, `<p>Request from ${name}. <a href="/studio/${tenant.slug}/chat/${id}">View</a></p>`, true);
            } catch (e) { console.error(e); }
        }
    }
    return c.json({ id }, 201);
});

// PATCH /rooms/:id
app.patch('/rooms/:id', async (c) => {
    if (!c.get('can')('manage_marketing') && !c.get('can')('manage_tenant')) return c.json({ error: 'Unauthorized' }, 403);
    const db = drizzle(c.env.DB, { schema });
    const body = await c.req.json();
    const up: any = {};
    if (body.status) up.status = body.status;
    if (body.priority) up.priority = body.priority;
    if (body.assignedToId !== undefined) up.assignedToId = body.assignedToId;
    if (body.isArchived !== undefined) { up.isArchived = body.isArchived; if (body.isArchived) up.status = 'closed'; }

    await db.update(schema.chatRooms).set(up).where(and(eq(schema.chatRooms.id, c.req.param('id')), eq(schema.chatRooms.tenantId, c.get('tenant')!.id))).run();
    return c.json({ success: true });
});

// GET /rooms/:id/messages
app.get('/rooms/:id/messages', async (c) => {
    const db = drizzle(c.env.DB, { schema });
    return c.json((await db.query.chatMessages.findMany({ where: eq(schema.chatMessages.roomId, c.req.param('id')), orderBy: [desc(schema.chatMessages.createdAt)], limit: 50, with: { user: { columns: { id: true, email: true, profile: true } } } })).reverse());
});

// POST /rooms/:id/websocket
app.get('/rooms/:id/websocket', async (c) => {
    if (c.req.header('Upgrade') !== 'websocket') return c.json({ error: 'WS expected' }, 426);
    const url = new URL(c.req.url);
    url.searchParams.set('roomId', c.req.param('id'));
    url.searchParams.set('tenantId', c.get('tenant')!.id);
    url.searchParams.set('userId', c.get('auth')!.userId);
    url.searchParams.set('role', c.get('member')?.roles[0]?.role || 'student');
    return c.env.CHAT_ROOM.get(c.env.CHAT_ROOM.idFromString(c.req.param('id'))).fetch(url.toString(), c.req.raw);
});

export default app;
