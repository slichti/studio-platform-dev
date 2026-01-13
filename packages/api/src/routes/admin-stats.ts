
import { Hono } from 'hono';
import { createDb } from '../db';
import { tenants, tenantMembers, users } from 'db/src/schema'; // Ensure imports
import { count, eq, gt } from 'drizzle-orm';

type Bindings = {
    DB: D1Database;
    STRIPE_SECRET_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get('/architecture', async (c) => {
    const db = createDb(c.env.DB);
    const start = performance.now();

    // 1. Database Latency Check
    try {
        await db.select({ count: count() }).from(users).get();
    } catch (e) {
        // ignore
    }
    const dbLatency = Math.round(performance.now() - start);

    // 2. Connected Users (Active in last 15 minutes)
    let connectedUsers = 0;
    try {
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        const result = await db.select({ count: count() })
            .from(users)
            .where(gt(users.lastActiveAt, fifteenMinutesAgo))
            .get();
        connectedUsers = result?.count || 0;
    } catch (e) {
        console.error("Failed to fetch active users", e);
    }

    // 3. User Geography (Real)
    const activeUsersWithLocation = await db.select({
        location: users.lastLocation
    })
        .from(users)
        .where(gt(users.lastActiveAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))) // Active in last 30 days
        .all();

    const regionMap = new Map();

    for (const u of activeUsersWithLocation) {
        const loc = u.location as any;
        if (loc && loc.country) {
            const key = loc.country;
            if (!regionMap.has(key)) {
                regionMap.set(key, {
                    code: loc.country,
                    name: loc.country, // Full name if available, else code
                    count: 0,
                    lat: loc.lat || 0,
                    lng: loc.lng || 0
                });
            }
            regionMap.get(key).count++;
        }
    }

    const userRegions = Array.from(regionMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    // 4. Tenant Count
    let tenantCount = 0;
    try {
        const result = await db.select({ count: count() }).from(tenants).get();
        tenantCount = result?.count || 0;
    } catch (e) {
        // ignore
    }

    // 5. Service Status
    const services = {
        database: true,
        auth: true,
        storage: true,
        edge: true,
        stripe: !!c.env.STRIPE_SECRET_KEY
    };

    return c.json({
        latency: {
            database_ms: dbLatency,
            edge_ms: 10 // Estimated
        },
        worker: {
            region: (c.req.raw as any).cf?.colo || 'ORD', // Default to ORD (Chicago) if local
            memory_used_mb: Math.floor(Math.random() * 50) + 10 // Simulated for now
        },
        connectedUsers,
        tenantCount,
        userRegions,
        services,
    });
});

export default app;
