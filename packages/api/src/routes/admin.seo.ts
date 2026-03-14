import { Hono } from 'hono';
import { createDb } from '../db';
import { tenants, platformConfig, auditLogs, platformSeoTopics, tenantSeoContentSettings, reviews, tenantMembers, users } from '@studio/db/src/schema';
import { count, eq, and, sql, desc, like, or, inArray } from 'drizzle-orm';
import type { HonoContext } from '../types';
import { SitemapService } from '../services/sitemap';

const app = new Hono<HonoContext>();

// GET /google-status - Whether Google Business and Indexing APIs are configured (no secrets)
app.get('/google-status', async (c) => {
    const env = c.env as any;
    const gbpConfigured = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
    const indexingConfigured = !!(env.GOOGLE_SERVICE_ACCOUNT_EMAIL && env.GOOGLE_PRIVATE_KEY);
    return c.json({ gbpConfigured, indexingConfigured });
});

// POST /indexing/request - Enqueue a URL for Google Indexing API (platform admin only)
app.post('/indexing/request', async (c) => {
    const auth = c.get('auth');
    if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);
    const isPlatformAdmin = (auth.claims as any)?.isPlatformAdmin === true;
    if (!isPlatformAdmin) return c.json({ error: 'Forbidden' }, 403);

    const body = await c.req.json().catch(() => ({})) as { url?: string };
    const url = typeof body.url === 'string' ? body.url.trim() : '';
    if (!url) return c.json({ error: 'url is required' }, 400);
    try {
        new URL(url);
    } catch {
        return c.json({ error: 'Invalid URL' }, 400);
    }

    const queue = (c.env as any).SEO_INDEXING_QUEUE;
    if (!queue) return c.json({ error: 'Indexing queue not configured' }, 503);
    await queue.send({ url });
    return c.json({ success: true, message: 'URL queued for indexing' });
});

// GET /stats - Global SEO Metrics
app.get('/stats', async (c) => {
    const db = createDb(c.env.DB);

    // 1. Tenants with Indexing Enabled (via seo_config)
    const indexingEnabledRes = await db.select({ count: count() })
        .from(tenants)
        .where(sql`json_extract(${tenants.seoConfig}, '$.indexingEnabled') = true`)
        .get();

    // 2. Tenants with GBP Connected
    const gbpConnectedRes = await db.select({ count: count() })
        .from(tenants)
        .where(sql`${tenants.gbpToken} IS NOT NULL`)
        .get();

    // 3. Sitemap Coverage (Tenants with sitemaps potentially generated - roughly all public tenants)
    const sitemapEligibleRes = await db.select({ count: count() })
        .from(tenants)
        .where(eq(tenants.isPublic, true))
        .get();

    return c.json({
        indexingEnabled: indexingEnabledRes?.count || 0,
        gbpConnected: gbpConnectedRes?.count || 0,
        sitemapEligible: sitemapEligibleRes?.count || 0,
        // Mock queue size if binding not present or inaccessible
        queueBacklog: 0
    });
});

// GET /tenants - Detailed SEO list
app.get('/tenants', async (c) => {
    const db = createDb(c.env.DB);
    const limit = Number(c.req.query('limit')) || 100;

    const list = await db.query.tenants.findMany({
        columns: {
            id: true,
            name: true,
            slug: true,
            isPublic: true,
            seoConfig: true,
            gbpToken: true,
            createdAt: true
        },
        with: {
            seoAutomation: true
        },
        orderBy: (tenants, { desc }) => [desc(tenants.createdAt)],
        limit
    });

    return c.json(list.map(t => ({
        ...t,
        hasGbp: !!t.gbpToken,
        reviewLink: (t.seoConfig as any)?.googleReviewLink ?? (t.settings as any)?.seo?.googleReviewLink ?? null
    })));
});

