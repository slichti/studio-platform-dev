import { createMiddleware } from 'hono/factory';
import { verifyToken } from '@clerk/backend';
import { verify } from 'hono/jwt';
import { createDb } from '../db';
import { users } from 'db/src/schema'; // Only used in waitUntil
import { eq, sql } from 'drizzle-orm';

type AuthVariables = {
    auth: {
        userId: string | null;
        claims: any;
    };
    tenantId?: string;
    isImpersonating?: boolean;
};

type Bindings = {
    DB: D1Database;
    CLERK_SECRET_KEY: string;
    CLERK_PEM_PUBLIC_KEY: string;
    IMPERSONATION_SECRET?: string;
};

export const authMiddleware = createMiddleware<{ Variables: AuthVariables, Bindings: Bindings }>(async (c, next) => {
    let token: string | undefined;
    const authHeader = c.req.header('Authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else {
        // Security: Query parameter tokens removed to prevent exposure in logs/history
        return c.json({ error: 'Unauthorized' }, 401);
    }

    if (!token) return c.json({ error: 'Unauthorized' }, 401);

    try {
        // 1. Check for Impersonation Token (Custom JWT, HS256)
        // We prioritize IMPERSONATION_SECRET but fallback to CLERK_SECRET_KEY for backward compatibility
        const signingSecret = c.env.IMPERSONATION_SECRET || c.env.CLERK_SECRET_KEY;
        try {
            // Updated to pass 'HS256' explicit algorithm if required by Hono types, or just check signature
            // verify(token, secret, alg)
            const payload = await verify(token, signingSecret, 'HS256');
            if (payload.impersonatorId || payload.role === 'guest') {
                c.set('auth', {
                    userId: payload.sub as string,
                    claims: payload as any,
                });
                // Flag as impersonated/guest session
                c.set('isImpersonating', true);
                return await next();
            }
        } catch (ignore) {
            // Not a custom token, proceed to Clerk
        }

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
        if (userId) {
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

export const optionalAuthMiddleware = createMiddleware<{ Variables: AuthVariables, Bindings: Bindings }>(async (c, next) => {
    let token: string | undefined;
    const authHeader = c.req.header('Authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (c.req.query('token')) {
        token = c.req.query('token');
    }

    // If no token, just proceed without setting auth
    if (!token) {
        return await next();
    }

    try {
        // 1. Check for Impersonation Token (Custom JWT, HS256)
        // We use dynamic import or assume hono/jwt is available
        try {
            // Check implicit secret or explicit IMPERSONATION_SECRET if available on env (cast as any if Bindings not unified yet)
            const secret = (c.env as any).IMPERSONATION_SECRET || (c.env as any).CLERK_SECRET_KEY;
            const payload = await verify(token, secret, 'HS256');
            if (payload.impersonatorId || payload.role === 'guest') {
                c.set('auth', {
                    userId: payload.sub as string,
                    claims: payload as any,
                });
                c.set('isImpersonating', true);
                return await next();
            }
        } catch (ignore) { }

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
