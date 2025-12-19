import { Hono } from 'hono'
import { tenantMiddleware } from './middleware/tenant';
import { tenants } from 'db/src/schema'; // Ensure this import path is valid given tsconfig paths or package exports

type Bindings = {
  DB: D1Database;
  CLERK_SECRET_KEY: string;
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

app.route('/tenant', tenantApp);
app.route('/studios', studioRoutes);
app.route('/classes', classRoutes);
app.route('/locations', locationRoutes);

export default app
