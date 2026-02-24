// import { Hono } from 'hono' - Replaced by OpenAPIHono
import { createDb } from './db';
import { tenants, tenantMembers, tenantFeatures, users, classes, bookings, posOrders, purchasedPacks, waiverTemplates, waiverSignatures, tenantRoles, platformConfig, customRoles, memberCustomRoles } from '@studio/db/src/schema';
import { sql, eq, and, count, sum, gte, like, or } from 'drizzle-orm';
import { sign, verify } from 'hono/jwt';
import { EncryptionUtils } from './utils/encryption';
import { UsageService } from './services/pricing';
import { StripeService } from './services/stripe';
import { ExportService } from './services/export';
import { LoggerService } from './services/logger';
import { authMiddleware } from './middleware/auth';
import { optionalAuthMiddleware } from './middleware/optionalAuth';
import { tenantMiddleware } from './middleware/tenant';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { rateLimitMiddleware } from './middleware/rate-limit'; // [NEW]
import { apiKeyMiddleware } from './middleware/apiKey';
import { ALL_PERMISSIONS } from './services/permissions';

// Route Imports
import studioRoutes from './routes/studios';
import classRoutes from './routes/classes';
import courseRoutes from './routes/courses';
import locationRoutes from './routes/locations';
import members from './routes/members';
import memberships from './routes/memberships';
import waivers from './routes/waivers';
import appointments from './routes/appointments';
import payroll from './routes/payroll';
import marketing from './routes/marketing';
import substitutions from './routes/substitutions';
import waitlist from './routes/waitlist';
import subDispatch from './routes/sub-dispatch';
import leads from './routes/leads';
import pos from './routes/pos';
import coupons from './routes/coupons';
import giftCards from './routes/gift-cards';
import bookingRoutes from './routes/bookings';
import admin from './routes/admin';
import onboarding from './routes/onboarding';
import dataImport from './routes/import';
import webhookRoutes from './routes/webhooks';
import uploadRoutes from './routes/uploads';
import userRoutes from './routes/users';
import commerce from './routes/commerce';
import quizzes from './routes/quizzes';
import refunds from './routes/refunds';
import platform from './routes/platform';
import reports from './routes/reports';
import reportsCustom from './routes/reports.custom';
import challenges from './routes/challenges';
import jobs from './routes/jobs';
import video from './routes/video';
import kioskRoutes from './routes/kiosk'; // [NEW] Kiosk
import invitesRouter from './routes/invites'; // [NEW] RBAC
import rolesRoutes from './routes/roles'; // [NEW] RBAC
import videoManagement from './routes/video-management';
import tenantIntegrations from './routes/tenant-integrations';
import diagnosticsRoutes from './routes/diagnostics';
import telemetryRoutes from './routes/telemetry';
import websiteRoutes from './routes/website';
import chatRoutes from './routes/chat';
import platformPagesRoutes from './routes/platform-pages';
import publicAssets from './routes/public-assets';
import guestRoutes from './routes/guest';
import adminStats from './routes/admin-stats'; // [NEW] Import
import adminPlans from './routes/admin.plans'; // [NEW] Import
import analytics from './routes/analytics'; // [NEW] Analytics
import publicRoutes from './routes/public'; // [NEW] Import
import aggregatorRoutes from './routes/aggregators'; // [NEW] Aggregators
import faqRoutes from './routes/faqs'; // [NEW] FAQs
import adminMobile from './routes/admin.mobile'; // [NEW] Admin Mobile
import adminSearch from './routes/admin.search'; // [NEW] Admin Search
import tagsRoutes from './routes/tags'; // [NEW] Tags
import { AppError } from './utils/errors';
import customFieldRoutes from './routes/custom-fields'; // [NEW] Custom Fields
import auditLogRoutes from './routes/audit-logs'; // [NEW] Audit Logs
import inventory from './routes/inventory'; // [NEW] Inventory
import docRoutes from './routes/docs'; // [NEW] Docs
import referrals from './routes/referrals'; // [NEW] Referrals
import tenantWebhooksRouter from './routes/tenant.webhooks';
import progressRoutes from './routes/progress';
import adminBackups from './routes/admin.backups'; // [NEW] Backup Management
import adminOwners from './routes/admin.tenants.owners'; // [NEW] Ownership Management
import adminApiKeys from './routes/admin.api-keys'; // [NEW] API Key Management

import { seoMiddleware } from './middleware/seo';
import sitemapRoute from './routes/sitemap';

import { createOpenAPIApp } from './lib/openapi';
import { Bindings, Variables, StudioVariables } from './types';
import { swaggerUI } from '@hono/swagger-ui';
import { traceMiddleware } from './middleware/trace';
import { sentryMiddleware } from './middleware/sentry';

// ...

const app = createOpenAPIApp()