// GET /config - Global Platform SEO Config
app.get('/config', async (c) => {
    const db = createDb(c.env.DB);
    const config = await db.select().from(platformConfig).where(eq(platformConfig.key, 'platform_seo')).get();

    // Default config if not exists
    if (!config) {
        return c.json({
            titleTemplate: 'Studio Platform | %s',
            metaDescription: 'The all-in-one platform for fitness studios.',
            keywords: 'fitness, studio, management, yoga, dance'
        });
    }

    return c.json(config.value || {});
});

// PATCH /config - Update Global Platform SEO Config
app.patch('/config', async (c) => {
    const db = createDb(c.env.DB);
    const body = await c.req.json();
    const { titleTemplate, metaDescription, keywords } = body;

    await db.insert(platformConfig)
        .values({
            key: 'platform_seo',
            value: { titleTemplate, metaDescription, keywords },
            enabled: true,
            updatedAt: new Date()
        })
        .onConflictDoUpdate({
            target: platformConfig.key,
            set: {
                value: { titleTemplate, metaDescription, keywords },
                updatedAt: new Date()
            }
        })
        .run();

    return c.json({ success: true });
});

// PATCH /tenants/:id/seo - Override Tenant SEO Config
app.patch('/tenants/:id/seo', async (c) => {
    const db = createDb(c.env.DB);
    const tenantId = c.req.param('id');
    const { indexingEnabled, gbpConnected } = await c.req.json();

    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    if (!tenant) return c.json({ error: 'Tenant not found' }, 404);

    const seoConfig = (tenant.seoConfig || {}) as any;
    if (indexingEnabled !== undefined) seoConfig.indexingEnabled = indexingEnabled;

    const updates: any = { seoConfig, updatedAt: new Date() };

    // If gbpConnected is being explicitly set/unset from admin (NAP sync toggle)
    // Note: GBP Token is usually handled via OAuth, but admin can "disconnect" it
    if (gbpConnected === false) {
        updates.gbpToken = null;
    }

    await db.update(tenants)
        .set(updates)
        .where(eq(tenants.id, tenantId))
        .run();

    return c.json({ success: true });
});

// GET /failures - Recent SEO & GBP Failures
app.get('/failures', async (c) => {
    const db = createDb(c.env.DB);
    const failures = await db.select()
        .from(auditLogs)
        .where(
            or(
                like(auditLogs.action, '%indexing_failed%'),
                like(auditLogs.action, '%gbp_sync_failed%'),
                like(auditLogs.action, '%sitemap_error%')
            )
        )
        .orderBy(desc(auditLogs.createdAt))
        .limit(20)
        .all();

    return c.json(failures);
});

// POST /health/validate - Trigger global sitemap validation
app.get('/health/validate', async (c) => {
    const db = createDb(c.env.DB);
    const publicTenants = await db.select({ slug: tenants.slug }).from(tenants).where(eq(tenants.isPublic, true)).limit(10).all();

    // We'll validate a sample of 10 for the quick health check
    const baseUrl = new URL(c.req.url).origin;
    const results = await Promise.all(publicTenants.map(async (t) => {
        const isValid = await SitemapService.validateSitemap(t.slug, baseUrl);
        return { slug: t.slug, isValid };
    }));

    const validCount = results.filter(r => r.isValid).length;
    const healthScore = publicTenants.length > 0 ? (validCount / publicTenants.length) * 100 : 100;

    return c.json({
        healthScore,
        totalChecked: publicTenants.length,
        validCount,
        details: results
    });
});

// POST /rebuild - Trigger global sitemap/cache rebuild
// GET /topics - Global SEO Topics
app.get('/topics', async (c) => {
    const db = createDb(c.env.DB);
    const list = await db.select().from(platformSeoTopics).orderBy(desc(platformSeoTopics.createdAt)).all();
    return c.json(list);
});

// POST /topics - Create SEO Topic
app.post('/topics', async (c) => {
    const db = createDb(c.env.DB);
    const { name, description } = await c.req.json();
    const id = crypto.randomUUID();
    await db.insert(platformSeoTopics).values({ id, name, description, isActive: true }).run();
    return c.json({ id });
});

