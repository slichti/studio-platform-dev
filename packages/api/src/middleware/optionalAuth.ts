import { createMiddleware } from 'hono/factory';
import { verifyToken } from '@clerk/backend';

type AuthVariables = {
    auth: {
        userId: string | null;
        claims: any;
    };
};

export const optionalAuthMiddleware = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    let token: string | undefined;
    const authHeader = c.req.header('Authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (c.req.query('token')) {
        token = c.req.query('token');
    }

    // If no token, just proceed
    if (!token) {
        return await next();
    }

    try {
        // 1. Check for Impersonation Token
        const { verify } = await import('hono/jwt');
        try {
            const payload = await verify(token, (c.env as any).CLERK_SECRET_KEY, 'HS256');
            if (payload.impersonatorId) {
                c.set('auth', {
                    userId: payload.sub as string,
                    claims: payload as any,
                });
                return await next();
            }
        } catch (ignore) {
            // Not a custom token
        }

        // 2. Clerk Verification
        let publicKey = (c.env as any).CLERK_PEM_PUBLIC_KEY;
        if (publicKey) {
            const dirtyKey = publicKey
                .replace(/-----BEGIN PUBLIC KEY-----/g, '')
                .replace(/-----END PUBLIC KEY-----/g, '')
                .replace(/\s+/g, '');
            const chunks = dirtyKey.match(/.{1,64}/g);
            if (chunks) {
                const cleanPublicKey = `-----BEGIN PUBLIC KEY-----\n${chunks.join('\n')}\n-----END PUBLIC KEY-----`;
                try {
                    const payload = await verify(token, cleanPublicKey, 'RS256');
                    c.set('auth', {
                        userId: payload.sub as string,
                        claims: payload as any,
                    });
                } catch (jwtErr) {
                    console.warn("Optional Auth: Invalid Token", jwtErr);
                    // Don't error, just treat as guest
                }
            }
        }

        // Stats update (Async)
        const userId = c.get('auth')?.userId;
        if (userId) {
            c.executionCtx.waitUntil((async () => {
                try {
                    const { createDb } = await import('../db');
                    const { users } = await import('@studio/db/src/schema');
                    const { eq } = await import('drizzle-orm');
                    const db = createDb((c.env as any).DB);
                    await db.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, userId)).run();
                } catch (e) {
                    console.error("Failed to update stats", e);
                }
            })());
        }

        await next();
    } catch (error) {
        // In optional auth, if something blows up, we can likely proceed as guest or log it.
        // But safer to just next() unless it's a 500.
        console.error("Optional Auth Middleware Error", error);
        await next();
    }
});
