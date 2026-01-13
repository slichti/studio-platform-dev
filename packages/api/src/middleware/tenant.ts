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
    const headerTenantSlug = c.req.header('X-Tenant-Slug')?.toLowerCase();
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
        return c.json({
            error: `Tenant not found. Context: ${hostname}, Header: ${headerTenantSlug || 'N/A'}, ID: ${headerTenantId || 'N/A'}`,
            debug: true
        }, 404);
    }

    c.set('tenant', tenant);
    console.log(`[TenantMiddleware] Set tenant context for ${hostname}: ${tenant?.name} (${tenant?.id})`);

    // -------------------------------------------------------------
    // Credential Decryption (BYOK)
    // -------------------------------------------------------------
    if (!c.env.ENCRYPTION_SECRET) {
        console.error("Configuration Error: ENCRYPTION_SECRET is missing");
        return c.json({ error: "Server Configuration Error" }, 500);
    }
    const encryption = new EncryptionUtils(c.env.ENCRYPTION_SECRET);

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
            // Check for Role Override (View As)
            const cookieHeader = c.req.header('Cookie');
            let roleOverride = null;
            if (cookieHeader) {
                const match = cookieHeader.match(/(?:^|; )__impersonate_role=([^;]*)/);
                if (match && match[1]) {
                    roleOverride = match[1];
                }
            }

            if (roleOverride && ['owner', 'instructor', 'student'].includes(roleOverride)) {
                roles = [roleOverride];
            } else {
                roles.push('owner');
            }
        }

        // Find Member record
        const member = await db.query.tenantMembers.findFirst({
            where: and(
                eq(tenantMembers.userId, auth.userId),
                eq(tenantMembers.tenantId, tenant.id)
            ),
            with: { user: true }
        });

        if (member) {
            c.set('member', member);
            // Fetch Roles
            const rolesResult = await db.query.tenantRoles.findMany({
                where: eq(tenantRoles.memberId, member.id)
            });
            const dbRoles = rolesResult.map(r => r.role);

            // Only merge if NOT overriding as a lower role (student/instructor)
            if (!isSystemAdmin || !roles.length || roles.includes('owner')) {
                roles = [...new Set([...roles, ...dbRoles])];
            }
        } else if (isSystemAdmin) {
            // Synthesize virtual member for system admins who aren't explicitly members
            c.set('member', {
                id: `virt_${auth.userId}`,
                tenantId: tenant.id,
                userId: auth.userId,
                status: 'active',
                user: dbUser, // Original global user record
                profile: dbUser?.profile // Use global profile
            });
            if (!roles.includes('owner')) {
                roles.push('owner');
            }
        }

        c.set('roles', roles);

        // 4. Lifecycle Checks
        if (tenant.status === 'archived' && !isSystemAdmin) {
            // Archived tenants are inaccessible except to System Admins (for restoration)
            // Note: If Owners need read-only access to archived tenants, this logic needs adjustment.
            // Requirement says "spin it back up in event of audit", implying it is currently offline.
            // Exports should happen DURING grace period.
            return c.json({ error: "This studio has been archived." }, 403);
        }

        if (tenant.studentAccessDisabled && !isSystemAdmin) {
            const hasPrivilegedRole = roles.some(r => ['owner', 'instructor', 'admin'].includes(r));
            if (!hasPrivilegedRole) {
                return c.json({ error: "Student access is currently disabled for this studio." }, 403);
            }
        }
    }

    await next();
};

/**
 * Middleware factory to require a specific feature to be enabled for the tenant.
 * Usage: app.use('/*', requireFeature('website_builder'));
 */
export const requireFeature = (featureKey: string) => {
    return async (c: Context<{ Bindings: Bindings, Variables: Variables }>, next: Next) => {
        const features = c.get('features');

        if (!features || !features.has(featureKey)) {
            return c.json({
                error: `Feature '${featureKey}' is not enabled for this tenant.`,
                featureKey
            }, 403);
        }

        await next();
    };
};
