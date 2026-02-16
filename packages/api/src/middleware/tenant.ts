import { Context, Next } from 'hono';
import { createDb } from '../db';
import { eq, and } from 'drizzle-orm';
import { tenants, tenantMembers, tenantRoles, users, tenantFeatures, customRoles, memberCustomRoles } from '@studio/db/src/schema';
import { EncryptionUtils } from '../utils/encryption';
import { PermissionService, Permission } from '../services/permissions';
import { EmailService } from '../services/email';
import { Variables } from '../types';

// Extend Hono Context to include tenant
type Bindings = {
    DB: D1Database;
    ENCRYPTION_SECRET: string;
    RESEND_API_KEY: string;
};

// Variables were moved to types.ts and imported above

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
        if (!tenant) console.log('[TenantMiddleware] Slug Header provided but not found:', headerTenantSlug);
    }

    if (!tenant && c.req.header('Upgrade')?.toLowerCase() === 'websocket') {
        const queryTenantSlug = c.req.query('tenantSlug');
        const queryTenantId = c.req.query('tenantId');

        console.log('[TenantMiddleware] WS Upgrade detected', { queryTenantSlug, queryTenantId });

        if (queryTenantSlug) {
            tenant = await db.query.tenants.findFirst({
                where: eq(tenants.slug, queryTenantSlug),
            });
        } else if (queryTenantId) {
            tenant = await db.query.tenants.findFirst({
                where: eq(tenants.id, queryTenantId),
            });
        }
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
        // 3. Check Path (Fallback for centrally served assets e.g. /uploads/tenants/:slug/...)
        // This allows public access to assets without needing a custom domain or subdomain on the API
        const match = url.pathname.match(/^\/uploads\/tenants\/([^/]+)\//);
        if (match && match[1]) {
            const pathSlug = match[1];
            tenant = await db.query.tenants.findFirst({
                where: eq(tenants.slug, pathSlug),
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

    // -------------------------------------------------------------
    // Credential Decryption (BYOK)
    // -------------------------------------------------------------
    if (!c.env.ENCRYPTION_SECRET) {
        console.error("Configuration Error: ENCRYPTION_SECRET is missing");
        return c.json({ error: "Server Configuration Error" }, 500);
    }
    const encryption = new EncryptionUtils(c.env.ENCRYPTION_SECRET);

    // 1. Email (Resend)
    let emailApiKey = c.env.RESEND_API_KEY;
    if (tenant.resendCredentials) {
        try {
            const creds = tenant.resendCredentials as any;
            if (creds.apiKey) {
                const decrypted = await encryption.decrypt(creds.apiKey);
                emailApiKey = decrypted;
                c.set('emailApiKey', decrypted);
            }
        } catch (e) {
            console.error("Failed to decrypt Email credentials", e);
        }
    }

    const { UsageService } = await import('../services/pricing');
    const usageService = new UsageService(db, tenant.id);

    // Always provide an EmailService, even if using platform default
    const emailService = new EmailService(emailApiKey || '', tenant as any, { slug: tenant.slug, name: tenant.name }, usageService, !!emailApiKey, db, tenant.id);
    c.set('email', emailService);

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

    const features = await db.query.tenantFeatures.findMany({
        where: and(eq(tenantFeatures.tenantId, tenant.id), eq(tenantFeatures.enabled, true))
    });
    const featureSet = new Set(features.map(f => f.featureKey || ''));
    c.set('features', featureSet);

    // Initial default for 'can' helper
    c.set('can', () => false);

    // 3. Security Check: If User is Authenticated, Verify Membership
    const auth = c.get('auth');

    // Default 'can' helper for unauthenticated or early returns
    c.set('can', () => false);

    // Authentication is required for studio-scoped routes
    if (!auth) {
        // [BYPASS] Some routes might be public but registered under /studios, /locations etc?
        // Actually, if it's in studioPaths, we usually expect a tenant.
        // If it's also in authenticatedPaths, authMiddleware should have caught it.
        // Let's just avoid 500ing.
        return await next();
    }
    let roles: string[] = [];
    let assignedPermissions: string[] = [];
    let isPlatformAdmin = false;

    if (auth && auth.userId) {
        // Global Admin Check (Original User)

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
            // Permissions explicitly assigned to the role assignment (overrides/additions)
            assignedPermissions = rolesResult.flatMap(r => (r.permissions as unknown as string[]) || []);

            // Merge with auth roles if applicable
            if (!isPlatformAdmin || !roles.length || roles.includes('owner')) {
                roles = [...new Set([...roles, ...dbRoles])];
            }
        } else if (isPlatformAdmin) {
            // Synthesize virtual member for platform admins
            const virtualMemberId = `virt_${auth.userId}`;
            c.set('member', {
                id: virtualMemberId,
                tenantId: tenant.id,
                userId: auth.userId,
                status: 'active',
                user: dbUser // Attach the global user object so /me endpoint can see roles/isPlatformAdmin
            });
            if (!roles.includes('owner')) {
                roles.push('owner');
            }
        }

        // --- Final Resolution ---
        c.set('roles', roles);

        // Resolve Custom Permissions
        let customPerms: string[] = [];
        const currentMember = c.get('member');
        if (currentMember) {
            const customRolesResult = await db.select({ permissions: customRoles.permissions })
                .from(memberCustomRoles)
                .innerJoin(customRoles, eq(memberCustomRoles.customRoleId, customRoles.id))
                .where(eq(memberCustomRoles.memberId, currentMember.id))
                .all();

            customPerms = [
                ...assignedPermissions,
                ...customRolesResult.flatMap(r => (r.permissions as any as string[]) || [])
            ];
        }

        const permissions = PermissionService.resolvePermissions(roles, customPerms);
        c.set('permissions', permissions as any as Set<string>);
        c.set('can', (p: string) => PermissionService.can(permissions, p as Permission));

        // --- 2FA Enforcement for Owners ---
        // Requirement: Owners must have MFA enabled/verified.
        // Impersonators are exempted as they are assumed to have satisfied platform-level security.
        if (roles.includes('owner') && !c.get('isImpersonating')) {
            const amr = auth.claims?.amr;
            const hasMfa = (Array.isArray(amr) && (amr.includes('mfa') || amr.includes('otp') || amr.includes('totp'))) || auth.claims?.mfa === true;
            const isDev = (c.env as any).ENVIRONMENT === 'dev' || (c.env as any).ENVIRONMENT === 'development' || (c.env as any).ENVIRONMENT === 'test';

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

    } // End of auth check

    // 4. Lifecycle Checks (Apply to ALL requests, public or private)
    // 4. Lifecycle Checks (Apply to ALL requests, public or private)

    // A. Archives
    if (tenant.status === 'archived' && !isPlatformAdmin) {
        // Archived tenants are offline. Only Platform Admins can access (e.g. to restore).
        return c.json({ error: "This studio has been archived." }, 403);
    }

    // B. Subscription Enforcement
    // We allow Owners/Admins to access even if canceled/past_due (to pay bills or export data).
    // Everyone else (students, public, anon) is blocked.
    const isOwnerOrAdmin = roles.includes('owner') || roles.includes('admin') || isPlatformAdmin;
    const isSubscriptionActive = ['active', 'trialing'].includes(tenant.subscriptionStatus);

    if (!isSubscriptionActive && !isOwnerOrAdmin) {
        if (tenant.subscriptionStatus === 'canceled') {
            return c.json({ error: "This studio's subscription is inactive." }, 403);
        }

        if (tenant.subscriptionStatus === 'past_due') {
            const now = new Date();
            // If grace period is missing or passed, block access
            if (!tenant.gracePeriodEndsAt || new Date(tenant.gracePeriodEndsAt) < now) {
                return c.json({ error: "This studio's subscription is past due." }, 403);
            }
        }
    }

    // C. Manual Disable (Panic Switch)
    if (tenant.studentAccessDisabled && !isPlatformAdmin) {
        // "Student Access Disabled" means the public facing site is down.
        // Owners/Admins (authenticated) can still access.
        // Unauthenticated users (public) should be blocked.
        if (!isOwnerOrAdmin) {
            return c.json({ error: "Student access is currently disabled for this studio." }, 403);
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
        const roles = c.get('roles') || [];
        const isPlatformAdmin = roles.includes('owner'); // Per middleware logic, platform admins are synthesized as owners

        if (!features || (!features.has(featureKey) && !isPlatformAdmin)) {
            return c.json({
                error: `Feature '${featureKey}' is not enabled for this tenant.`,
                featureKey
            }, 403);
        }

        await next();
    };
};
