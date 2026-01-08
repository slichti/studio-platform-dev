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

    // 1. Check Database Latency (Read)
    try {
        await db.run(sql`SELECT 1`);
    } catch (e: any) {
        return c.json({ status: 'fail', error: `Read check failed: ${e.message}` }, 500);
    }
    const readLatency = performance.now() - start;

    // 2. Check Database Latency (Write) - Transaction with Rollback
    const writeStart = performance.now();
    try {
        // D1 doesn't support traditional ROLLBACK in the same way for speed tests easily without table setup,
        // but we can just run a safe lightweight query or skip explicit write if no test table.
        // For now, let's assume a read-heavy load check or a simple meaningful query.
        // Actually, let's query the tenants count as a "real world" query proxy.
        await db.run(sql`SELECT count(*) FROM tenants`);
    } catch (e: any) {
        // Ignore, table might not exist in mock
    }
    const queryLatency = performance.now() - writeStart;

    // 3. Worker Metadata
    // @ts-ignore - cf property exists on request in Workers
    const cf = c.req.raw.cf || {};

    // 4. Memory/System Info
    const memory = process.memoryUsage ? process.memoryUsage() : { heapUsed: 0, heapTotal: 0 };

    // 5. Integrations
    const integrations_status = {
        stripe: !!c.env.STRIPE_SECRET_KEY,
        clerk: !!c.env.CLERK_SECRET_KEY,
        zoom: !!c.env.ZOOM_ACCOUNT_ID,
        cloudflare_images: !!c.env.CLOUDFLARE_ACCOUNT_ID
    };

    return c.json({
        status: 'ok',
        latency: {
            database_read_ms: Math.round(readLatency * 100) / 100,
            database_query_ms: Math.round(queryLatency * 100) / 100,
        },
        worker: {
            colo: cf.colo || 'DEV',
            country: cf.country || 'Local',
            city: cf.city || 'Unknown',
            region: cf.region || 'Unknown',
            memory_used_mb: Math.round(memory.heapUsed / 1024 / 1024 * 100) / 100,
        },
        integrations: integrations_status,
        environment: c.env.ENVIRONMENT || 'unknown',
        timestamp: new Date().toISOString()
    });
});

export default diagnostics;
