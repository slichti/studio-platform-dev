
import { Context, Next } from 'hono';

export const rateLimitMiddleware = (limit: number = 300, window: number = 60) => {
    return async (c: Context, next: Next) => {
        // Skip for OPTIONS (CORS preflight)
        if (c.req.method === 'OPTIONS') {
            await next();
            return;
        }

        const ip = c.req.header('CF-Connecting-IP') || '127.0.0.1';
        const key = `ip:${ip}`;

        // Get RateLimiter Stub
        // We use a single global instance for simplicity. For higher scale, we could shard by IP prefix.
        const doId = c.env.RATE_LIMITER.idFromName('global');
        const stub = c.env.RATE_LIMITER.get(doId);

        try {
            const res = await stub.fetch(`http://do/?key=${key}&limit=${limit}&window=${window}`);

            if (res.status === 429) {
                return c.json({ error: 'Too Many Requests' }, 429);
            }

            // Optional: Set headers
            // c.header('X-RateLimit-Limit', String(limit));
            // c.header('X-RateLimit-Remaining', ...);
        } catch (e) {
            console.error("Rate limit check failed", e);
            // Fail open to avoid blocking legitimate traffic on error
        }

        await next();
    };
};
