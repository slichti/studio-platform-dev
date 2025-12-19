import { createMiddleware } from 'hono/factory';
import { verifyToken } from '@clerk/backend';

type AuthVariables = {
    auth: {
        userId: string | null;
        claims: any;
    };
};

export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.split(' ')[1];

    try {
        // 1. Check for Impersonation Token (Custom JWT, HS256)
        // We use dynamic import or assume hono/jwt is available
        const { verify } = await import('hono/jwt');
        try {
            const payload = await verify(token, (c.env as any).CLERK_SECRET_KEY);
            if (payload.impersonatorId) {
                c.set('auth', {
                    userId: payload.sub as string,
                    claims: payload as any,
                });
                return await next();
            }
        } catch (ignore) {
            // Not a custom token, proceed to Clerk
        }

        // 2. Clerk Verification (RS256)
        const verified = await verifyToken(token, {
            secretKey: (c.env as any).CLERK_SECRET_KEY,
        });

        c.set('auth', {
            userId: verified.sub,
            claims: verified,
        });

        await next();
    } catch (error) {
        console.error("Auth error:", error);
        return c.json({ error: 'Unauthorized' }, 401);
    }
});
