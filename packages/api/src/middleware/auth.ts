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

        await next();
    } catch (error: any) {
        console.error("Auth Middleware logic error:", error);
        return c.json({ error: "Authentication Error" }, 401);
    }
});
