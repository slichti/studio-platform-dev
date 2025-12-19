import { Context, Next } from 'hono';
import { createDb } from '../db';
import { eq } from 'drizzle-orm';
import { tenants } from 'db/src/schema';

// Extend Hono Context to include tenant
type Bindings = {
    DB: D1Database;
};

type Variables = {
    tenant: typeof tenants.$inferSelect;
    auth?: { userId: string; claims: any };
    user?: any; // users.$inferSelect - avoiding circular dependency if possible, or use 'any' for now then refine
};

export const tenantMiddleware = async (c: Context<{ Bindings: Bindings, Variables: Variables }>, next: Next) => {
    const url = new URL(c.req.url);
    const hostname = url.hostname; // e.g., zenflow.studio-platform.dev or zenflow.com

    // Logic to determine slug or custom domain
    // For dev, we might use localhost or a fixed suffix
    // e.g. *.studio-platform-dev (if we had a real domain).
    // For local Wrangler dev, it's usually localhost:8787.
    // We can pass tenant slug via header for testing or rely on Host header.

    const db = createDb(c.env.DB);

    // 0. Check Header (Strongly preferred for API calls)
    const headerTenantId = c.req.header('X-Tenant-Id');
    let tenant;

    if (headerTenantId) {
        tenant = await db.query.tenants.findFirst({
            where: eq(tenants.id, headerTenantId),
        });
    }

    if (!tenant) {
        // 1. Check Custom Domain
        tenant = await db.query.tenants.findFirst({
            where: eq(tenants.customDomain, hostname),
        });
    }

    if (!tenant) {
        // 2. Check Subdomain
        const parts = hostname.split('.');
        if (parts.length > 2) {
            const slug = parts[0];
            tenant = await db.query.tenants.findFirst({
                where: eq(tenants.slug, slug),
            });
        }
    }

    if (!tenant) {
        return c.json({ error: 'Tenant not found. Provide X-Tenant-Id header or use a studio domain.' }, 404);
    }

    c.set('tenant', tenant);

    // 3. Security Check: If User is Authenticated, Verify Membership
    const auth = c.get('auth');
    if (auth && auth.userId) {
        // ... (rest is fine)
        // Fetch User Record for this Tenant
        const { users } = await import('db/src/schema');
        const user = await db.query.users.findFirst({
            where: (users, { and, eq }) => and(
                eq(users.id, auth.userId),
                eq(users.tenantId, tenant.id)
            ),
        });

        if (!user) {
            // User exists in Clerk (Auth) but NOT in this Tenant's user table.
            return c.json({ error: 'Access Denied: You are not a member of this studio.' }, 403);
        }

        // Expose User Record (with Role) to downstream handlers
        c.set('user', user);
    }

    await next();
};
