import { Context, Next } from 'hono';
import { createDb } from '../db';
import { eq, and } from 'drizzle-orm';
import { tenants, tenantMembers, tenantRoles, users, tenantFeatures } from 'db/src/schema';
import { EncryptionUtils } from '../utils/encryption';

// Extend Hono Context to include tenant
type Bindings = {
    DB: D1Database;
    ENCRYPTION_SECRET: string;
    RESEND_API_KEY: string;
};

type Variables = {
    tenant: typeof tenants.$inferSelect;
    auth?: { userId: string; claims: any };
    member?: any; // tenantMembers.$inferSelect
    roles?: string[];
    features: Set<string>;
    emailApiKey?: string;
    twilioCredentials?: { accountSid: string; authToken: string; fromNumber: string };
};

export const tenantMiddleware = async (c: Context<{ Bindings: Bindings, Variables: Variables }>, next: Next) => {
    const url = new URL(c.req.url);
    const hostname = url.hostname;

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

    // -------------------------------------------------------------
    // Credential Decryption (BYOK)
    // -------------------------------------------------------------
    const encryption = new EncryptionUtils(c.env.ENCRYPTION_SECRET || 'default-secret-change-me-in-prod-at-least-32-chars');

    // 1. Email (Resend)
    if (tenant.resendCredentials) {
        try {
            const creds = tenant.resendCredentials as any;
            if (creds.apiKey) {
                const decrypted = await encryption.decrypt(creds.apiKey);
                c.set('emailApiKey', decrypted);
            }
        } catch (e) {
            console.error("Failed to decrypt Email credentials", e);
        }
    }

    // 2. SMS (Twilio)
    if (tenant.twilioCredentials) {
        try {
            const creds = tenant.twilioCredentials as any;
            if (creds.authToken && creds.accountSid) {
                const decryptedAuth = await encryption.decrypt(creds.authToken);
                c.set('twilioCredentials', {
                    accountSid: creds.accountSid,
                    authToken: decryptedAuth,
                    fromNumber: creds.fromNumber
                });
            }
        } catch (e) {
            console.error("Failed to decrypt SMS credentials", e);
        }
    }

    // Fetch Features
    const features = await db.query.tenantFeatures.findMany({
        where: and(eq(tenantFeatures.tenantId, tenant.id), eq(tenantFeatures.enabled, true))
    });
    const featureSet = new Set(features.map(f => f.featureKey || ''));
    c.set('features', featureSet);

    // 3. Security Check: If User is Authenticated, Verify Membership
    const auth = c.get('auth');
    let roles: string[] = [];

    if (auth && auth.userId) {
        // Global Admin Check (Original User)
        let isSystemAdmin = false;

        // Check 1: Is the current (possibly impersonated) user a System Admin?
        const dbUser = await db.query.users.findFirst({
            where: eq(users.id, auth.userId)
        });
        isSystemAdmin = dbUser?.isSystemAdmin === true;

        // Check 2: If Impersonating, is the ACTUAL actor (impersonator) a System Admin?
        if (!isSystemAdmin && auth.claims?.impersonatorId) {
            const impersonator = await db.query.users.findFirst({
                where: eq(users.id, auth.claims.impersonatorId)
            });
            if (impersonator?.isSystemAdmin) {
                isSystemAdmin = true;
            }
        }

        if (isSystemAdmin) {
            roles.push('owner');
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
