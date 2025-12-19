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
        // Ideally pass secret key from env, verifyToken usually looks for CLERK_SECRET_KEY in env
        // or we pass it explicitly if we access it via c.env
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
