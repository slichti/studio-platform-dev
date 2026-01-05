import { Hono } from 'hono'
import { createDb } from './db';
import { tenants, tenantMembers } from 'db/src/schema';
import { eq } from 'drizzle-orm';
import { authMiddleware } from './middleware/auth';
import { optionalAuthMiddleware } from './middleware/optionalAuth';
import { tenantMiddleware } from './middleware/tenant';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

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
import leads from './routes/leads';
import pos from './routes/pos';
import giftCards from './routes/gift-cards';
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
import challenges from './routes/challenges';
import jobs from './routes/jobs';

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

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>()

app.use('*', logger());
app.use('*', cors({
  origin: (origin) => {
    if (!origin) return 'https://studio-platform-web.pages.dev';
    if (origin.endsWith('.pages.dev') || origin.endsWith('.slichti.org') || origin.includes('localhost')) {
      return origin;
    }
    return 'https://studio-platform-web.pages.dev';
  },
  allowHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Slug', 'X-Tenant-Id'],
  allowMethods: ['POST', 'GET', 'OPTIONS', 'DELETE', 'PUT', 'PATCH'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}));

app.onError((err: any, c) => {
  console.error('Global App Error:', err);
  return c.json({
    error: "Internal Application Error",
    message: err.message,
    stack: err.stack,
    cause: err.cause
  }, 500);
});

app.get('/', (c) => {
  return c.text('Health Check: OK')
})

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
  '/platform', '/platform/*'
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
  '/tenant', '/tenant/*'
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
const publicStudioApp = new Hono<{ Bindings: Bindings, Variables: Variables }>()
publicStudioApp.route('/classes', classRoutes);
publicStudioApp.route('/commerce', commerce);
publicStudioApp.route('/gift-cards', giftCards);
app.route('/studios', studioRoutes);

// 6. Base Studio Logic
studioApp.get('/info', (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.json({ error: "No tenant" }, 404);
  return c.json({
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    customDomain: tenant.customDomain,
    settings: tenant.settings,
    stripeAccountId: tenant.stripeAccountId,
    branding: tenant.branding,
    features: Array.from(c.get('features') || [])
  });
});

studioApp.get('/stats', async (c) => {
  const tenant = c.get('tenant');
  const db = createDb(c.env.DB);
  const { count, sum, and, eq, gte } = await import('drizzle-orm');
  const { tenantMembers, tenantRoles, classes, bookings, posOrders, purchasedPacks, waiverTemplates, waiverSignatures } = await import('db/src/schema');

  const now = new Date();
  const firstOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [memberCount, bookingsCount, revenuePos, revenuePacks] = await Promise.all([
    db.select({ count: count() })
      .from(tenantMembers)
      .innerJoin(tenantRoles, eq(tenantMembers.id, tenantRoles.memberId))
      .where(and(
        eq(tenantMembers.tenantId, tenant.id),
        eq(tenantRoles.role, 'student'),
        eq(tenantMembers.status, 'active')
      )).get(),

    db.select({ count: count() })
      .from(bookings)
      .innerJoin(classes, eq(bookings.classId, classes.id))
      .where(and(
        eq(classes.tenantId, tenant.id),
        gte(classes.startTime, now)
      )).get(),

    db.select({ total: sum(posOrders.totalAmount) })
      .from(posOrders)
      .where(and(
        eq(posOrders.tenantId, tenant.id),
        gte(posOrders.createdAt, firstOfCurrentMonth),
        eq(posOrders.status, 'completed')
      )).get(),

    db.select({ total: sum(purchasedPacks.price) })
      .from(purchasedPacks)
      .where(and(
        eq(purchasedPacks.tenantId, tenant.id),
        gte(purchasedPacks.createdAt, firstOfCurrentMonth)
      )).get()
  ]);

  const activeTemplate = await db.query.waiverTemplates.findFirst({
    where: and(eq(waiverTemplates.tenantId, tenant.id), eq(waiverTemplates.active, true))
  });

  let signedCount = 0;
  if (activeTemplate) {
    const result = await db.select({ count: count() })
      .from(waiverSignatures)
      .innerJoin(tenantMembers, eq(waiverSignatures.memberId, tenantMembers.id))
      .where(and(
        eq(waiverSignatures.templateId, activeTemplate.id),
        eq(tenantMembers.status, 'active')
      )).get();
    signedCount = (result as any)?.count || 0;
  }

  const posTotal = Number((revenuePos as any)?.total || 0);
  const packTotal = Number((revenuePacks as any)?.total || 0);

  return c.json({
    activeStudents: (memberCount as any)?.count || 0,
    upcomingBookings: (bookingsCount as any)?.count || 0,
    monthlyRevenueCents: posTotal + packTotal,
    waiverCompliance: {
      signed: signedCount,
      total: (memberCount as any)?.count || 0,
      activeWaiver: !!activeTemplate
    }
  });
});

studioApp.get('/search', async (c) => {
  const tenant = c.get('tenant');
  const db = createDb(c.env.DB);
  const q = c.req.query('q')?.toLowerCase();
  if (!q) return c.json({ students: [], classes: [], orders: [] });

  const { like, or, and, eq } = await import('drizzle-orm');
  const { tenantMembers, users, classes, posOrders } = await import('db/src/schema');

  const [students, upcomingClasses, recentOrders] = await Promise.all([
    db.select({
      id: tenantMembers.id,
      name: users.profile,
      email: users.email
    })
      .from(tenantMembers)
      .innerJoin(users, eq(tenantMembers.userId, users.id))
      .where(and(
        eq(tenantMembers.tenantId, tenant.id),
        or(
          like(users.email, `%${q}%`),
          like(users.profile, `%${q}%`)
        )
      ))
      .limit(10)
      .all(),

    db.select()
      .from(classes)
      .where(and(
        eq(classes.tenantId, tenant.id),
        like(classes.title, `%${q}%`)
      ))
      .limit(10)
      .all(),

    db.select()
      .from(posOrders)
      .where(and(
        eq(posOrders.tenantId, tenant.id),
        like(posOrders.id, `%${q}%`)
      ))
      .limit(10)
      .all()
  ]);

  return c.json({ students, classes: upcomingClasses, orders: recentOrders });
});

studioApp.patch('/settings', async (c) => {
  const tenant = c.get('tenant');
  const db = createDb(c.env.DB);
  const body = await c.req.json();
  const updateData: any = {};
  if (body.name) updateData.name = body.name;
  if (body.settings) {
    updateData.settings = { ...(tenant.settings || {}), ...body.settings };
  }
  if (Object.keys(updateData).length === 0) return c.json({ received: true });
  await db.update(tenants).set(updateData).where(eq(tenants.id, tenant.id)).run();
  return c.json({ success: true });
});

studioApp.put('/credentials/zoom', async (c) => {
  const tenant = c.get('tenant');
  const db = createDb(c.env.DB);
  const { accountId, clientId, clientSecret } = await c.req.json();
  if (!accountId || !clientId || !clientSecret) return c.json({ error: 'Missing credentials' }, 400);
  await db.update(tenants).set({ zoomCredentials: { accountId, clientId, clientSecret } }).where(eq(tenants.id, tenant.id)).run();
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
      isSystemAdmin: user.isSystemAdmin || false
    }
  });
});

studioApp.get('/usage', async (c) => {
  const tenant = c.get('tenant');
  const db = createDb(c.env.DB);
  const { UsageService } = await import('./services/pricing');
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

  const { StripeService } = await import('./services/stripe');
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
app.route('/refunds', refunds);
app.route('/challenges', challenges);
app.route('/platform', platform);
app.route('/jobs', jobs);

app.route('/tenant', studioApp);

app.route('/users', userRoutes);
app.route('/admin', admin);
app.route('/onboarding', onboarding);
app.route('/import', dataImport);
app.route('/webhooks', webhookRoutes);

import { scheduled } from './cron';

export default {
  fetch: app.fetch,
  scheduled
}
