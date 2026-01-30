import { Hono } from 'hono';
import { createDb } from '../db';
import { platformConfig, auditLogs } from '@studio/db/src/schema';
import { eq } from 'drizzle-orm';
import type { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// GET / - List all platform config keys
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const config = await db.select().from(platformConfig).all();
    return c.json(config);
});

// PUT /:key - Upsert platform config
app.put('/:key', async (c) => {
    const db = createDb(c.env.DB);
    const key = c.req.param('key');
    const { enabled, value, description } = await c.req.json();
    const auth = c.get('auth');

    await db.insert(platformConfig).values({
        key,
        enabled: !!enabled,
        value: value,
        description: description || '',
        updatedAt: new Date()
    }).onConflictDoUpdate({
        target: [platformConfig.key],
        set: {
            enabled: !!enabled,
            value: value,
            description: description || '',
            updatedAt: new Date()
        }
    }).run();

    await db.insert(auditLogs).values({
        id: crypto.randomUUID(),
        action: 'update_platform_config',
        actorId: auth.userId,
        targetId: key,
        details: { key, enabled, value },
        ipAddress: c.req.header('CF-Connecting-IP')
    });

    return c.json({ success: true });
});

export default app;
