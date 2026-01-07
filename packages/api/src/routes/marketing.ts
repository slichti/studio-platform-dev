import { Hono } from 'hono';
import { createDb } from '../db';
import { marketingCampaigns, marketingAutomations, emailLogs, tenants, tenantMembers, users, userRelationships } from 'db/src/schema'; // Ensure these are exported from schema
import { eq, desc, and } from 'drizzle-orm';
import { UsageService } from '../services/pricing';
import { EmailService } from '../services/email';
import { isFeatureEnabled } from '../utils/features';
import { AutomationsService } from '../services/automations';

type Bindings = {
    DB: D1Database;
    RESEND_API_KEY: string;
    GEMINI_API_KEY: string;
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

// --- Automations ---

// GET /automations
app.get('/automations', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');

    const existing = await db.select().from(marketingAutomations)
        .where(eq(marketingAutomations.tenantId, tenant.id))
        .all();

    const defaults = [
        { type: 'new_student', subject: `Welcome to ${tenant.name}!`, content: "Welcome to the studio! We're excited to have you.", timingType: 'immediate', timingValue: 0 },
        { type: 'birthday', subject: `Happy Birthday from ${tenant.name}!`, content: "Wishing you a fantastic birthday!", timingType: 'immediate', timingValue: 0 },
        { type: 'absent', subject: `We miss you at ${tenant.name}`, content: "It's been a while! Come back and join us for a class.", timingType: 'delay', timingValue: 720 }, // 30 days
        { type: 'trial_ending', subject: `Your Trial at ${tenant.name} is ending soon`, content: "Hope you're enjoying your trial! It ends in 2 days. Sign up for a membership to keep your momentum going.", timingType: 'before', timingValue: 48 }, // 2 days before
        { type: 'subscription_renewing', subject: `Subscription Renewal`, content: "Your subscription is set to renew tomorrow.", timingType: 'before', timingValue: 24 }
    ];

    const missing = defaults.filter(d => !existing.find(e => e.triggerEvent === d.type));

    if (missing.length > 0) {
        try {
            // Create defaults
            for (const def of missing) {
                console.log(`Seeding automation: ${def.type}`);
                const [newAuto] = await db.insert(marketingAutomations).values({
                    id: crypto.randomUUID(),
                    tenantId: tenant.id,
                    triggerEvent: def.type,
                    subject: def.subject,
                    content: def.content,
                    isEnabled: false,
                    timingType: def.timingType as any,
                    timingValue: def.timingValue || 0,
                    channels: ['email'],
                    couponConfig: null
                }).returning();
                existing.push(newAuto);
            }
        } catch (err) {
            console.error("Failed to seed default automations:", err);
            // Swallowed to ensure listing still works
        }
    }

    return c.json({ automations: existing });
});

// POST /automations - Create new
app.post('/automations', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const { triggerEvent, subject, content } = await c.req.json();

    const [newAuto] = await db.insert(marketingAutomations).values({
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        triggerEvent: triggerEvent || 'new_student',
        subject: subject || 'New Automation',
        content: content || '',
        isEnabled: false,
        timingType: 'immediate',
        timingValue: 0,
        channels: ['email'],
        couponConfig: null
    }).returning();

    return c.json(newAuto);
});

// PATCH /automations/:id
app.patch('/automations/:id', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const id = c.req.param('id');
    const body = await c.req.json();

    const allowed = ['subject', 'content', 'isEnabled', 'timingType', 'timingValue', 'triggerEvent', 'triggerCondition', 'channels', 'couponConfig'];
    const updateData: any = {};
    for (const k of allowed) {
        if (body[k] !== undefined) updateData[k] = body[k];
    }

    // Sanitize coupon config
    if (body.couponConfig) {
        if (!body.couponConfig.enabled && body.couponConfig.enabled !== undefined) {
            // If expressly disabled, nullify? Or just save state?
            // UI might send { enabled: false ... }.
            // Let's verify schema. DB schema adds JSON.
            updateData.couponConfig = body.couponConfig;
        } else {
            updateData.couponConfig = body.couponConfig;
        }
    }

    updateData.updatedAt = new Date();

    const [updated] = await db.update(marketingAutomations)
        .set(updateData)
        .where(and(eq(marketingAutomations.id, id), eq(marketingAutomations.tenantId, tenant.id)))
        .returning();

    return c.json(updated);
});

// POST /automations/:id/test
app.post('/automations/:id/test', async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    const id = c.req.param('id');
    const { email } = await c.req.json(); // Test recipient

    if (!email) return c.json({ error: "Email required" }, 400);

    const [automation] = await db.select().from(marketingAutomations)
        .where(and(eq(marketingAutomations.id, id), eq(marketingAutomations.tenantId, tenant.id)))
        .all();

    if (!automation) return c.json({ error: "Automation not found" }, 404);

    const emailService = new EmailService(c.env.RESEND_API_KEY, {
        branding: tenant.branding as any,
        settings: tenant.settings as any
    });

    try {
        await emailService.sendGenericEmail(
            email,
            "[TEST] " + automation.subject,
            automation.content,
            true
        );
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /content/generate - AI Content Assistant
app.post('/content/generate', async (c) => {
    const tenant = c.get('tenant');
    if (!isFeatureEnabled(tenant, 'ai_content')) {
        return c.json({ error: "AI Content feature not enabled" }, 403);
    }

    const { prompt, type } = await c.req.json();
    if (!prompt) return c.json({ error: "Prompt required" }, 400);

    const apiKey = c.env.GEMINI_API_KEY;
    if (!apiKey) return c.json({ error: "AI Config missing" }, 500);

    try {
        const systemPrompt = `You are a helpful assistant for a boutique fitness studio called "${tenant.name}". 
        Write ${type || 'email'} content. Be professional, encouraging, and concise.`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    role: 'user',
                    parts: [{ text: `${systemPrompt}\n\nTask: ${prompt}` }]
                }]
            })
        });

        const data: any = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

        return c.json({ text });
    } catch (e: any) {
        return c.json({ error: "AI Generation failed: " + e.message }, 500);
    }


});

// Debug Endpoint: Trigger Automations Now
app.post('/automations/trigger-debug', async (c) => {
    const tenant = c.get('tenant');

    // EmailService imported at top
    const emailService = new EmailService(c.env.RESEND_API_KEY, {
        branding: tenant.branding,
        settings: tenant.settings
    });

    const service = new AutomationsService(createDb(c.env.DB), tenant.id, emailService);

    await service.processTimeBasedAutomations();

    return c.json({ success: true, message: "Triggered automations check" });
});

export default app;
