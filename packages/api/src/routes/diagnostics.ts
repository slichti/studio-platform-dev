import { Hono } from 'hono';
import { createDb } from '../db';
import { sql } from 'drizzle-orm';
import type { HonoContext } from '../types';

const diagnostics = new Hono<HonoContext>();

// Protected by Auth & Tenant middleware (inherit from mount point or add explicitly if needed)
// Assuming this will be mounted under /tenant or similar, or we can make it standalone /admin/diagnostics

diagnostics.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const start = performance.now();

    // 1. Check Database Latency
    try {
        await db.run(sql`SELECT 1`);
    } catch (e: any) {
        return c.json({
            status: 'fail',
            checks: {
                database: { status: 'fail', error: e.message }
            }
        }, 500);
    }
    const dbLatency = performance.now() - start;

    // 2. Check Environment & Integrations
    const integrations_status = {
        stripe: !!c.env.STRIPE_SECRET_KEY,
        clerk: !!c.env.CLERK_SECRET_KEY,
        zoom: !!c.env.ZOOM_ACCOUNT_ID,
        cloudflare_images: !!c.env.CLOUDFLARE_ACCOUNT_ID
    };

    return c.json({
        status: 'ok',
        latency: {
            database_ms: Math.round(dbLatency * 100) / 100
        },
        integrations: integrations_status,
        environment: c.env.ENVIRONMENT || 'unknown',
        timestamp: new Date().toISOString()
    });
});

export default diagnostics;
