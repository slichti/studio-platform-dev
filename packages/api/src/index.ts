import { Hono } from 'hono'
import { createDb } from './db';
import { tenants, tenantMembers, tenantFeatures, users, classes, bookings, posOrders, purchasedPacks, waiverTemplates, waiverSignatures, tenantRoles, platformConfig } from 'db/src/schema';
import { eq, and, count, sum, gte, like, or } from 'drizzle-orm';
import { UsageService } from './services/pricing';
import { StripeService } from './services/stripe';
import { ExportService } from './services/export';
import { authMiddleware } from './middleware/auth';
import { optionalAuthMiddleware } from './middleware/optionalAuth';
import { tenantMiddleware } from './middleware/tenant';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { rateLimitMiddleware } from './middleware/rate-limit'; // [NEW]

// Route Imports
import studioRoutes from './routes/studios';
import classRoutes from './routes/classes';
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
import giftCards from './routes/gift-cards';
import bookingRoutes from './routes/bookings';
import admin from './routes/admin';
import onboarding from './routes/onboarding';
import dataImport from './routes/import';
import webhookRoutes from './routes/webhooks';
import uploadRoutes from './routes/uploads';
import userRoutes from './routes/users';
import commerce from './routes/commerce';
import refunds from './routes/refunds';
import platform from './routes/platform';
import reports from './routes/reports';
import reportsCustom from './routes/reports.custom';
import challenges from './routes/challenges';
import jobs from './routes/jobs';
import video from './routes/video';
import videoManagement from './routes/video-management';
import tenantIntegrations from './routes/tenant-integrations';
import diagnosticsRoutes from './routes/diagnostics';
import telemetryRoutes from './routes/telemetry';
import websiteRoutes from './routes/website';
import chatRoutes from './routes/chat';
import platformPagesRoutes from './routes/platform-pages';
import guestRoutes from './routes/guest';
import adminStats from './routes/admin-stats'; // [NEW] Import

type Bindings = {
  DB: D1Database;
  CLERK_SECRET_KEY: string;
  CLERK_PEM_PUBLIC_KEY: string;
  ZOOM_ACCOUNT_ID: string;
  ZOOM_CLIENT_ID: string;
  ZOOM_CLIENT_SECRET: string;
  ZOOM_WEBHOOK_SECRET_TOKEN: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_PUBLISHABLE_KEY: string;
  STRIPE_CLIENT_ID: string;
  RESEND_API_KEY: string;
  CLERK_WEBHOOK_SECRET: string;
  R2: R2Bucket;
  ENCRYPTION_SECRET: string;
  LIVEKIT_API_KEY: string;
  LIVEKIT_API_SECRET: string;
  RATE_LIMITER: DurableObjectNamespace;
  METRICS: DurableObjectNamespace;
};

type Variables = {
  tenant: typeof tenants.$inferSelect;
  member?: any; // Includes user relation from 'with' query
  roles?: string[];
  auth: {
    userId: string | null;
    claims: any;
  };
  features: Set<string>;
  isImpersonating?: boolean;
};

import { traceMiddleware } from './middleware/trace';
import { sentryMiddleware } from './middleware/sentry';

// ...

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>()

app.use('*', traceMiddleware);
app.use('*', sentryMiddleware()); // [NEW] Sentry error tracking
app.use('*', rateLimitMiddleware(300, 60)); // [NEW] Global Rate Limit: 300 req/min
app.use('*', logger((str, ...rest) => {
  // Custom logger wrapper could go here, but Hono logger is simple.
  // For now we rely on the header being set by traceMiddleware for standard logs
  console.log(str, ...rest);
}));
app.use('*', cors({
  origin: (origin) => {
    if (!origin) return 'https://studio-platform-web.pages.dev';
    if (origin.endsWith('.pages.dev') || origin.endsWith('.slichti.org') || origin.includes('localhost')) {
      return origin;
    }
    return 'https://studio-platform-web.pages.dev';
  },
  allowHeaders: ['*'], // Allow all headers to prevent preflight failures
  allowMethods: ['POST', 'GET', 'OPTIONS', 'DELETE', 'PUT', 'PATCH'],
  exposeHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 86400,
  credentials: true,
}));

app.onError((err: any, c) => {
  console.error('Global App Error:', err);

  // Only expose detailed error info in non-production environments
  const isDev = (c.env as any).ENVIRONMENT !== 'production';

  if (isDev) {
    return c.json({
      error: "Internal Application Error",
      message: err.message,
      stack: err.stack,
      cause: err.cause
    }, 500);
  }

  return c.json({
    error: "Internal Application Error",
    requestId: c.req.header('X-Request-Id') || 'unknown'
  }, 500);
});

