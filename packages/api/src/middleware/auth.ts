import { createMiddleware } from 'hono/factory';
import { verifyToken } from '@clerk/backend';
import { verify } from 'hono/jwt';
import { createDb } from '../db';
import { users } from '@studio/db/src/schema'; // Only used in waitUntil
import { eq, sql } from 'drizzle-orm';

import { Bindings, Variables } from '../types';

export const authMiddleware = createMiddleware<{ Variables: Variables, Bindings: Bindings }>(async (c, next) => {
    // If already authenticated (e.g. via API key or previous middleware)
    if (c.get('auth')) return await next();

    let token: string | undefined;
    const authHeader = c.req.header('Authorization');


    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (c.req.header('Upgrade') === 'websocket' && c.req.query('token')) {
        // [WEBSOCKET AUTH] Allow query param token for WS upgrades (browsers can't send headers)
        token = c.req.query('token');
    } else {
        // [CHAT GUEST] Allow WebSocket upgrade for public-site chat with guest ID (no token)
        if (c.req.header('Upgrade')?.toLowerCase() === 'websocket' && c.req.method === 'GET') {
            const userId = c.req.query('userId');
            const tenantSlug = c.req.query('tenantSlug');
            const tenantId = c.req.query('tenantId');
            if (userId && userId.startsWith('guest_') && (tenantSlug || tenantId)) {
                c.set('auth', { userId, claims: { sub: userId, role: 'guest' } });
                c.set('isImpersonating', false);
                return await next();
            }
        }

        // [TEST MOCKING] Allow header bypass in test environment
        if ((c.env as any).ENVIRONMENT === 'test' && c.req.header('TEST-AUTH')) {
            const mockUserId = c.req.header('TEST-AUTH') || 'mock-user';
            c.set('auth', {
                userId: mockUserId,
                claims: { sub: mockUserId, role: 'mock' }
            });
            c.set('isImpersonating', false);
            return await next();
        }

        // Security: Query parameter tokens removed to prevent exposure in logs/history (except for WS Upgrade)
        return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!token) return c.json({ error: 'Unauthorized' }, 401);

    // [E2E BYPASS] Allow raw user IDs in Dev/Test
    // If token starts with 'user_' and we are in dev/test, treat it as the ID.
    const env = (c.env as any).ENVIRONMENT || 'local';
    if (token.startsWith('user_') && ['test', 'dev', 'local'].includes(env)) {
        c.set('auth', { userId: token, claims: { sub: token } });
        // Mock isImpersonating to allow logic that depends on it or strict checks?
        // No, just set auth is enough for standard endpoints.
        c.set('isImpersonating', false);
        return await next();
    }

    try {
        // 0. Decode header to determine strategy (prevent algorithm mismatch errors)
        const { decode } = await import('hono/jwt');
        const { header } = decode(token);

        // 1. Check for Impersonation Token (Custom JWT, HS256)
        if (header.alg === 'HS256') {
            const signingSecret = c.env.IMPERSONATION_SECRET || c.env.CLERK_SECRET_KEY;
            try {
                const payload = await verify(token, signingSecret, 'HS256');
                if (payload.impersonatorId || payload.role === 'guest') {
                    c.set('auth', {
                        userId: payload.sub as string,
                        claims: payload as any,
                    });
                    c.set('isImpersonating', true);
                    return await next();
                }
            } catch (e: any) {
                console.error("Impersonation Token Verification Failed:", e.message);
                return c.json({ error: "Invalid Impersonation Token", details: e.message }, 401);
            }
        }

        // If alg is HS256 but we failed above, we returned.
        // If alg is NOT HS256 (e.g. RS256), we proceed to Clerk verification.


        // 3. Clerk Verification (RS256) using Web Crypto (hono/jwt)
        // Note: verifyToken from @clerk/backend is incompatible with Workers.
        // We use the PEM Public Key provided in environment variables.
        let publicKey = (c.env as any).CLERK_PEM_PUBLIC_KEY;
        if (!publicKey) {
            console.error("Server Configuration Error: Missing Public Key");
            return c.json({ error: "Server Configuration Error" }, 500);
        }

        // SANITIZATION: Aggressive PEM cleanup
        // 1. Remove headers, footers, and ALL whitespace (newlines, spaces, tabs)
        const dirtyKey = publicKey
            .replace(/-----BEGIN PUBLIC KEY-----/g, '')
            .replace(/-----END PUBLIC KEY-----/g, '')
            .replace(/\s+/g, '');

        // 2. Split into 64-character chunks (Standard PEM format)
        const chunks = dirtyKey.match(/.{1,64}/g);

        if (!chunks) {
            console.error("Server Configuration Error: Invalid Public Key Format (Empty)");
            return c.json({ error: "Server Configuration Error: Invalid Key" }, 500);
        }

        // 3. Reconstruct pristine PEM
        const cleanPublicKey = `-----BEGIN PUBLIC KEY-----\n${chunks.join('\n')}\n-----END PUBLIC KEY-----`;

        try {
            // verify() from hono/jwt uses standard Web Crypto API
            // Algorithm is RS256 for Clerk
            const payload = await verify(token, cleanPublicKey, 'RS256');

            c.set('auth', {
                userId: payload.sub as string,
                claims: payload as any,
            });
        } catch (jwtErr: any) {
            console.error("JWT Verification Failed:", jwtErr.message);
            return c.json({ error: "Invalid Token Signature", details: jwtErr.message }, 401);
        }

        // 4. Update Audit / Activity Stats (Throttled)
        const userId = c.get('auth').userId;
        if (userId && (c.env as any).ENVIRONMENT !== 'test') {
            // Using waitUntil to not block response
            c.executionCtx.waitUntil((async () => {
                try {
                    const db = createDb(c.env.DB);
                    const cf = (c.req.raw as any).cf;
                    const location = cf ? {
                        city: cf.city,
                        country: cf.country,
                        region: cf.region,
                        lat: cf.latitude,
                        lng: cf.longitude
                    } : null;

                    await db.update(users)
                        .set({
                            lastActiveAt: new Date(),
                            lastLocation: location
                        })
                        .where(
                            eq(users.id, userId)
                        )
                        .run();
                } catch (e) {
                    console.error("Failed to update stats", e);
                }
            })());
        }

        await next();
    } catch (error: any) {
        console.error("Auth Middleware logic error:", error);
        return c.json({ error: "Authentication Error" }, 401);
    }
});