// ISOLATED GOOGLE OAUTH ROUTES
app.get('/studios/gc-connect', authMiddleware, tenantMiddleware, async (c) => {
  const tenantId = c.req.query('tenantId');
  if (!tenantId) return c.json({ error: 'Tenant ID required' }, 400);

  const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
  if (!isPlatformAdmin && !c.get('can')('manage_tenant')) return c.json({ error: "Forbidden" } as any, 403);

  const clientId = (c.env.GOOGLE_CLIENT_ID as string) || (c.env.ENVIRONMENT === 'test' ? 'mock-google-id' : '');
  const clientSecret = (c.env.GOOGLE_CLIENT_SECRET as string) || (c.env.ENVIRONMENT === 'test' ? 'mock-google-secret' : '');
  const encryptionSecret = (c.env.ENCRYPTION_SECRET as string) || (c.env.ENVIRONMENT === 'test' ? 'test-secret-must-be-32-chars-lng' : '');

  const { GoogleCalendarService } = await import('./services/google-calendar');
  const service = new GoogleCalendarService(clientId, clientSecret, `${new URL(c.req.url).origin}/studios/gc-callback`);
  const state = await sign({ tenantId, userId: c.get('auth')!.userId, exp: Math.floor(Date.now() / 1000) + 600 }, encryptionSecret, 'HS256');
  return c.redirect(service.getAuthUrl(state));
});

