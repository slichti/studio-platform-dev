import { Hono } from 'hono'
import { tenantMiddleware } from './middleware/tenant';
import { tenants, tenantMembers } from 'db/src/schema'; // Ensure this import path is valid given tsconfig paths or package exports

type Bindings = {
  DB: D1Database;
  CLERK_SECRET_KEY: string;
  CLERK_PEM_PUBLIC_KEY: string; // PEM format public key for RS256 verification
  ZOOM_ACCOUNT_ID: string;
  ZOOM_CLIENT_ID: string;
  ZOOM_CLIENT_SECRET: string;
  ZOOM_WEBHOOK_SECRET_TOKEN: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_PUBLISHABLE_KEY: string;
  STRIPE_CLIENT_ID: string;
};

type Variables = {
  tenant: typeof tenants.$inferSelect;
  member?: typeof tenantMembers.$inferSelect;
  roles?: string[];
  auth: {
    userId: string | null;
    claims: any;
  };
};

import studioRoutes from './routes/studios';
import classRoutes from './routes/classes';
import locationRoutes from './routes/locations';

import { authMiddleware } from './middleware/auth';

import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import members from './routes/members';

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>()

app.use('*', logger());
app.use('*', cors({
  origin: ['https://studio-platform-web.pages.dev', 'https://studio-platform-dev.slichti.org', 'http://localhost:5173'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['POST', 'GET', 'OPTIONS', 'DELETE', 'PUT'],
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

// Public routes
app.get('/', (c) => {
  return c.text('Health Check: OK')
})

// Protected Routes Middleware
// Middleware Configuration
// 1. Global Auth (Strict) for Admin/Users/Uploads
app.use('/users/*', authMiddleware);
app.use('/admin/*', authMiddleware);
app.use('/uploads/*', authMiddleware);

// 2. Tenant Context (Required for all studio routes)
app.use('/studios/*', authMiddleware); // Studio Management requires auth
app.use('/locations/*', authMiddleware);
app.use('/locations/*', tenantMiddleware);

// 3. Optional Auth for Classes (Public Access)
// We use optionalAuthMiddleware so we can know IF a user is logged in, but not block if not.
import { optionalAuthMiddleware } from './middleware/optionalAuth';
app.use('/classes/*', optionalAuthMiddleware);
app.use('/classes/*', tenantMiddleware);

// 4. Strict Auth + Tenant for Members/Memberships
app.use('/members*', authMiddleware);
app.use('/members*', tenantMiddleware);
app.use('/memberships*', authMiddleware);
import waivers from './routes/waivers';
app.use('/waivers*', authMiddleware); // Or optional if we want public viewing of agreement? Usually signing requires auth for signature binding.
// For now, let's say specific methods in waivers route handle auth, but tenant middleware is needed.
app.use('/waivers*', tenantMiddleware);
app.route('/waivers', waivers);

// Note: '/studios/*' is creating tenants, so it might not be inside a tenant yet?
// Actually 'POST /studios' creates one. 'GET /studios/:id' views one.
// If we enforce tenantMiddleware on ALL /studios/*, we break creation.
// So let's apply explicitly to sub-resources.

// Tenant Middleware Application (for domain-based access)
const tenantApp = new Hono<{ Bindings: Bindings, Variables: Variables }>()
tenantApp.use('*', authMiddleware); // Auth first
tenantApp.use('*', tenantMiddleware); // Then Tenant (which checks membership)

tenantApp.get('/info', (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.json({ error: "No tenant" }, 404);

  return c.json({
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    customDomain: tenant.customDomain,
    settings: tenant.settings
  })
})

tenantApp.get('/me', (c) => {
  const member = c.get('member');
  const roles = c.get('roles');
  if (!member) {
    return c.json({ error: "Not a member" }, 401);
  }
  return c.json({
    member,
    roles
  });
})

import webhookRoutes from './routes/webhooks';
import uploadRoutes from './routes/uploads';
import adminRoutes from './routes/admin';
import userRoutes from './routes/users';

// ... (existing routes)

app.route('/tenant', tenantApp);
app.route('/studios', studioRoutes);
app.route('/classes', classRoutes);
app.route('/locations', locationRoutes);
app.route('/webhooks', webhookRoutes);
app.route('/uploads', uploadRoutes);
app.route('/admin', adminRoutes);
app.route('/users', userRoutes);
import memberships from './routes/memberships';

app.route('/members', members);
app.route('/memberships', memberships);

export default app