export const optionalAuthMiddleware = createMiddleware<{ Variables: Variables, Bindings: Bindings }>(async (c, next) => {
    let token: string | undefined;
    const authHeader = c.req.header('Authorization');
    const testAuth = c.req.header('TEST-AUTH');
    const env = (c.env as any).ENVIRONMENT;

    console.log(`[OptionalAuth DEBUG] Path: ${c.req.path}, ENV: ${env}, TEST-AUTH: ${testAuth ? 'PRESENT' : 'MISSING'}`);

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (c.req.query('token')) {
        token = c.req.query('token');
    }

    // [TEST MOCKING] Allow header bypass in test environment
    if (env === 'test' && testAuth) {
        console.log(`[OptionalAuth DEBUG] Applying TEST-AUTH bypass for ${testAuth}`);
        const mockUserId = testAuth;
        c.set('auth', {
            userId: mockUserId,
            claims: { sub: mockUserId, role: 'mock' }
        });
        c.set('isImpersonating', false);
        return await next();
    }

    // If no token, just proceed without setting auth
    if (!token) {
        return await next();
    }

    try {
        // 0. Decode header to determine strategy (prevent algorithm mismatch errors)
        const { decode } = await import('hono/jwt');
        const { header } = decode(token);

        // 1. Check for Impersonation Token (Custom JWT, HS256)
        if (header.alg === 'HS256') {

            // Check implicit secret or explicit IMPERSONATION_SECRET if available on env (cast as any if Bindings not unified yet)
            const secret = (c.env as any).IMPERSONATION_SECRET || (c.env as any).CLERK_SECRET_KEY;
            try {
                const payload = await verify(token, secret, 'HS256');
                if (payload.impersonatorId || payload.role === 'guest') {
                    c.set('auth', {
                        userId: payload.sub as string,
                        claims: payload as any,
                    });
                    c.set('isImpersonating', true);
                    return await next();
                }
            } catch (e) {
                // If it fails verification but claims to be HS256, it's invalid.
                // But since this is optional auth, we just proceed anonymously or log?
                // actually optional auth implies we just continue if auth fails.
            }
        }

        // If alg is HS256 but we failed above (or caught), we fall through.
        // If alg is RS256, we proceed to Clerk.

        // 3. Clerk Verification (RS256)
        let publicKey = (c.env as any).CLERK_PEM_PUBLIC_KEY;
        if (!publicKey) {
            console.error("Server Configuration Error: Missing Public Key");
            return await next();
        }

        const dirtyKey = publicKey
            .replace(/-----BEGIN PUBLIC KEY-----/g, '')
            .replace(/-----END PUBLIC KEY-----/g, '')
            .replace(/\s+/g, '');

        const chunks = dirtyKey.match(/.{1,64}/g);
        if (!chunks) return await next();

        const cleanPublicKey = `-----BEGIN PUBLIC KEY-----\n${chunks.join('\n')}\n-----END PUBLIC KEY-----`;

        try {
            const payload = await verify(token, cleanPublicKey, 'RS256');
            c.set('auth', {
                userId: payload.sub as string,
                claims: payload as any,
            });
        } catch (jwtErr: any) {
            console.error("JWT Verification Failed (Optional):", jwtErr.message);
        }

        await next();
    } catch (error: any) {
        console.error("Optional Auth Middleware logic error:", error);
        await next();
    }
});
