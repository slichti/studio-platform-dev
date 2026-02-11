import { Context, Next } from 'hono';

export const cacheMiddleware = (options: { maxAge: number, staleWhileRevalidate?: number }) => {
    return async (c: Context, next: Next) => {
        // Only cache GET requests
        if (c.req.method !== 'GET') {
            await next();
            return;
        }

        // Check if Cache API is available (Cloudflare Workers)
        if (typeof caches === 'undefined' || !(caches as any).default) {
            await next();
            return;
        }

        const cache = (caches as any).default;
        // Use full URL as key
        const url = new URL(c.req.url);
        const key = new Request(url.toString(), c.req.raw);

        let cachedResponse = undefined;
        try {
            cachedResponse = await cache.match(key);
        } catch (e) {
            console.warn("[Cache] Failed to match:", e);
        }

        if (cachedResponse) {
            console.log(`[Cache] HIT: ${c.req.url}`);
            // Return cached response
            return new Response(cachedResponse.body, cachedResponse);
        }

        console.log(`[Cache] MISS: ${c.req.url}`);
        await next();

        // Cache the response if successful
        if (c.res.status === 200) {
            const response = c.res.clone();
            const stale = options.staleWhileRevalidate ? `, stale-while-revalidate=${options.staleWhileRevalidate}` : '';
            response.headers.set('Cache-Control', `public, max-age=${options.maxAge}${stale}`);

            try {
                c.executionCtx.waitUntil(cache.put(key, response));
            } catch (e) {
                console.error("[Cache] Failed to put:", e);
            }
        }
    };
};