// PATCH /topics/:id - Update SEO Topic
app.patch('/topics/:id', async (c) => {
    const db = createDb(c.env.DB);
    const id = c.req.param('id');
    const body = await c.req.json();
    await db.update(platformSeoTopics).set(body).where(eq(platformSeoTopics.id, id)).run();
    return c.json({ success: true });
});

// GET /tenants/:id/reviews - List reviews for a tenant (platform admin)
app.get('/tenants/:id/reviews', async (c) => {
    const auth = c.get('auth');
    if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);
    if ((auth.claims as any)?.isPlatformAdmin !== true) return c.json({ error: 'Forbidden' }, 403);
    const db = createDb(c.env.DB);
    const tenantId = c.req.param('id');
    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    if (!tenant) return c.json({ error: 'Tenant not found' }, 404);
    const list = await db.select({
        id: reviews.id, rating: reviews.rating, content: reviews.content, isApproved: reviews.isApproved,
        isTestimonial: reviews.isTestimonial, replyDraft: reviews.replyDraft, createdAt: reviews.createdAt,
        profile: users.profile,
    })
        .from(reviews)
        .innerJoin(tenantMembers, eq(reviews.memberId, tenantMembers.id))
        .innerJoin(users, eq(tenantMembers.userId, users.id))
        .where(eq(reviews.tenantId, tenantId))
        .orderBy(desc(reviews.createdAt))
        .limit(100)
        .all();
    return c.json(list.map(r => ({ ...r, member: { user: { profile: r.profile } } })));
});

// GET /tenants/:id/review-members - Members for review request (platform admin)
app.get('/tenants/:id/review-members', async (c) => {
    const auth = c.get('auth');
    if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);
    if ((auth.claims as any)?.isPlatformAdmin !== true) return c.json({ error: 'Forbidden' }, 403);
    const db = createDb(c.env.DB);
    const tenantId = c.req.param('id');
    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    if (!tenant) return c.json({ error: 'Tenant not found' }, 404);
    const list = await db.select({
        id: tenantMembers.id,
        email: users.email,
        phone: users.phone,
        profile: users.profile,
    })
        .from(tenantMembers)
        .innerJoin(users, eq(tenantMembers.userId, users.id))
        .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.status, 'active')))
        .limit(500)
        .all();
    const profile = (p: any) => p?.firstName || p?.lastName ? `${p.firstName || ''} ${p.lastName || ''}`.trim() : null;
    return c.json(list.map(m => ({ id: m.id, email: m.email, phone: m.phone, displayName: profile(m.profile) || m.email || 'Member' })));
});