app.get('/', (c) => {
  return c.text('Health Check: OK')
})

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
  '/commerce', '/commerce/*',
  '/gift-cards', '/gift-cards/*',
  '/refunds', '/refunds/*',
  '/platform', '/platform/*',
  '/integrations', '/integrations/*',
  '/sub-dispatch', '/sub-dispatch/*',
  '/waitlist', '/waitlist/*',
  '/video-management', '/video-management/*'
];

const authenticatedPaths = [
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
  '/refunds', '/refunds/*',
  '/platform', '/platform/*',
  '/tenant', '/tenant/*',
  '/integrations', '/integrations/*',
  '/sub-dispatch', '/sub-dispatch/*',
  '/waitlist', '/waitlist/*',
  '/video-management', '/video-management/*',
  '/diagnostics', '/diagnostics/*'  // Security: Require auth for diagnostics
];

const publicStudioPaths = [
  '/classes', '/classes/*',
  '/commerce', '/commerce/*',
  '/gift-cards', '/gift-cards/*'
];

// 3. Apply Middleware

// first, identify the user (Auth)
publicStudioPaths.forEach(path => app.use(path, optionalAuthMiddleware));
authenticatedPaths.forEach(path => app.use(path, authMiddleware));

// then, establish studio context and member status (Tenant)
studioPaths.forEach(path => app.use(path, tenantMiddleware));

// 4. Infrastructure/Common Studio Logic
const studioApp = new Hono<{ Bindings: Bindings, Variables: Variables }>()

// 5. Setup Feature Route sub-apps (will be mounted in next step)
// 5. Setup Feature Route sub-apps (will be mounted in next step)
app.route('/studios', studioRoutes);
app.route('/tenants', studioRoutes); // Alias for legacy frontend compatibility

// 6. Base Studio Logic
// GET /info
studioApp.get('/info', async (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.json({ error: "No tenant" }, 404);

  const db = createDb(c.env.DB);
  const platformConfigs = await db.select().from(platformConfig).all();
  const globalFeatures = platformConfigs.reduce((acc, curr) => {
    acc[curr.key] = curr.enabled;
    return acc;
  }, {} as Record<string, boolean>);

  return c.json({
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    tier: tenant.tier,
    status: tenant.status,
    customDomain: tenant.customDomain,
    settings: tenant.settings,
    mobileAppConfig: tenant.mobileAppConfig, // Added
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
  if (body.settings) {
    updateData.settings = { ...(tenant.settings || {}), ...body.settings };
  }
  if (body.mobileAppConfig) {
    updateData.mobileAppConfig = { ...(tenant.mobileAppConfig || {}), ...body.mobileAppConfig };
  }
  if (body.branding) {
    updateData.branding = { ...(tenant.branding || {}), ...body.branding };
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
  const ALLOWED_FEATURES = ['sms'];

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
      isPlatformAdmin: user.isPlatformAdmin || false
    }
  });
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

studioApp.post('/portal', async (c) => {
  const tenant = c.get('tenant');
  const { returnUrl } = await c.req.json();

  if (!tenant.stripeCustomerId) {
    return c.json({ error: "No billing account found" }, 400);
  }

  const stripeService = new StripeService(c.env.STRIPE_SECRET_KEY);

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
app.route('/substitutions', substitutions);
app.route('/leads', leads);
app.route('/pos', pos);
app.route('/uploads', uploadRoutes);
app.route('/reports', reports);
app.route('/payroll', payroll);

app.route('/classes', classRoutes);
app.route('/commerce', commerce);
app.route('/gift-cards', giftCards);
app.route('/tasks', tasks);
app.route('/reports/custom', reportsCustom);
app.route('/refunds', refunds);
app.route('/challenges', challenges);
app.route('/platform', platform);
app.route('/jobs', jobs);
app.route('/video', video);
app.route('/video-management', videoManagement);

app.route('/tenant', studioApp);

app.route('/users', userRoutes);
app.route('/bookings', bookingRoutes);
app.route('/admin', admin);
app.route('/admin/stats', adminStats); // [NEW] Mount
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
app.route('/guest', guestRoutes);
app.route('/platform-pages', platformPagesRoutes);

import { scheduled } from './cron';

// Durable Objects
import { ChatRoom } from './durable-objects/ChatRoom';
import { RateLimiter } from './durable-objects/RateLimiter';
import { Metrics } from './durable-objects/Metrics';

export { ChatRoom, RateLimiter, Metrics };

export default {
  fetch: app.fetch,
  scheduled
}
