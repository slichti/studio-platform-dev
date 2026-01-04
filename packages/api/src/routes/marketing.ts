import { Hono } from 'hono';
import { createDb } from '../db';
import { marketingCampaigns, emailLogs, tenants, tenantMembers, users } from 'db/src/schema'; // Ensure these are exported from schema
import { eq, desc, and } from 'drizzle-orm';
import { UsageService } from '../services/pricing';

type Bindings = {
    DB: D1Database;
    RESEND_API_KEY: string;
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
    const { subject, content, filters } = body;

    if (!subject || !content) return c.json({ error: "Subject and Content required" }, 400);

    const usageService = new UsageService(db, tenant.id);
    const usage = await usageService.getUsage();

    // 1. Check Quota (Estimate if we have enough for all recipients)
    // We'll perform the detailed check after filtering.

    const campaignId = crypto.randomUUID();

    // 1. Create Campaign (Draft -> Sending)
    await db.insert(marketingCampaigns).values({
        id: campaignId,
        tenantId: tenant.id,
        subject,
        content,
        status: 'sending',
        sentAt: new Date(),
        stats: { sent: 0, failed: 0 },
        filters
    });

    const recipientsQuery = db.select({
        email: users.email,
        dob: users.dob
    })
        .from(tenantMembers)
        .innerJoin(users, eq(tenantMembers.userId, users.id))
        .where(and(
            eq(tenantMembers.tenantId, tenant.id),
            eq(tenantMembers.status, 'active')
        ));

    let allRecipients = await recipientsQuery.all();

    // 2. Apply Filters in JS for flexibility (e.g. age-based logic)
    const activeFilters = filters || {}; // { ageMin, ageMax, targetParents }
    let recipients = allRecipients;

    if (activeFilters.ageMin || activeFilters.ageMax) {
        const now = new Date();
        recipients = recipients.filter(r => {
            if (!r.dob) return false;
            const dob = new Date(r.dob);
            let age = now.getFullYear() - dob.getFullYear();
            const m = now.getMonth() - dob.getMonth();
            if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
                age--;
            }
            const min = activeFilters.ageMin || 0;
            const max = activeFilters.ageMax || 150;
            return age >= min && age <= max;
        });
    }

    // Optional: Logic for "Parents" (requires joining userRelationships)
    // If we wanted to target parents of little children...
    if (activeFilters.targetType === 'parents_of_minors') {
        const { userRelationships } = await import('db/src/schema');
        const relations = await db.select().from(userRelationships).all();
        const parentIdsWithMinors = new Set(relations
            .filter(rel => rel.type === 'parent_child') // assuming childUserId is minor, or check profile
            .map(rel => rel.parentUserId)
        );

        // This requires re-fetching or joining in SQL. 
        // For now, let's keep it simple with age filtering of the students themselves.
    }

    // 2.5 Check remaining email quota
    const remaining = usage.emailLimit - usage.emailUsage;
    if (recipients.length > remaining) {
        return c.json({
            error: "Quota exceeded",
            message: `Your remaining quota is ${remaining} emails, but you're trying to send to ${recipients.length} recipients.`,
            recipientsCount: recipients.length,
            remainingQuota: remaining
        }, 403);
    }

    // 3. "Send" Emails (Create Logs)
    const { EmailService } = await import('../services/email');
    const emailService = new EmailService(c.env.RESEND_API_KEY, {
        branding: tenant.branding as any,
        settings: tenant.settings as any
    });

    const logs: any[] = [];
    const errors: any[] = [];

    // Send in batches to avoid overwhelming Resend or the Worker (though Resend handles high volume well)
    // For MVP, simplistic loop with Promise.all for speed, or sequential for safety?
    // Let's do sequential or small batches for now to be safe.
    for (const r of recipients) {
        if (!r.email) continue;
        try {
            await emailService.sendGenericEmail(
                r.email,
                subject,
                content, // Content is plain text for now, wrapHtml will handle basic container
                true // isNotification/Broadcast
            );

            logs.push({
                id: crypto.randomUUID(),
                tenantId: tenant.id,
                campaignId,
                recipientEmail: r.email,
                subject,
                status: 'sent',
                sentAt: new Date()
            });
        } catch (e: any) {
            console.error(`Failed to send to ${r.email}`, e);
            errors.push({ email: r.email, error: e.message });
        }
    }

    if (logs.length > 0) {
        await db.insert(emailLogs).values(logs as any).run();
    }

    // 4. Update Campaign Stats
    await db.update(marketingCampaigns).set({
        status: logs.length > 0 ? 'sent' : 'failed',
        stats: { sent: logs.length, failed: errors.length }
    }).where(eq(marketingCampaigns.id, campaignId)).run();

    // 5. Increment Usage
    await usageService.incrementUsage('email', logs.length);

    return c.json({ success: true, count: logs.length });
});

export default app;
