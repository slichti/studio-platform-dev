import { Hono } from 'hono';
import { createDb } from '../db';
import { marketingCampaigns, emailLogs, tenants, tenantMembers, users } from 'db/src/schema'; // Ensure these are exported from schema
import { eq, desc, and } from 'drizzle-orm';

type Bindings = {
    DB: D1Database;
};

type Variables = {
    auth: {
        userId: string;
    };
    tenant: any;
    member?: any;
};

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// GET /campaigns - List campaigns
app.get('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');

    const campaigns = await db.select().from(marketingCampaigns)
        .where(eq(marketingCampaigns.tenantId, tenant.id))
        .orderBy(desc(marketingCampaigns.createdAt))
        .all();

    return c.json({ campaigns });
});

// POST /campaigns - Create and Broadcast
app.post('/', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const body = await c.req.json();
    const { subject, content } = body;

    if (!subject || !content) return c.json({ error: "Subject and Content required" }, 400);

    const campaignId = crypto.randomUUID();

    // 1. Create Campaign (Draft -> Sending)
    await db.insert(marketingCampaigns).values({
        id: campaignId,
        tenantId: tenant.id,
        subject,
        content,
        status: 'sending',
        sentAt: new Date(),
        stats: { sent: 0, failed: 0 }
    });

    // 2. Fetch all unique student emails
    // Strategy: Get all tenantMembers + join users

    const recipients = await db.select({
        email: users.email
    })
        .from(tenantMembers)
        .innerJoin(users, eq(tenantMembers.userId, users.id))
        .where(and(
            eq(tenantMembers.tenantId, tenant.id),
            eq(tenantMembers.status, 'active')
        )).all();

    // 3. "Send" Emails (Create Logs)
    const logs = recipients.map(r => ({
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        campaignId,
        recipientEmail: r.email || "unknown@placeholder.com", // Fallback
        subject,
        status: 'sent', // Simulate success
        sentAt: new Date()
    })).filter(l => l.recipientEmail && l.recipientEmail.includes('@')); // Simple filter

    if (logs.length > 0) {
        // Batch insert (D1 limit is high but safer to batch if thousands. MVP: Assume < 100)
        await db.insert(emailLogs).values(logs as any).run();
    }

    // 4. Update Campaign Stats
    await db.update(marketingCampaigns).set({
        status: 'sent',
        stats: { sent: logs.length, failed: 0 }
    }).where(eq(marketingCampaigns.id, campaignId)).run();

    return c.json({ success: true, count: logs.length });
});

export default app;
