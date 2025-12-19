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

    // 1. Check Custom Domain
    let tenant = await db.query.tenants.findFirst({
        where: eq(tenants.customDomain, hostname),
    });

    if (!tenant) {
        // 2. Check Subdomain
        // Assumption: hostname is {slug}.platform.com
        // We need to parse the slug.
        // Simple heuristic: parts[0]
        const parts = hostname.split('.');

        // Safety check for localhost or root domain
        if (parts.length > 2) {
            // e.g. slug.platform.com -> slug
            // But what if it is www.slug.platform.com?
            // Let's assume standard 3-part for now or 1-part for localhost (which fails this check usually unless defined)
            const slug = parts[0];
            tenant = await db.query.tenants.findFirst({
                where: eq(tenants.slug, slug),
            });
        }
    }

    if (!tenant) {
        // Return 404 if tenant not found
        // OR allow "Platform" requests (landing page) if we differentiate.
        // For now, let's assume this middleware IS for tenant routes.
        return c.text('Tenant not found', 404);
    }

    c.set('tenant', tenant);
    await next();
};
