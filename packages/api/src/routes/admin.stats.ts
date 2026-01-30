import { Hono } from 'hono';
import { createDb } from '../db';
import { emailLogs, smsLogs, tenants, marketingAutomations, auditLogs, users } from '@studio/db/src/schema';
import { eq, sql, desc, count, gt } from 'drizzle-orm';
import type { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// GET /email - Global Email Stats
app.get('/email', async (c) => {
    const db = createDb(c.env.DB);

    const totalResult = await db.select({ count: count() }).from(emailLogs).get();
    const totalSent = totalResult?.count || 0;

    const byTenant = await db.select({
        tenantName: tenants.name,
        slug: tenants.slug,
        count: count(emailLogs.id)
    })
        .from(emailLogs)
        .leftJoin(tenants, eq(emailLogs.tenantId, tenants.id))
        .groupBy(emailLogs.tenantId)
        .orderBy(desc(count(emailLogs.id)))
        .limit(20)
        .all();

    const recentLogs = await db.select({
        id: emailLogs.id,
        subject: emailLogs.subject,
        recipient: emailLogs.recipientEmail,
        sentAt: emailLogs.sentAt,
        tenantName: tenants.name
    })
        .from(emailLogs)
        .leftJoin(tenants, eq(emailLogs.tenantId, tenants.id))
        .orderBy(desc(emailLogs.sentAt))
        .limit(50)
        .all();

    return c.json({ totalSent, byTenant, recentLogs });
});

// GET /communications - Unified Comms Stats
app.get('/communications', async (c) => {
    const db = createDb(c.env.DB);

    const [emailCounts, smsCounts, automationStats, allTenants] = await Promise.all([
        db.select({ tenantId: emailLogs.tenantId, count: count(emailLogs.id) })
            .from(emailLogs)
            .groupBy(emailLogs.tenantId)
            .all(),
        db.select({ tenantId: smsLogs.tenantId, count: count(smsLogs.id) })
            .from(smsLogs)
            .groupBy(smsLogs.tenantId)
            .all(),
        db.select({
            tenantId: marketingAutomations.tenantId,
            type: marketingAutomations.triggerEvent,
            active: marketingAutomations.isEnabled
        })
            .from(marketingAutomations)
            .all(),
        db.select({ id: tenants.id, name: tenants.name, slug: tenants.slug }).from(tenants).where(eq(tenants.status, 'active')).all()
    ]);

    const emailMap = new Map(emailCounts.map(e => [e.tenantId, e.count]));
    const smsMap = new Map(smsCounts.map(s => [s.tenantId, s.count]));

    const automationMap = new Map<string, any[]>();
    for (const auto of automationStats) {
        if (!auto.active) continue;
        const key = auto.tenantId || 'platform';
        const existing = automationMap.get(key) || [];
        existing.push({ type: auto.type, active: auto.active });
        automationMap.set(key, existing);
    }

    const tenantStats = allTenants.map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        emailCount: emailMap.get(t.id) || 0,
        smsCount: smsMap.get(t.id) || 0,
        automations: automationMap.get(t.id) || []
    }));

    const totals = {
        email: tenantStats.reduce((acc, t) => acc + t.emailCount, 0),
        sms: tenantStats.reduce((acc, t) => acc + t.smsCount, 0)
    };

    return c.json({
        totals,
        tenants: tenantStats
            .sort((a, b) => (b.emailCount + b.smsCount) - (a.emailCount + a.smsCount))
    });
});

// GET /architecture - System Architecture Metrics
app.get('/architecture', async (c) => {
    const db = createDb(c.env.DB);
    const start = Date.now();

    await db.select({ count: count() }).from(users).limit(1).get();
    const dbLatency = Date.now() - start;

    const tenantCountRes = await db.select({ count: count() }).from(tenants).where(eq(tenants.status, 'active')).get();

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeUsersRes = await db.select({ count: count(auditLogs.actorId) })
        .from(auditLogs)
        .where(gt(auditLogs.createdAt, oneDayAgo))
        .get();

    const userRegions = [
        { code: 'US', name: 'United States', count: 120 },
        { code: 'EU', name: 'Europe', count: 45 },
        { code: 'AS', name: 'Asia', count: 12 }
    ];

    return c.json({
        tenantCount: tenantCountRes?.count || 0,
        connectedUsers: activeUsersRes?.count || 0,
        latency: {
            database_ms: dbLatency,
            edge_ms: Math.floor(Math.random() * 20) + 10
        },
        userRegions
    });
});

// GET /sms - Global SMS Stats
app.get('/sms', async (c) => {
    const db = createDb(c.env.DB);

    const totalResult = await db.select({ count: count() }).from(smsLogs).get();
    const totalSent = totalResult?.count || 0;

    const byTenant = await db.select({
        tenantName: tenants.name,
        slug: tenants.slug,
        count: count(smsLogs.id)
    })
        .from(smsLogs)
        .leftJoin(tenants, eq(smsLogs.tenantId, tenants.id))
        .groupBy(smsLogs.tenantId)
        .orderBy(desc(count(smsLogs.id)))
        .limit(20)
        .all();

    const recentLogs = await db.select({
        id: smsLogs.id,
        body: smsLogs.body,
        recipient: smsLogs.recipientPhone,
        sentAt: smsLogs.sentAt,
        status: smsLogs.status,
        tenantName: tenants.name
    })
        .from(smsLogs)
        .leftJoin(tenants, eq(smsLogs.tenantId, tenants.id))
        .orderBy(desc(smsLogs.sentAt))
        .limit(50)
        .all();

    return c.json({ totalSent, byTenant, recentLogs });
});

export default app;