app.get('/studios/gc-callback', authMiddleware, tenantMiddleware, async (c) => {
  const { code, state, error } = c.req.query();
  if (error || !code || !state) return c.json({ error: error || 'Missing params' }, 400);

  const encryptionSecret = (c.env.ENCRYPTION_SECRET as string) || (c.env.ENVIRONMENT === 'test' ? 'test-secret-must-be-32-chars-lng' : '');
  const clientId = (c.env.GOOGLE_CLIENT_ID as string) || (c.env.ENVIRONMENT === 'test' ? 'mock-google-id' : '');
  const clientSecret = (c.env.GOOGLE_CLIENT_SECRET as string) || (c.env.ENVIRONMENT === 'test' ? 'mock-google-secret' : '');

  let tenantIdStr: string;
  try {
    const payload = await verify(state, encryptionSecret, 'HS256');
    if (payload.userId !== c.get('auth')?.userId) return c.json({ error: "User mismatch" }, 403);
    tenantIdStr = payload.tenantId as string;
  } catch (e) { return c.json({ error: "Invalid state" }, 400); }

  const { GoogleCalendarService } = await import('./services/google-calendar');
  const service = new GoogleCalendarService(clientId, clientSecret, `${new URL(c.req.url).origin}/studios/gc-callback`);
  const db = createDb(c.env.DB);
  const encryption = new EncryptionUtils(encryptionSecret);

  try {
    const tokens = await service.exchangeCode(code);
    const credentials: any = { accessToken: await encryption.encrypt(tokens.access_token), expiryDate: Date.now() + (tokens.expires_in * 1000) };
    if (tokens.refresh_token) credentials.refreshToken = await encryption.encrypt(tokens.refresh_token);
    await db.update(tenants).set({ googleCalendarCredentials: credentials }).where(eq(tenants.id, tenantIdStr)).run();
    return c.text('Google Calendar connected!');
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// GOOGLE BUSINESS PROFILE OAUTH ROUTES
app.get('/studios/gbp-connect', authMiddleware, tenantMiddleware, async (c) => {
  const tenantId = c.req.query('tenantId');
  if (!tenantId) return c.json({ error: 'Tenant ID required' }, 400);

  const isPlatformAdmin = c.get('auth')?.claims?.isPlatformAdmin === true;
  if (!isPlatformAdmin && !c.get('can')('manage_tenant')) return c.json({ error: "Forbidden" } as any, 403);

  const clientId = (c.env.GOOGLE_CLIENT_ID as string) || (c.env.ENVIRONMENT === 'test' ? 'mock-google-id' : '');
  const clientSecret = (c.env.GOOGLE_CLIENT_SECRET as string) || (c.env.ENVIRONMENT === 'test' ? 'mock-google-secret' : '');
  const encryptionSecret = (c.env.ENCRYPTION_SECRET as string) || (c.env.ENVIRONMENT === 'test' ? 'test-secret-must-be-32-chars-lng' : '');

  const { GoogleBusinessProfileService } = await import('./services/google-business');
  const service = new GoogleBusinessProfileService(clientId, clientSecret, `${new URL(c.req.url).origin}/studios/gbp-callback`);
  const state = await sign({ tenantId, userId: c.get('auth')!.userId, exp: Math.floor(Date.now() / 1000) + 600 }, encryptionSecret, 'HS256');
  return c.redirect(service.getAuthUrl(state));
});

app.get('/studios/gbp-callback', authMiddleware, tenantMiddleware, async (c) => {
  const { code, state, error } = c.req.query();
  if (error || !code || !state) return c.json({ error: error || 'Missing params' }, 400);

  const encryptionSecret = (c.env.ENCRYPTION_SECRET as string) || (c.env.ENVIRONMENT === 'test' ? 'test-secret-must-be-32-chars-lng' : '');
  const clientId = (c.env.GOOGLE_CLIENT_ID as string) || (c.env.ENVIRONMENT === 'test' ? 'mock-google-id' : '');
  const clientSecret = (c.env.GOOGLE_CLIENT_SECRET as string) || (c.env.ENVIRONMENT === 'test' ? 'mock-google-secret' : '');

  let tenantIdStr: string;
  try {
    const payload = await verify(state, encryptionSecret, 'HS256');
    if (payload.userId !== c.get('auth')?.userId) return c.json({ error: "User mismatch" }, 403);
    tenantIdStr = payload.tenantId as string;
  } catch (e) { return c.json({ error: "Invalid state" }, 400); }

  const { GoogleBusinessProfileService } = await import('./services/google-business');
  const service = new GoogleBusinessProfileService(clientId, clientSecret, `${new URL(c.req.url).origin}/studios/gbp-callback`);
  const db = createDb(c.env.DB);
  const encryption = new EncryptionUtils(encryptionSecret);

  try {
    const tokens = await service.exchangeCode(code);
    const gbpToken: any = { accessToken: await encryption.encrypt(tokens.access_token), expiryDate: Date.now() + (tokens.expires_in * 1000) };
    if (tokens.refresh_token) gbpToken.refreshToken = await encryption.encrypt(tokens.refresh_token);

    // Also try to fetch the first account/location if possible, or leave it for later UI selection
    await db.update(tenants).set({ gbpToken }).where(eq(tenants.id, tenantIdStr)).run();
    return c.text('Google Business Profile connected! You can now sync your NAP data.');
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.post('/studios/gbp-sync', authMiddleware, tenantMiddleware, async (c) => {
  const tenant = c.get('tenant');
  if (!c.get('can')('manage_tenant')) return c.json({ error: "Forbidden" }, 403);
  if (!tenant.gbpToken) return c.json({ error: "GBP not connected" }, 400);

  const encryptionSecret = (c.env.ENCRYPTION_SECRET as string) || (c.env.ENVIRONMENT === 'test' ? 'test-secret-must-be-32-chars-lng' : '');
  const encryption = new EncryptionUtils(encryptionSecret);

  const tokenData = tenant.gbpToken as any;
  const accessToken = await encryption.decrypt(tokenData.accessToken);

  const { GoogleBusinessProfileService } = await import('./services/google-business');
  const gbp = new GoogleBusinessProfileService(
    c.env.GOOGLE_CLIENT_ID as string,
    c.env.GOOGLE_CLIENT_SECRET as string,
    ''
  );

  try {
    const branding = (tenant.branding || {}) as any;
    const settings = (tenant.settings || {}) as any;

    // NAP Data from tenant branding
    const napData = {
      storefrontAddress: branding.physicalAddress,
      regularHours: settings.businessHours,
      // ... other fields
    };

    // This would ideally use a stored locationId from onboarding or a selection UI
    if (!tokenData.locationId) return c.json({ error: "No GBP Location selected" }, 400);

    await gbp.updateLocation(accessToken, tokenData.locationId, napData);
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.doc('/doc', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'Studio Platform API',
  },
});

app.get('/docs', swaggerUI({ url: '/doc' }));

app.use('*', traceMiddleware);
app.use('*', sentryMiddleware()); // [NEW] Sentry error tracking
app.use('*', apiKeyMiddleware); // [NEW] Phase 7: API Key Auth
app.use('*', rateLimitMiddleware({ limit: 300, window: 60 })); // [NEW] Global Rate Limit: 300 req/min
app.use('*', logger((str, ...rest) => {
  // Custom logger wrapper could go here, but Hono logger is simple.
  console.log(str);
}));

app.onError((err: any, c) => {
  const logger = c.get('logger');
  const traceId = c.get('traceId') || c.req.header('X-Request-Id') || 'unknown';

  if (logger) {
    logger.error(`Unhandled error: ${err.message}`, { error: err, traceId });
  } else {
    console.error('Global App Error:', err);
  }

  // Handle centralized AppErrors
  if (err instanceof AppError) {
    return c.json(err.toJSON(), err.statusCode as any);
  }

  // Only expose detailed error info in non-production environments
  const isDev = (c.env as any).ENVIRONMENT !== 'production';

  if (isDev) {
    return c.json({
      error: "Internal Application Error",
      message: err.message,
      stack: err.stack,
      cause: err.cause,
      requestId: traceId
    }, 500);
  }

  return c.json({
    error: "Internal Application Error",
    requestId: traceId
  }, 500);
});

app.use('*', cors({
  origin: (origin, c) => {
    // Allow any origin for public assets, guest routes, and public tenant info
    const path = c.req.path;
    if (path.startsWith('/public-assets/') || path.startsWith('/guest/') || path.startsWith('/public/')) {
      return origin || '*';
    }

    if (!origin) return 'https://studio-platform-web.pages.dev';
    if (origin.endsWith('.pages.dev') || origin.endsWith('.slichti.org') || origin.includes('localhost')) {
      return origin;
    }
    return 'https://studio-platform-web.pages.dev';
  },
  allowHeaders: ['Authorization', 'Content-Type', 'X-Tenant-Slug', 'X-Tenant-Id', 'X-Request-Id', 'X-Impersonate-User', 'Stripe-Signature', 'Svix-Id', 'Svix-Timestamp', 'Svix-Signature'],
  allowMethods: ['POST', 'GET', 'OPTIONS', 'DELETE', 'PUT', 'PATCH'],
  exposeHeaders: ['Content-Length', 'X-Request-Id', 'X-MFA-Warning'],
  maxAge: 86400,
}));


app.get('/', (c) => {
  return c.json({ status: 'OK' });
})

app.route('/public', publicRoutes); // [NEW] Mount public routes
app.route('/aggregators', aggregatorRoutes); // [NEW] Aggregator Feeds
app.route('/', sitemapRoute); // [NEW] Global Sitemap

app.get('/public/tenant/:slug', async (c) => {
  const slug = c.req.param('slug');
  const db = createDb(c.env.DB);

  const tenant = await db.select().from(tenants).where(eq(tenants.slug, slug)).get();
  if (!tenant) return c.json({ error: "Tenant not found" }, 404);

  const features = await db.select().from(tenantFeatures)
    .where(and(eq(tenantFeatures.tenantId, tenant.id), eq(tenantFeatures.enabled, true)))
    .all();

  return c.json({
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    branding: tenant.branding,
    features: features.map(f => f.featureKey),
    currency: tenant.currency,
    chatConfig: (tenant.settings as any)?.chatConfig
  });
});

// 1. Global Platform Routes
app.use('/admin/*', authMiddleware);
app.use('/users/*', authMiddleware);
app.use('/onboarding/*', authMiddleware);
app.use('/studios/*', authMiddleware);

// 2. Studio Route Paths (Groups for middleware application)
const studioPaths = [
  '/locations', '/locations/*',
  '/members', '/members/*',
  '/memberships', '/memberships/*',
  '/waivers', '/waivers/*',
  '/appointments', '/appointments/*',
  '/payroll', '/payroll/*',
  '/marketing', '/marketing/*',
  '/substitutions', '/substitutions/*',
  '/leads', '/leads/*',
  '/pos', '/pos/*',
  '/uploads', '/uploads/*',
  '/tenant', '/tenant/*',
  '/classes', '/classes/*',
  '/courses', '/courses/*',
  '/commerce', '/commerce/*',
  '/referrals', '/referrals/*', // [NEW] Referrals
  '/coupons', '/coupons/*',  // [FIX] Added
  '/gift-cards', '/gift-cards/*',
  '/refunds', '/refunds/*',
  '/platform', '/platform/*',
  '/integrations', '/integrations/*',
  '/sub-dispatch', '/sub-dispatch/*',
  '/waitlist', '/waitlist/*',
  '/video-management', '/video-management/*',
  '/bookings', '/bookings/*',
  '/aggregators', '/aggregators/*',
  '/webhooks', '/webhooks/*',
  '/inventory', '/inventory/*',
  '/inventory/suppliers', '/inventory/suppliers/*',
  '/inventory/purchase-orders', '/inventory/purchase-orders/*',
  '/reports', '/reports/*',
  '/analytics', '/analytics/*',
  '/challenges', '/challenges/*',
  '/tasks', '/tasks/*',
  '/video', '/video/*',
  '/chat', '/chat/*',
  '/studios', '/studios/*',
  '/quizzes', '/quizzes/*'
];

const authenticatedPaths = [
  '/locations', '/locations/*',
  '/members', '/members/*',
  '/studios', '/studios/*',
  '/memberships', '/memberships/*',
  '/waivers', '/waivers/*',
  '/appointments', '/appointments/*',
  '/payroll', '/payroll/*',
  '/marketing', '/marketing/*',
  '/substitutions', '/substitutions/*',
  '/leads', '/leads/*',
  '/pos', '/pos/*',
  '/tenant', '/tenant/*',
  '/uploads', '/uploads/*',
  '/referrals', '/referrals/*',
  '/coupons', '/coupons/*',
  '/gift-cards', '/gift-cards/*',
  '/refunds', '/refunds/*',
  '/integrations', '/integrations/*',
  '/sub-dispatch', '/sub-dispatch/*',
  '/waitlist', '/waitlist/*',
  '/video-management', '/video-management/*',
  '/bookings', '/bookings/*',
  '/inventory', '/inventory/*',
  '/reports', '/reports/*',
  '/analytics', '/analytics/*',
  '/challenges', '/challenges/*',
  '/tasks', '/tasks/*',
  '/video', '/video/*',
  '/quizzes', '/quizzes/*',
  '/courses', '/courses/*'
];

const publicStudioPaths = [
  '/classes', '/classes/*',
  '/commerce', '/commerce/*',
  '/chat', '/chat/*',
  '/uploads/tenants/*/images/*', // Allow public images
  '/uploads/tenants/*/branding/*' // Allow public branding (logos)
];

// 3. Apply Middleware

// first, identify the user (Auth)
publicStudioPaths.forEach(path => app.use(path, optionalAuthMiddleware));
authenticatedPaths.forEach(path => {
  // Granular authentication for uploads to allow public GET for assets while requiring auth for POST/Private
  if (path === '/uploads' || path === '/uploads/*') {
    app.use(path, async (c, next) => {
      const isPublicAsset = c.req.method === 'GET' && (
        c.req.path.includes('/branding/') ||
        c.req.path.includes('/images/') ||
        c.req.path.includes('/members/')
      ) && !c.req.path.includes('/waivers/');

      if (isPublicAsset) {
        return optionalAuthMiddleware(c, next);
      }
      return authMiddleware(c, next);
    });
  } else if (path === '/courses' || path === '/courses/*') {
    app.use(path, async (c, next) => {
      // Allow public GET for courses list and single course details
      // But /courses/my-enrollments must be authenticated
      const isPublicCourse = c.req.method === 'GET' && !c.req.path.includes('/my-enrollments');

      if (isPublicCourse) {
        return optionalAuthMiddleware(c, next);
      }
      return authMiddleware(c, next);
    });
  } else {
    app.use(path, authMiddleware);
  }

  // [NEW] Granular Rate Limit for Authenticated Users (Higher limit: 600 req/min)
  // This runs AFTER authMiddleware, so it will use the user ID as the key.
  app.use(path, rateLimitMiddleware({ limit: 600, window: 60 }));
});

// then, establish studio context and member status (Tenant)
studioPaths.forEach(path => app.use(path, tenantMiddleware));

// [HARDENING] Stricter limits for Public Schedules (Mitigate scraping)
const publicSchedulePaths = ['/classes', '/classes/*', '/public/tenant/:slug', '/public/classes/*'];
publicSchedulePaths.forEach(path => {
  // 60 requests per minute for public schedule browsing
  app.use(path, rateLimitMiddleware({ limit: 60, window: 60, keyPrefix: 'public-schedule' }));
  // Add caching for public schedules (1 minute edge cache)
  app.use(path, async (c, next) => {
    await next();
    if (c.res.status === 200 && c.req.method === 'GET') {
      c.header('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=30');
    }
  });
});

// [NEW] Resource-Intensive Route Overrides (Higher Costs)
const expensivePaths = [
  '/reports/export',
  '/payroll/generate',
  '/members/bulk',
  '/import/*',
  '/analytics',
  '/analytics/*'
];

expensivePaths.forEach(path => {
  // These cost 10x a normal request
  app.use(path, rateLimitMiddleware({ limit: 600, window: 60, cost: 10 }));
});

// 4. Infrastructure/Common Studio Logic
// 4. Infrastructure/Common Studio Logic
const studioApp = createOpenAPIApp()

studioApp.notFound((c) => {
  return c.json({
    error: "Studio App 404",
    path: c.req.path,
    method: c.req.method,
    tenant: c.get('tenant')?.slug
  }, 404);
});

// 5. Setup Feature Route sub-apps (will be mounted in next step)
// 5. Setup Feature Route sub-apps (will be mounted in next step)


// 6. Base Studio Logic
// 6. Base Studio Logic
// GET /info
studioApp.get('/info', async (c) => {
  const tenant = c.get('tenant');
  const roles = c.get('roles') || [];
  if (!tenant) return c.json({ error: "No tenant" }, 404);

  const db = createDb(c.env.DB);
  const platformConfigs = await db.select().from(platformConfig).all();
  const globalFeatures = platformConfigs.reduce((acc, curr) => {
    acc[curr.key] = curr.enabled;
    return acc;
  }, {} as Record<string, boolean>);

  // [SECURITY] Filter sensitive settings
  const settings = (tenant.settings || {}) as any;
  const isOwner = roles.includes('owner') || roles.includes('admin');

  // Publicly safe settings
  const safeSettings = {
    ...settings,
    googleTagManagerId: settings.googleTagManagerId,
    // Add other public settings here
  };

  // Only expose Kiosk PIN to owners
  if (!isOwner && safeSettings.kioskPin) {
    delete safeSettings.kioskPin;
  }

  // Check if Kiosk Mode is globally enabled
  const kioskFeature = await db.select().from(tenantFeatures)
    .where(and(eq(tenantFeatures.tenantId, tenant.id), eq(tenantFeatures.featureKey, 'kiosk')))
    .get();

  return c.json({
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    tier: tenant.tier,
    status: tenant.status,
    customDomain: tenant.customDomain,
    isPublic: !!tenant.isPublic,
    settings: safeSettings, // Use filtered settings
    kioskEnabled: !!kioskFeature?.enabled, // Helper flag
    mobileAppConfig: tenant.mobileAppConfig,
    stripeAccountId: tenant.stripeAccountId,
    branding: tenant.branding,
    features: Array.from(c.get('features') || []),
    platformFeatures: globalFeatures
  });
});

studioApp.patch('/settings', async (c) => {
  const tenant = c.get('tenant');
  const roles = c.get('roles') || [];

  // Only Owners/Admins
  if (!roles.includes('owner') && !roles.includes('admin')) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  const db = createDb(c.env.DB);
  const body = await c.req.json();
  const updateData: any = {};
  if (body.name) updateData.name = body.name;

  // Settings Merge Logic
  if (body.settings) {
    updateData.settings = { ...(tenant.settings || {}), ...body.settings };
  }

  // Kiosk PIN Shortcut (can also be passed inside body.settings)
  if (body.kioskPin !== undefined) {
    const currentSettings = (tenant.settings || {}) as any;
    updateData.settings = { ...currentSettings, kioskPin: body.kioskPin };
  }

  if (body.mobileAppConfig) {
    updateData.mobileAppConfig = { ...(tenant.mobileAppConfig || {}), ...body.mobileAppConfig };
  }
  if (body.branding) {
    updateData.branding = { ...(tenant.branding || {}), ...body.branding };
  }
  if (typeof body.isPublic === 'boolean') {
    updateData.isPublic = body.isPublic;
  }

  if (Object.keys(updateData).length === 0) return c.json({ received: true });
  await db.update(tenants).set(updateData).where(eq(tenants.id, tenant.id)).run();
  return c.json({ success: true });
});

studioApp.get('/settings/export', async (c) => {
  const tenant = c.get('tenant');
  const db = createDb(c.env.DB);
  const type = c.req.query('type') as 'subscribers' | 'financials' | 'products' || 'subscribers';
  const roles = c.get('roles') || [];

  // Only Owners/Admins
  if (!roles.includes('owner') && !roles.includes('admin')) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  const svc = new ExportService(db, tenant.id);

  try {
    const { filename, csv } = await svc.generateExport(type);
    c.header('Content-Type', 'text/csv');
    c.header('Content-Disposition', `attachment; filename="${filename}"`);
    return c.body(csv);
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

studioApp.put('/credentials/zoom', async (c) => {
  const tenant = c.get('tenant');
  const db = createDb(c.env.DB);
  const { accountId, clientId, clientSecret } = await c.req.json();
  if (!accountId || !clientId || !clientSecret) return c.json({ error: 'Missing credentials' }, 400);
  await db.update(tenants).set({ zoomCredentials: { accountId, clientId, clientSecret } }).where(eq(tenants.id, tenant.id)).run();
  return c.json({ success: true });
});

studioApp.post('/features', async (c) => {
  const tenant = c.get('tenant');
  const roles = c.get('roles') || [];

  if (!roles.includes('owner') && !roles.includes('admin')) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  const { featureKey, enabled } = await c.req.json();
  // Allowlist of self-service features
  const ALLOWED_FEATURES = ['sms', 'webhooks', 'kiosk', 'classpass', 'gympass', 'progress_tracking', 'inventory'];

  if (!ALLOWED_FEATURES.includes(featureKey)) {
    return c.json({ error: "Feature not available for self-service" }, 400);
  }

  const db = createDb(c.env.DB);

  if (enabled) {
    await db.insert(tenantFeatures)
      .values({
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        featureKey,
        enabled: true
      })
      .onConflictDoUpdate({
        target: [tenantFeatures.tenantId, tenantFeatures.featureKey],
        set: { enabled: true }
      })
      .run();
  } else {
    await db.delete(tenantFeatures)
      .where(and(eq(tenantFeatures.tenantId, tenant.id), eq(tenantFeatures.featureKey, featureKey)))
      .run();
  }

  return c.json({ success: true });
});

studioApp.get('/me', (c) => {
  const member = c.get('member');
  const roles = c.get('roles');

  if (!member) return c.json({ error: "Not a member" }, 401);

  // Flatten the response for the frontend
  const user = member.user || {};
  const profile = member.profile || user.profile || {};

  return c.json({
    id: member.id,
    userId: member.userId,
    firstName: profile.firstName || user.firstName || 'User',
    lastName: profile.lastName || user.lastName || '',
    email: user.email || 'N/A',
    portraitUrl: profile.portraitUrl || user.portraitUrl,
    roles,
    user: {
      ...user,
      isPlatformAdmin: user.isPlatformAdmin === true || (!!user.role && ['owner', 'admin', 'system_admin', 'platform_admin'].includes(user.role))
    }
  });
});

// GET /tenant/me/permissions — effective roles and permission flags (for studio UI / RBAC display)
studioApp.get('/me/permissions', (c) => {
  const member = c.get('member');
  const roles = c.get('roles') || [];
  const can = c.get('can');
  if (!member || !can) return c.json({ error: "Not a member" }, 401);
  const permissions: Record<string, boolean> = {};
  for (const p of ALL_PERMISSIONS) {
    permissions[p] = can(p);
  }
  return c.json({ roles, permissions });
});

studioApp.get('/usage', async (c) => {
  const tenant = c.get('tenant');
  const roles = c.get('roles') || [];
  if (!roles.includes('owner') && !roles.includes('admin')) {
    return c.json({ error: "Unauthorized" }, 403);
  }
  const db = createDb(c.env.DB);
  const usageService = new UsageService(db, tenant.id);
  const usage = await usageService.getUsage();
  return c.json(usage);
});

// GET /tenant/stats — dashboard key metrics (active students, revenue, bookings, today's classes)
studioApp.get('/stats', async (c) => {
  const tenant = c.get('tenant');
  if (!c.get('can')('view_reports') && !c.get('can')('manage_classes')) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  const db = createDb(c.env.DB);
  const { tenantMembers, classes, bookings, waiverTemplates, giftCards, subscriptions } = await import('@studio/db/src/schema');
  const { eq, and, gte, lte, sql, inArray } = await import('drizzle-orm');

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const [
    activeStudentsResult,
    upcomingBookingsResult,
    giftCardResult,
    todayClassList,
    activeSubsResult,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, tenant.id), eq(tenantMembers.status, 'active'))).get(),
    db.select({ count: sql<number>`count(*)` }).from(bookings)
      .innerJoin(classes, eq(bookings.classId, classes.id))
      .where(and(eq(classes.tenantId, tenant.id), eq(bookings.status, 'confirmed'), gte(classes.startTime, now))).get(),
    db.select({ total: sql<number>`coalesce(sum(current_balance), 0)` }).from(giftCards)
      .where(and(eq(giftCards.tenantId, tenant.id), eq(giftCards.status, 'active'))).get(),
    db.select({
      id: classes.id,
      title: classes.title,
      startTime: classes.startTime,
      durationMinutes: classes.durationMinutes,
      capacity: classes.capacity,
      instructorId: classes.instructorId,
    }).from(classes)
      .where(and(eq(classes.tenantId, tenant.id), gte(classes.startTime, startOfDay), lte(classes.startTime, endOfDay)))
      .orderBy(classes.startTime)
      .all(),
    db.select({ count: sql<number>`count(*)` }).from(subscriptions)
      .where(and(eq(subscriptions.tenantId, tenant.id), eq(subscriptions.status, 'active'))).get(),
  ]);

  const activeStudents = activeStudentsResult?.count || 0;
  const upcomingBookings = upcomingBookingsResult?.count || 0;
  const giftCardLiability = giftCardResult?.total || 0;
  const activeSubscriptions = activeSubsResult?.count || 0;

  // Batch confirmed counts for today's classes (avoids N+1 correlated subqueries)
  let todayClasses: Array<{ id: string; title: string; startTime: Date; durationMinutes: number | null; capacity: number | null; confirmedCount: number; occupancyPct: number | null }> = [];
  if (todayClassList.length > 0) {
    const todayIds = todayClassList.map((c: { id: string }) => c.id);
    const countRows = await db.select({
      classId: bookings.classId,
      count: sql<number>`count(*)`,
    }).from(bookings)
      .where(and(inArray(bookings.classId, todayIds), eq(bookings.status, 'confirmed')))
      .groupBy(bookings.classId)
      .all();
    const countMap = new Map<string, number>();
    countRows.forEach((r: { classId: string; count: number }) => countMap.set(r.classId, r.count));
    todayClasses = todayClassList.map((cls: { id: string; title: string; startTime: Date; durationMinutes: number | null; capacity: number | null }) => {
      const confirmedCount = countMap.get(cls.id) ?? 0;
      return {
        id: cls.id,
        title: cls.title,
        startTime: cls.startTime,
        durationMinutes: cls.durationMinutes,
        capacity: cls.capacity,
        confirmedCount,
        occupancyPct: cls.capacity ? Math.round((confirmedCount / cls.capacity) * 100) : null,
      };
    });
  }

  let waiverCompliance = null;
  const activeWaiver = await db.select({ id: waiverTemplates.id }).from(waiverTemplates)
    .where(and(eq(waiverTemplates.tenantId, tenant.id), eq(waiverTemplates.active, true))).get();
  if (activeWaiver) {
    const signed = (await db.select({ c: sql<number>`count(distinct member_id)` }).from(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, tenant.id), eq(tenantMembers.status, 'active'))).get())?.c || 0;
    waiverCompliance = { signed: Math.min(signed, activeStudents), total: activeStudents, activeWaiver: true };
  }

  return c.json({
    activeStudents,
    upcomingBookings,
    activeSubscriptions,
    giftCardLiability,
    monthlyRevenueCents: 0,
    waiverCompliance,
    todayClasses,
  });
});

studioApp.post('/portal', async (c) => {
  const tenant = c.get('tenant');
  const { returnUrl } = await c.req.json();

  if (!tenant.stripeCustomerId) {
    return c.json({ error: "No billing account found" }, 400);
  }

  const stripeService = new StripeService(c.env.STRIPE_SECRET_KEY as string);

  try {
    const session = await stripeService.createBillingPortalSession(
      tenant.stripeCustomerId,
      returnUrl || 'https://studio-platform-web.pages.dev'
    );
    return c.json({ url: session.url });
  } catch (error: any) {
    console.error('Portal Error:', error);
    return c.json({ error: error.message }, 500);
  }
});

import tasks from './routes/tasks';

// Final Route Mounts
app.route('/locations', locationRoutes);
app.route('/members', members);
app.route('/memberships', memberships);
app.route('/waivers', waivers);
app.route('/appointments', appointments);
app.route('/payroll', payroll);
app.route('/marketing', marketing);
app.route('/coupons', coupons);
app.route('/substitutions', substitutions);
app.route('/leads', leads);
app.route('/referrals', referrals);
app.route('/pos', pos);
app.route('/uploads', uploadRoutes);
app.route('/reports', reports);
app.route('/analytics', analytics); // [NEW] Analytics

app.route('/classes', classRoutes);
app.route('/courses', courseRoutes);
app.route('/commerce', commerce);
app.route('/gift-cards', giftCards);
app.route('/quizzes', quizzes);
app.route('/tasks', tasks);
app.route('/inventory', inventory); // [NEW] Mount
app.route('/reports/custom', reportsCustom);
app.route('/refunds', refunds);
app.route('/challenges', challenges);
app.route('/platform', platform);
app.route('/kiosk', kioskRoutes); // [NEW] Mount
app.route('/jobs', jobs);
app.route('/video', video);
app.route('/video-management', videoManagement);



app.use('/studios/*', seoMiddleware);
app.route('/studios', studioRoutes);
app.route('/tenants', studioRoutes); // Alias for legacy frontend compatibility


studioApp.route('/roles', rolesRoutes); // [NEW] RBAC Management

app.route('/users', userRoutes);
app.route('/bookings', bookingRoutes);
app.route('/admin', admin);
app.route('/admin/plans', adminPlans); // [NEW] Mount
app.route('/admin/stats', adminStats); // [NEW] Mount
app.route('/admin/api-keys', adminApiKeys); // [NEW] API Key Management
app.route('/admin/mobile', adminMobile); // [NEW] Backed Admin Mobile
app.route('/admin/search', adminSearch); // [NEW] Global Search
app.route('/admin/backups', adminBackups); // [NEW] Backup Management
app.route('/admin/tenants', adminOwners); // [NEW] Ownership Management
app.route('/onboarding', onboarding);
app.route('/import', dataImport);
app.route('/webhooks', webhookRoutes);
app.route('/integrations', tenantIntegrations);
app.route('/diagnostics', diagnosticsRoutes);
app.route('/telemetry', telemetryRoutes);
app.route('/website', websiteRoutes);
app.route('/chat', chatRoutes);
app.route('/waitlist', waitlist);
app.route('/sub-dispatch', subDispatch);
app.route('/public-assets', publicAssets);
app.route('/guest', guestRoutes);
app.route('/platform-pages', platformPagesRoutes);
app.route('/faqs', faqRoutes); // [NEW] FAQ management



// Feature Routes
studioApp.route('/tags', tagsRoutes);
studioApp.route('/custom-fields', customFieldRoutes);
studioApp.route('/audit-logs', auditLogRoutes);

import tenantDomainRouter from './routes/tenant.domain';

import tenantMobileRouter from './routes/tenant.mobile';

studioApp.route('/invites', invitesRouter);
studioApp.route('/webhooks', tenantWebhooksRouter);
studioApp.route('/domain', tenantDomainRouter); // [NEW] Domain Management
studioApp.route('/mobile-config', tenantMobileRouter); // [NEW] Mobile Config

studioApp.route('/progress', progressRoutes); // [NEW] Progress Tracking

app.route('/tenant', studioApp);

import { scheduled } from './cron';

// Durable Objects
import { ChatRoom } from './durable-objects/ChatRoom';
import { RateLimiter } from './durable-objects/RateLimiter';
import { Metrics } from './durable-objects/Metrics';

export { ChatRoom, RateLimiter, Metrics };

app.notFound((c) => {
  return c.json({
    error: "Global App 404",
    path: c.req.path,
    method: c.req.method
  }, 404);
});

app.route('/docs', docRoutes); // Mount docs at /docs

export default {
  fetch: app.fetch,
  scheduled,
  async queue(batch: any, env: any) {
    const { GoogleIndexingService } = await import('./services/google-indexing');
    const indexing = new GoogleIndexingService(env.GOOGLE_SERVICE_ACCOUNT_EMAIL, env.GOOGLE_PRIVATE_KEY);
    for (const msg of batch.messages) {
      try {
        await indexing.notifyUpdate(msg.body.url);
      } catch (e) {
        console.error('Indexing Error:', e);
        msg.retry();
      }
    }
  }
}
