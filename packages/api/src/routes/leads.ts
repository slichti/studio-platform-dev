import { Hono } from 'hono';
import { createDb } from '../db';
import { leads, tasks } from '@studio/db/src/schema';
import { eq, desc, and } from 'drizzle-orm';
import { HonoContext } from '../types';
import { EmailService } from '../services/email';

const app = new Hono<HonoContext>();

// GET /leads - List
app.get('/', async (c) => {
    if (!c.get('can')('manage_marketing')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const list = await db.select().from(leads)
        .where(eq(leads.tenantId, tenant.id))
        .orderBy(desc(leads.createdAt)).all();

    return c.json({ leads: list });
});

// POST /leads - Create
app.post('/', async (c) => {
    if (!c.get('can')('manage_marketing')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const { email, firstName, lastName, phone, source, notes } = await c.req.json();
    if (!email) return c.json({ error: "Email is required" }, 400);

    try {
        const id = crypto.randomUUID();
        await db.insert(leads).values({
            id, tenantId: tenant.id, email, firstName, lastName, phone, source, notes, status: 'new'
        }).run();

        await db.insert(tasks).values({
            id: crypto.randomUUID(), tenantId: tenant.id, title: `Follow up with ${firstName || 'New Lead'}`,
            description: `Auto-lead: ${email}`, status: 'todo', priority: 'medium',
            dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), relatedLeadId: id,
        }).run();

        // 3. Trigger Automation (lead_captured)
        if (c.env.RESEND_API_KEY) {
            c.executionCtx.waitUntil((async () => {
                try {
                    const { UsageService } = await import('../services/pricing');
                    const usageService = new UsageService(db, tenant.id);

                    const emailConfig = {
                        branding: tenant.branding as any,
                        settings: tenant.settings as any
                    };

                    const emailService = new EmailService(
                        c.env.RESEND_API_KEY as string,
                        emailConfig,
                        undefined,
                        undefined,
                        false,
                        db,
                        tenant.id
                    );

                    const { SmsService } = await import('../services/sms');
                    const smsService = new SmsService(
                        tenant.twilioCredentials as any,
                        c.env,
                        usageService,
                        db,
                        tenant.id
                    );

                    const { PushService } = await import('../services/push');
                    const pushService = new PushService(db, tenant.id);

                    const { AutomationsService } = await import('../services/automations');
                    const autoService = new AutomationsService(db, tenant.id, emailService, smsService, pushService);

                    await autoService.dispatchTrigger('lead_captured', {
                        userId: '', // Lead is not a User yet
                        email: email,
                        firstName: firstName,
                        lastName: lastName,
                        phone: phone,
                        data: {
                            source: source,
                            notes: notes
                        }
                    });
                } catch (e) {
                    console.error("[Leads Route] Automation Error", e);
                }
            })());
        }

        return c.json({ success: true, id }, 201);
    } catch (e: any) {
        if (e.message?.includes('UNIQUE')) return c.json({ error: "Lead exists" }, 409);
        return c.json({ error: e.message }, 500);
    }
});

// PATCH /leads/:id
app.patch('/:id', async (c) => {
    if (!c.get('can')('manage_marketing')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);
    const id = c.req.param('id');
    const body = await c.req.json();

    const updateData: any = {};
    ['status', 'notes', 'firstName', 'lastName', 'phone'].forEach(f => { if (body[f] !== undefined) updateData[f] = body[f]; });
    updateData.updatedAt = new Date();

    await db.update(leads).set(updateData).where(and(eq(leads.id, id), eq(leads.tenantId, tenant.id))).run();
    return c.json({ success: true });
});

// POST /leads/:id/convert
app.post('/:id/convert', async (c) => {
    if (!c.get('can')('manage_marketing')) return c.json({ error: 'Unauthorized' }, 403);
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: "Tenant context missing" }, 400);

    const id = c.req.param('id');
    const { memberId } = await c.req.json();
    if (!memberId) return c.json({ error: "Member ID is required to link the lead" }, 400);

    const lead = await db.select().from(leads).where(and(eq(leads.id, id), eq(leads.tenantId, tenant.id))).get();
    if (!lead) return c.json({ error: "Lead not found" }, 404);

    await db.update(leads)
        .set({
            status: 'converted',
            convertedAt: new Date(),
            convertedMemberId: memberId,
            updatedAt: new Date()
        })
        .where(eq(leads.id, id))
        .run();

    return c.json({ success: true });
});

export default app;
