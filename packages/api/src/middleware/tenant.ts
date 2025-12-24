import { Context, Next } from 'hono';
import { createDb } from '../db';
import { eq, and } from 'drizzle-orm';
import { tenants, tenantMembers, tenantRoles, users } from 'db/src/schema';

// Extend Hono Context to include tenant
type Bindings = {
    DB: D1Database;
};

type Variables = {
    tenant: typeof tenants.$inferSelect;
    auth?: { userId: string; claims: any };
    member?: any; // tenantMembers.$inferSelect
    roles?: string[];
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
    const headerTenantSlug = c.req.header('X-Tenant-Slug');
    let tenant;

    if (headerTenantId) {
        tenant = await db.query.tenants.findFirst({
            where: eq(tenants.id, headerTenantId),
        });
    }

    if (!tenant && headerTenantSlug) {
        tenant = await db.query.tenants.findFirst({
            where: eq(tenants.slug, headerTenantSlug),
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
        // Global Admin Check
        const dbUser = await db.query.users.findFirst({
            where: eq(users.id, auth.userId)
        });

        const isSystemAdmin = dbUser?.isSystemAdmin === true;

        if (isSystemAdmin) {
            roles.push('owner');
            // Also ensure member object is at least partially mocked if missing?
            // Or better, just rely on roles.
        }

        // Find Member record
        const member = await db.query.tenantMembers.findFirst({
            where: and(
                eq(tenantMembers.userId, auth.userId),
                eq(tenantMembers.tenantId, tenant.id)
            )
        });

        if (member) {
            c.set('member', member);
            // Fetch Roles
            const rolesResult = await db.query.tenantRoles.findMany({
                where: eq(tenantRoles.memberId, member.id)
            });
            const dbRoles = rolesResult.map(r => r.role);
            roles = [...new Set([...roles, ...dbRoles])]; // Merge
        }

        c.set('roles', roles);
    }

    await next();
};
