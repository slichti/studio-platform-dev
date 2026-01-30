
import { DurableObject } from "cloudflare:workers";

interface RateLimitConfig {
    limit: number;
    window: number; // in seconds
}

export class RateLimiter extends DurableObject {
    private counters: Map<string, { count: number; expiresAt: number }> = new Map();
    private garbageCollectInterval: number | null = null;

    constructor(state: DurableObjectState, env: any) {
        super(state, env);
        // Load state from storage if needed, but for rate limiting, 
        // in-memory with occasional persistence or just ephemeral is usually fine 
        // if we accept reset on deploy. 
        // For strictness, we can use storage.
        this.ctx.blockConcurrencyWhile(async () => {
            // Optional: Restore from storage if we persistent counters
            // For now, in-memory is fast and sufficient for "leaky bucket" style
        });
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        const key = url.searchParams.get("key");
        const limitStr = url.searchParams.get("limit");
        const windowStr = url.searchParams.get("window");
        const costStr = url.searchParams.get("cost") || "1";

        if (!key || !limitStr || !windowStr) {
            return new Response("Missing parameters", { status: 400 });
        }

        const limit = parseInt(limitStr);
        const windowSeconds = parseInt(windowStr);
        const cost = parseInt(costStr);
        const now = Date.now();

        let entry = this.counters.get(key);

        // Check expiry
        if (entry && now > entry.expiresAt) {
            entry = undefined;
            this.counters.delete(key);
        }

        if (!entry) {
            entry = { count: cost, expiresAt: now + (windowSeconds * 1000) };
            this.counters.set(key, entry);
            return new Response(JSON.stringify({ allowed: true, remaining: limit - cost }), { status: 200 });
        }

        if (entry.count + cost > limit) {
            return new Response(JSON.stringify({ allowed: false, remaining: limit - entry.count }), { status: 429 });
        }

        entry.count += cost;
        return new Response(JSON.stringify({ allowed: true, remaining: limit - entry.count }), { status: 200 });
    }

    async alarm() {
        // Cleanup expired keys
        const now = Date.now();
        for (const [key, entry] of this.counters) {
            if (now > entry.expiresAt) {
                this.counters.delete(key);
            }
        }
    }
}
