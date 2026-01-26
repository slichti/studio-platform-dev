import { Context, Next } from 'hono';
import { createDb } from '../db';
import { eq, and } from 'drizzle-orm';
import { tenants, tenantMembers, tenantRoles, users, tenantFeatures } from '@studio/db/src/schema';
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
    isImpersonating?: boolean;
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
        let isPlatformAdmin = false;

        // Check 1: Is the current (possibly impersonated) user a Platform Admin?
        const dbUser = await db.query.users.findFirst({
            where: eq(users.id, auth.userId)
        });

        console.log(`[DEBUG] TenantMiddleware: User ${auth.userId} found:`, dbUser ? 'YES' : 'NO');
        if (dbUser) {
            console.log(`[DEBUG] User Role: ${dbUser.role}, isPlatformAdmin: ${dbUser.isPlatformAdmin}`);
        }

        const validAdminRoles = ['owner', 'admin', 'system_admin', 'platform_admin'];
        isPlatformAdmin = dbUser?.isPlatformAdmin === true || (!!dbUser?.role && validAdminRoles.includes(dbUser.role));
        console.log(`[DEBUG] isPlatformAdmin resolved to: ${isPlatformAdmin}`);

        // Check 2: If Impersonating, is the ACTUAL actor (impersonator) a Platform Admin?
        if (!isPlatformAdmin && auth.claims?.impersonatorId) {
            const impersonator = await db.query.users.findFirst({
                where: eq(users.id, auth.claims.impersonatorId)
            });
            if (impersonator?.isPlatformAdmin || (impersonator?.role && validAdminRoles.includes(impersonator.role))) {
                isPlatformAdmin = true;
            }
        }

        if (isPlatformAdmin) {
            // Check for Role Override (View As)
            const cookieHeader = c.req.header('Cookie');
            let roleOverride = null;
            if (cookieHeader) {
                const match = cookieHeader.match(/(?:^|; )__impersonate_role=([^;]*)/);
                if (match && match[1]) {
                    roleOverride = match[1];
                }
            }

            if (roleOverride && ['owner', 'admin', 'instructor', 'student'].includes(roleOverride)) {
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
            if (!isPlatformAdmin || !roles.length || roles.includes('owner')) {
                roles = [...new Set([...roles, ...dbRoles])];
            }
        } else if (isPlatformAdmin) {
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

        // --- 2FA Enforcement for Owners ---
        // Requirement: Owners must have MFA enabled/verified.
        // Impersonators are exempted as they are assumed to have satisfied platform-level security.
        if (roles.includes('owner') && !c.get('isImpersonating')) {
            const amr = auth.claims?.amr;
            const hasMfa = (Array.isArray(amr) && (amr.includes('mfa') || amr.includes('otp') || amr.includes('totp'))) || auth.claims?.mfa === true;
            const isDev = (c.env as any).ENVIRONMENT === 'dev' || (c.env as any).ENVIRONMENT === 'development';

            if (!hasMfa) {
                // Grace Period: Allow 7 days for new owners to set up MFA
                const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;
                const userCreated = dbUser?.createdAt ? new Date(dbUser.createdAt).getTime() : 0;
                const timeSinceCreation = Date.now() - userCreated;

                // Exception: Allow /me endpoint so frontend can bootstrap user context to show MFA-setup UI
                if (c.req.path.endsWith('/me') && c.req.method === 'GET') {
                    // Proceed
                } else if ((userCreated && timeSinceCreation < GRACE_PERIOD_MS) || isDev) {
                    // Allow with warning (Grace Period OR Dev Env)
                    c.header('X-MFA-Warning', isDev ? 'MFA enforcement disabled in DEV' : 'MFA setup required within 7 days');
                    if (!isDev) {
                        console.log(`[Security] MFA Grace Period Active for ${auth.userId} (${7 - Math.floor(timeSinceCreation / 86400000)} days remaining)`);
                    }
                } else {
                    return c.json({
                        error: "Multi-Factor Authentication Required",
                        code: "mfa_required",
                        message: "Access to owner-level operations requires Two-Factor Authentication. Please enable MFA in your account settings."
                    }, 403);
                }
            } else {
                // Happy Path: User HAS MFA. 
                // Sync this status to DB if needed (so Admin dashboard sees it)
                if (dbUser && dbUser.mfaEnabled !== true) {
                    // Fire and forget update
                    c.executionCtx.waitUntil(
                        db.update(users).set({ mfaEnabled: true, lastActiveAt: new Date() }).where(eq(users.id, auth.userId)).run()
                    );
                }
            }
        }

        // 4. Lifecycle Checks
        if (tenant.status === 'archived' && !isPlatformAdmin) {
            // Archived tenants are inaccessible except to System Admins (for restoration)
            // Note: If Owners need read-only access to archived tenants, this logic needs adjustment.
            // Requirement says "spin it back up in event of audit", implying it is currently offline.
            // Exports should happen DURING grace period.
            return c.json({ error: "This studio has been archived." }, 403);
        }

        if (tenant.studentAccessDisabled && !isPlatformAdmin) {
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
