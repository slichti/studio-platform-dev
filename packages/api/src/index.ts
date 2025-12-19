import { Hono } from 'hono'
import { tenantMiddleware } from './middleware/tenant';
import { tenants } from 'db/src/schema'; // Ensure this import path is valid given tsconfig paths or package exports

type Bindings = {
  DB: D1Database;
};

type Variables = {
  tenant: typeof tenants.$inferSelect;
};

import studioRoutes from './routes/studios';
import classRoutes from './routes/classes';
import locationRoutes from './routes/locations';

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>()

// Public routes
app.get('/', (c) => {
  return c.text('Health Check: OK')
})

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
