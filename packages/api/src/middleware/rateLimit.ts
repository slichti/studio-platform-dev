
import { createMiddleware } from 'hono/factory';

interface RateLimitOptions {
    limit: number;
    window: number; // seconds
    keyPrefix: string;
}

export const rateLimit = (options: RateLimitOptions) => {
    return createMiddleware(async (c, next) => {
        const ip = c.req.header('CF-Connecting-IP') || 'unknown';
        const key = `${options.keyPrefix}:${ip}`; // Rate limit by IP

        // 1. Get the RateLimiter Durable Object ID
        // We use a fixed ID for the "Global Rate Limiter" instance to ensure all requests hit the same counter (or sharded)
        // For simplicity, we use one global instance ID based on the 'GLOBAL_LIMITER' name.
        const id = c.env.RATE_LIMITER.idFromName('GLOBAL_LIMITER');
        const stub = c.env.RATE_LIMITER.get(id);

        // 2. Call the DO
        try {
            const url = `http://do/limit?key=${encodeURIComponent(key)}&limit=${options.limit}&window=${options.window}`;
            const res = await stub.fetch(url);

            if (res.status === 429) {
                return c.json({ error: "Too Many Requests", retryAfter: options.window }, 429);
            }

            if (!res.ok) {
                console.error("Rate limiter error", await res.text());
                // Fail open? or Fail closed? Fail open for availability.
            }
        } catch (e) {
            console.error("Rate limiter fetch failed", e);
            // Fail open
        }

        await next();
    });
};
