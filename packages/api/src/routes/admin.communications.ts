import { Hono } from 'hono';
import { createDb } from '../db';
import { emailLogs, tenants, auditLogs } from '@studio/db/src/schema';
import { eq, sql, desc, or, like, and, isNull, count } from 'drizzle-orm';
import type { HonoContext } from '../types';

const app = new Hono<HonoContext>();

// GET /logs - Detailed Logs with Filtering
app.get('/logs', async (c) => {
    const db = createDb(c.env.DB);
    const { page = '1', limit = '50', tenantId, status, search, type } = c.req.query();

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const filters: any[] = [];

    if (tenantId) filters.push(eq(emailLogs.tenantId, tenantId));
    if (status) filters.push(eq(emailLogs.status, status as any));
    if (search) {
        filters.push(or(
            like(emailLogs.recipientEmail, `%${search}%`),
            like(emailLogs.subject, `%${search}%`)
        ));
    }
    if (type === 'transactional') filters.push(isNull(emailLogs.campaignId));
    else if (type === 'campaign') filters.push(sql`${emailLogs.campaignId} IS NOT NULL`);

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    const [logs, total] = await Promise.all([
        db.select({
            id: emailLogs.id,
            sentAt: emailLogs.sentAt,
            status: emailLogs.status,
            subject: emailLogs.subject,
            recipient: emailLogs.recipientEmail,
            templateId: emailLogs.templateId,
            error: emailLogs.error,
            tenantName: tenants.name,
            campaignId: emailLogs.campaignId
        })
            .from(emailLogs)
            .leftJoin(tenants, eq(emailLogs.tenantId, tenants.id))
            .where(whereClause)
            .orderBy(desc(emailLogs.sentAt))
            .limit(parseInt(limit))
            .offset(offset)
            .all(),
        db.select({ count: count() })
            .from(emailLogs)
            .where(whereClause)
            .get()
    ]);

    return c.json({
        logs,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: total?.count || 0,
            pages: Math.ceil((total?.count || 0) / parseInt(limit))
        }
    });
});

// POST /resend/:id - Resend Email
app.post('/resend/:id', async (c) => {
    const db = createDb(c.env.DB);
    const logId = c.req.param('id');
    const auth = c.get('auth');

    const log = await db.select({
        tenantId: emailLogs.tenantId,
        recipient: emailLogs.recipientEmail
    }).from(emailLogs).where(eq(emailLogs.id, logId)).get();

    if (!log) return c.json({ error: "Log not found" }, 404);

    const tenant = log.tenantId ? await db.query.tenants.findFirst({
        where: eq(tenants.id, log.tenantId)
    }) : null;

    const { EmailService } = await import('../services/email');

    const emailService = new EmailService(
        c.env.RESEND_API_KEY || '',
        tenant ? { branding: tenant.branding as any, settings: tenant.settings as any } : undefined,
        undefined,
        undefined,
        false,
        db,
        log.tenantId || undefined
    );

    const result = await emailService.retryEmail(logId);

    if (result.success) {
        await db.insert(auditLogs).values({
            id: crypto.randomUUID(),
            action: 'resend_email_admin',
            actorId: auth.userId,
            targetId: logId,
            details: { recipient: log.recipient },
            ipAddress: c.req.header('CF-Connecting-IP')
        });
        return c.json({ success: true });
    } else {
        return c.json({ error: result.error }, 500);
    }
});

export default app;
