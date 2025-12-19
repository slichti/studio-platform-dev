import { Hono } from 'hono'
import { tenantMiddleware } from './middleware/tenant';
import { tenants } from 'db/src/schema'; // Ensure this import path is valid given tsconfig paths or package exports

type Bindings = {
  DB: D1Database;
  CLERK_SECRET_KEY: string;
  ZOOM_ACCOUNT_ID: string;
  ZOOM_CLIENT_ID: string;
  ZOOM_CLIENT_SECRET: string;
  ZOOM_WEBHOOK_SECRET_TOKEN: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
};

type Variables = {
  tenant: typeof tenants.$inferSelect;
  auth: {
    userId: string | null;
    claims: any;
  };
};

import studioRoutes from './routes/studios';
import classRoutes from './routes/classes';
import locationRoutes from './routes/locations';

import { authMiddleware } from './middleware/auth';

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>()

// Public routes
app.get('/', (c) => {
  return c.text('Health Check: OK')
})

// Protected Routes Middleware
app.use('/studios/*', authMiddleware);
app.use('/classes/*', authMiddleware);
app.use('/locations/*', authMiddleware);

// Tenant Middleware Application
const tenantApp = new Hono<{ Bindings: Bindings, Variables: Variables }>()
tenantApp.use('*', tenantMiddleware)

tenantApp.get('/info', (c) => {
  const tenant = c.get('tenant');
  if (!tenant) return c.json({ error: "No tenant" }, 404);

  return c.json({
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    customDomain: tenant.customDomain
  })
})

import webhookRoutes from './routes/webhooks';
import uploadRoutes from './routes/uploads';

// ... (existing routes)

app.route('/tenant', tenantApp);
app.route('/studios', studioRoutes);
app.route('/classes', classRoutes);
app.route('/locations', locationRoutes);
app.route('/webhooks', webhookRoutes);
app.route('/uploads', uploadRoutes);

export default app