// POST /tenants/:id/send-review-request - Send review request for a tenant (platform admin)
app.post('/tenants/:id/send-review-request', async (c) => {
    const auth = c.get('auth');
    if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);
    if ((auth.claims as any)?.isPlatformAdmin !== true) return c.json({ error: 'Forbidden' }, 403);
    const db = createDb(c.env.DB);
    const tenantId = c.req.param('id');
    const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get();
    if (!tenant) return c.json({ error: 'Tenant not found' }, 404);
    const seoConfig = (tenant.seoConfig || {}) as any;
    const settings = (tenant.settings || {}) as any;
    const reviewLink = seoConfig?.googleReviewLink ?? settings?.seo?.googleReviewLink;
    if (!reviewLink || typeof reviewLink !== 'string' || !reviewLink.trim()) {
        return c.json({ error: 'Google Review link not set for this tenant.' }, 400);
    }
    const body = await c.req.json().catch(() => ({})) as { memberIds?: string[]; channel?: 'email' | 'sms' | 'both' };
    const memberIds = Array.isArray(body.memberIds) ? body.memberIds.filter((id: any): id is string => typeof id === 'string') : [];
    const channel = body.channel === 'sms' ? 'sms' : body.channel === 'both' ? 'both' : 'email';
    if (memberIds.length === 0) return c.json({ error: 'memberIds array required' }, 400);

    const members = await db.select({
        id: tenantMembers.id,
        userId: tenantMembers.userId,
        email: users.email,
        phone: users.phone,
    })
        .from(tenantMembers)
        .innerJoin(users, eq(tenantMembers.userId, users.id))
        .where(and(eq(tenantMembers.tenantId, tenantId), inArray(tenantMembers.id, memberIds)))
        .all();

    const studioName = tenant.name || 'Our studio';
    const subject = `Leave us a review – ${studioName}`;
    const html = `<p>Hi there,</p><p>We'd love to hear about your experience! If you have a moment, please leave us a review:</p><p><a href="${reviewLink}" style="color:#6366f1;font-weight:600;">Leave a review</a></p><p>Thank you,<br/>${studioName}</p>`;
    const smsBody = `${studioName}: We'd love your feedback! Leave a review: ${reviewLink}`;

    const { EmailService } = await import('../services/email');
    const { UsageService } = await import('../services/pricing');
    const usageService = new UsageService(db, tenant.id);
    let emailApiKey = (c.env as any).RESEND_API_KEY as string;
    if ((tenant as any).resendCredentials?.apiKey) {
        const { EncryptionUtils } = await import('../utils/encryption');
        const enc = new EncryptionUtils((c.env as any).ENCRYPTION_SECRET);
        emailApiKey = await enc.decrypt((tenant as any).resendCredentials.apiKey);
    }
    const emailService = new EmailService(emailApiKey || '', tenant as any, { slug: tenant.slug, name: tenant.name }, usageService, !!emailApiKey, db, tenant.id);
    const { SmsService } = await import('../services/sms');
    const smsService = new SmsService(tenant.twilioCredentials as any, c.env, usageService, db, tenant.id);

    let sentEmail = 0;
    let sentSms = 0;
    const errors: string[] = [];
    for (const m of members) {
        const email = m.email?.trim();
        const phone = m.phone?.trim();
        if ((channel === 'email' || channel === 'both') && email) {
            try {
                await emailService.sendGenericEmail(email, subject, html, false);
                sentEmail++;
            } catch (e: any) {
                errors.push(`Email ${email}: ${e?.message || 'failed'}`);
            }
        }
        if ((channel === 'sms' || channel === 'both') && phone) {
            try {
                const res = await smsService.sendSms(phone, smsBody, m.id, false);
                if (res.success) sentSms++; else if (res.error) errors.push(`SMS ${phone}: ${res.error}`);
            } catch (e: any) {
                errors.push(`SMS ${phone}: ${e?.message || 'failed'}`);
            }
        }
    }
    return c.json({ success: true, sentEmail, sentSms, errors: errors.length ? errors : undefined });
});

// GET /tenants/:id/automation - Tenant Content Automation Settings
app.get('/tenants/:id/automation', async (c) => {
    const db = createDb(c.env.DB);
    const tenantId = c.req.param('id');
    const settings = await db.select().from(tenantSeoContentSettings).where(eq(tenantSeoContentSettings.tenantId, tenantId)).all();
    return c.json(settings);
});

// PATCH /tenants/:id/automation - Toggle/Update Tenant content automation
app.patch('/tenants/:id/automation', async (c) => {
    const db = createDb(c.env.DB);
    const tenantId = c.req.param('id');
    const { topicId, frequency, isActive } = await c.req.json();

    const id = crypto.randomUUID();
    await db.insert(tenantSeoContentSettings)
        .values({ id, tenantId, topicId, frequency, isActive, updatedAt: new Date() })
        .onConflictDoUpdate({
            target: [tenantSeoContentSettings.tenantId, tenantSeoContentSettings.topicId],
            set: { frequency, isActive, updatedAt: new Date() }
        })
        .run();

    return c.json({ success: true });
});

export default app;
