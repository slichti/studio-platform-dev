import { Hono } from 'hono';
import { createDb } from '../db';
import { scheduledReports, tenants } from '@studio/db/src/schema';
import { eq, and, lte } from 'drizzle-orm';
import { HonoContext } from '../types';
import { ReportService } from '../services/reports';
import { EmailService, TenantEmailConfig } from '../services/email';

const app = new Hono<HonoContext>();

// GET / - List all scheduled reports
app.get('/', async (c) => {
    if (!c.get('can')('view_reports')) return c.json({ error: 'Unauthorized' }, 403);

    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const reports = await db.select().from(scheduledReports)
        .where(eq(scheduledReports.tenantId, tenant.id))
        .all();

    return c.json({ reports });
});

// POST / - Create scheduled report
app.post('/', async (c) => {
    if (!c.get('can')('manage_reports')) return c.json({ error: 'Unauthorized' }, 403);

    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const { reportType, frequency, recipients, customReportId } = await c.req.json();

    if (!reportType || !frequency || !recipients) {
        return c.json({ error: 'Missing required fields' }, 400);
    }

    const id = crypto.randomUUID();
    const now = new Date();

    // Calculate next run time based on frequency
    const nextRun = calculateNextRun(frequency);

    await db.insert(scheduledReports).values({
        id,
        tenantId: tenant.id,
        reportType,
        frequency,
        recipients,
        customReportId: customReportId || null,
        status: 'active',
        lastSent: null,
        nextRun,
        createdAt: now,
        updatedAt: now,
    }).run();

    return c.json({ success: true, id });
});

// PATCH /:id - Update scheduled report
app.patch('/:id', async (c) => {
    if (!c.get('can')('manage_reports')) return c.json({ error: 'Unauthorized' }, 403);

    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const reportId = c.req.param('id');
    const updates = await c.req.json();

    // Recalculate next run if frequency changed
    if (updates.frequency) {
        updates.nextRun = calculateNextRun(updates.frequency);
    }

    await db.update(scheduledReports)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(eq(scheduledReports.id, reportId), eq(scheduledReports.tenantId, tenant.id)))
        .run();

    return c.json({ success: true });
});

// DELETE /:id - Delete scheduled report
app.delete('/:id', async (c) => {
    if (!c.get('can')('manage_reports')) return c.json({ error: 'Unauthorized' }, 403);

    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const reportId = c.req.param('id');

    await db.delete(scheduledReports)
        .where(and(eq(scheduledReports.id, reportId), eq(scheduledReports.tenantId, tenant.id)))
        .run();

    return c.json({ success: true });
});

// POST /execute - Execute scheduled reports (called by cron)
app.post('/execute', async (c) => {
    const db = createDb(c.env.DB);
    const now = new Date();

    // Find all reports due to run
    const dueReports = await db.select().from(scheduledReports)
        .where(and(
            eq(scheduledReports.status, 'active'),
            lte(scheduledReports.nextRun, now)
        ))
        .all();

    console.log(`[Scheduled Reports] Found ${dueReports.length} reports to execute`);

    for (const report of dueReports) {
        try {
            // Fetch Tenant Details for Email Config
            const tenant = await db.select().from(tenants).where(eq(tenants.id, report.tenantId)).get();
            if (!tenant) {
                console.error(`[Scheduled Reports] Tenant not found for report ${report.id}`);
                continue;
            }

            const reportService = new ReportService(db, report.tenantId);

            // Generate report data based on type
            let reportData;
            const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const endDate = new Date();

            if (report.reportType === 'revenue') {
                reportData = await reportService.getRevenue(startDate, endDate);
            } else if (report.reportType === 'attendance') {
                reportData = await reportService.getAttendance(startDate, endDate);
            } else if (report.reportType === 'custom' && report.customReportId) {
                // TODO: Fetch custom report config and run
                console.warn("[Scheduled Reports] Custom reports not yet fully supported in execution");
            }

            // Generate CSV
            let csvContent = '';
            if (reportData && 'chartData' in reportData) {
                csvContent = reportService.generateCsv(reportData.chartData, ['name', 'value']); // Simplified headers
            }

            // Send Email
            const emailService = new EmailService(c.env.RESEND_API_KEY || '', { branding: tenant.branding as TenantEmailConfig['branding'] }, { name: tenant.name, slug: tenant.slug }, undefined, false, db, tenant.id);
            const subject = `[${tenant.name}] ${report.reportType.charAt(0).toUpperCase() + report.reportType.slice(1)} Report`;
            const html = `
                <h2>${report.reportType.charAt(0).toUpperCase() + report.reportType.slice(1)} Report</h2>
                <p>Attached is your scheduled report for the period <strong>${startDate.toLocaleDateString()}</strong> to <strong>${endDate.toLocaleDateString()}</strong>.</p>
                <p>Frequency: ${report.frequency}</p>
            `;

            const filename = `${report.reportType}_${startDate.toISOString().split('T')[0]}.csv`;
            const attachments = csvContent ? [{ filename, content: Buffer.from(csvContent) }] : [];

            if (attachments.length > 0) {
                for (const recipient of (report.recipients as string[])) {
                    await emailService.sendGenericEmail(recipient, subject, html, true, attachments);
                }
                console.log(`[Scheduled Reports] ✅ Sent report ${report.id} to ${(report.recipients as string[]).length} recipients`);
            } else {
                console.log(`[Scheduled Reports] ⚠️ No data for report ${report.id}, skipping email`);
            }

            // Update last sent and next run
            const nextRun = calculateNextRun(report.frequency);
            await db.update(scheduledReports)
                .set({ lastSent: now, nextRun, updatedAt: now })
                .where(eq(scheduledReports.id, report.id))
                .run();

        } catch (error: any) {
            console.error(`[Scheduled Reports] ❌ Failed to execute report ${report.id}:`, error.message);
        }
    }

    return c.json({ success: true, executed: dueReports.length });
});

// Helper function to calculate next run time
function calculateNextRun(frequency: string): Date {
    const now = new Date();

    if (frequency === 'daily') {
        now.setDate(now.getDate() + 1);
        now.setHours(6, 0, 0, 0); // 6 AM next day
    } else if (frequency === 'weekly') {
        now.setDate(now.getDate() + 7);
        now.setHours(6, 0, 0, 0);
    } else if (frequency === 'monthly') {
        now.setMonth(now.getMonth() + 1);
        now.setDate(1);
        now.setHours(6, 0, 0, 0);
    }

    return now;
}

export default app;
