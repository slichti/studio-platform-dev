import { Hono } from 'hono';
import { createDb } from '../db';
import { scheduledReports, tenants, customReports } from '@studio/db/src/schema';
import { eq, and, lte } from 'drizzle-orm';
import { HonoContext } from '../types';
import { ReportService } from '../services/reports';
import { EmailService, TenantEmailConfig } from '../services/email';
import { requirePermission } from '../middleware/rbac';

const app = new Hono<HonoContext>();

// GET / - List all scheduled reports
app.get('/', requirePermission('view_reports'), async (c) => {
    const db = createDb(c.env.DB);
    const tenant = c.get('tenant');
    if (!tenant) return c.json({ error: 'Tenant context required' }, 400);

    const reports = await db.select().from(scheduledReports)
        .where(eq(scheduledReports.tenantId, tenant.id))
        .all();

    return c.json({ reports });
});

// POST / - Create scheduled report
app.post('/', requirePermission('manage_reports'), async (c) => {
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
app.patch('/:id', requirePermission('manage_reports'), async (c) => {
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
app.delete('/:id', requirePermission('manage_reports'), async (c) => {
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
                const reportRecord = await db.select().from(customReports).where(and(eq(customReports.id, report.customReportId), eq(customReports.tenantId, report.tenantId))).get();
                if (reportRecord) {
                    const config = reportRecord.config as any;
                    reportData = await reportService.query({
                        metrics: config.metrics,
                        dimensions: config.dimensions,
                        filters: { startDate, endDate }
                    });
                }
            }

            // Generate Assets
            let csvContent = '';
            let pdfBuffer: Uint8Array | null = null;
            let metrics: string[] = [];

            if (reportData && 'chartData' in reportData) {
                if (report.reportType === 'custom' && report.customReportId) {
                    const reportRecord = await db.select().from(customReports).where(eq(customReports.id, report.customReportId)).get();
                    metrics = (reportRecord?.config as any)?.metrics || [];
                } else {
                    metrics = [report.reportType === 'revenue' ? 'revenue' : 'attendance'];
                }

                csvContent = reportService.generateCsv(reportData.chartData, metrics);
                pdfBuffer = await reportService.generatePdf(
                    reportData.chartData,
                    metrics,
                    `${report.reportType.toUpperCase()} Report`,
                    `${tenant.name} (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})`
                );
            }

            // Send Email
            const emailService = new EmailService(c.env.RESEND_API_KEY || '', { branding: tenant.branding as TenantEmailConfig['branding'] }, { name: tenant.name, slug: tenant.slug }, undefined, false, db, tenant.id);
            const subject = `[${tenant.name}] ${report.reportType.charAt(0).toUpperCase() + report.reportType.slice(1)} Report`;
            const html = `
                <h2>${report.reportType.charAt(0).toUpperCase() + report.reportType.slice(1)} Report</h2>
                <p>Attached is your scheduled report for the period <strong>${startDate.toLocaleDateString()}</strong> to <strong>${endDate.toLocaleDateString()}</strong>.</p>
                <p>Frequency: ${report.frequency}</p>
            `;

            const filenameCsv = `${report.reportType}_${startDate.toISOString().split('T')[0]}.csv`;
            const filenamePdf = `${report.reportType}_${startDate.toISOString().split('T')[0]}.pdf`;

            const attachments = [];
            if (csvContent) attachments.push({ filename: filenameCsv, content: Buffer.from(csvContent) });
            if (pdfBuffer) attachments.push({ filename: filenamePdf, content: Buffer.from(pdfBuffer) });

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
