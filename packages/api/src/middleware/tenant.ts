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
        // Import schema
        const { tenantMembers, tenantRoles } = await import('db/src/schema');

        // Find Member record
        const member = await db.query.tenantMembers.findFirst({
            where: (members, { and, eq }) => and(
                eq(members.userId, auth.userId),
                eq(members.tenantId, tenant.id)
            ),
            with: {
                // Determine roles? No "with" relation query in definition yet, or need to verify relations export
                // Let's do a separate query or join if needed. For now simple query.
            }
        });

        if (!member) {
            // User exists in Clerk (Auth) but NOT in this Tenant's members table.
            return c.json({ error: 'Access Denied: You are not a member of this studio.' }, 403);
        }

        // Fetch Roles
        const rolesResult = await db.query.tenantRoles.findMany({
            where: eq(tenantRoles.memberId, member.id)
        });
        const roles = rolesResult.map(r => r.role);

        // Expose Member and Roles to downstream handlers
        c.set('member', member);
        c.set('roles', roles);
    }

    await next();
};
