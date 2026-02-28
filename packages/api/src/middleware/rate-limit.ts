
import { Context, Next } from 'hono';
import { createDb } from '../db';
import { auditLogs } from '@studio/db/src/schema';

export type RateLimitOptions = {
    limit?: number;
    window?: number;
    cost?: number;
    keyPrefix?: string;
};

export const rateLimitMiddleware = (options: RateLimitOptions = {}) => {
    const { limit: defaultLimit = 300, window = 60, cost = 1, keyPrefix } = options;
    return async (c: Context, next: Next) => {
        // Skip for OPTIONS (CORS preflight)
        if (c.req.method === 'OPTIONS') {
            await next();
            return;
        }

        let key = '';
        let actorId = 'anonymous';
        let limit = defaultLimit;

        // Dynamic Limit based on Tenant Tier
        // Tenant context might be set by previous middleware (tenantMiddleware)
        const tenant = c.get('tenant');
        if (tenant) {
            // Apply Multipliers
            if (tenant.tier === 'scale') limit = defaultLimit * 10;
            else if (tenant.tier === 'growth') limit = defaultLimit * 5;
            // Basic/Free = 1x

            // Scope key to tenant if available? 
            // Usually we want to rate limit the USER accessing the tenant, so user:id is still best.
            // But if we want to limit the TENANT's total throughput, that's different.
            // For now, we keep user-based limits but scale the allowance based on the tenant they are accessing.
        }

        // 1. Try to get Authenticated User ID (if auth middleware ran before this)
        const auth = c.get('auth');
        if (auth?.userId) {
            key = `user:${auth.userId}`;
            actorId = auth.userId;
        } else {
            // 2. Try to fingerprint via Header/Cookie (without validating) to handle NATs
            const authHeader = c.req.header('Authorization');
            if (authHeader) {
                // Use hash of token to group requests
                const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(authHeader));
                const hashArray = Array.from(new Uint8Array(hash));
                const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                key = `token:${hashHex}`;
            } else {
                // 3. Fallback to IP
                const ip = c.req.header('CF-Connecting-IP') || '127.0.0.1';
                key = `ip:${ip}`;
            }
        }

        if (keyPrefix) {
            key = `${keyPrefix}:${key}`;
        }

        // Get RateLimiter Stub
        // [TEST ENVIRONMENT BYPASS]
        if ((c.env as any).ENVIRONMENT === 'test' || (c.env as any).ENVIRONMENT === 'dev') {
            await next();
            return;
        }

        // Sharding Strategy:
        // 1. If tenant is present, shard by tenant ID (isolates tenants)
        // 2. Otherwise shard into 32 buckets for anonymous traffic to distribute load
        let shardKey = 'global';
        if (tenant?.id) {
            shardKey = `tenant:${tenant.id}`;
        } else {
            // Use a chunk of the key's hash for sharding (32 buckets)
            const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const bucket = hashArray[0] % 32;
            shardKey = `anon-shard-${bucket}`;
        }

        const doId = c.env.RATE_LIMITER.idFromName(shardKey);
        const stub = c.env.RATE_LIMITER.get(doId);

        try {
            const res = await stub.fetch(`http://do/?key=${key}&limit=${limit}&window=${window}&cost=${cost}`);
            const data: any = await res.json();

            // Set Headers
            c.header('X-RateLimit-Limit', limit.toString());
            c.header('X-RateLimit-Remaining', (data.remaining || 0).toString());
            c.header('X-RateLimit-Reset', (data.reset || 0).toString());

            if (res.status === 429) {
                // [TRACKING] Log blocked request to Audit Logs
                c.executionCtx.waitUntil((async () => {
                    try {
                        const db = createDb(c.env.DB);
                        await db.insert(auditLogs).values({
                            id: crypto.randomUUID(),
                            action: 'rate_limit_exceeded',
                            actorId: actorId !== 'anonymous' ? actorId : null,
                            ipAddress: c.req.header('CF-Connecting-IP'),
                            details: {
                                path: c.req.path,
                                method: c.req.method,
                                key: key,
                                limit,
                                window,
                                tenantId: tenant?.id
                            }
                        }).run();
                    } catch (err) {
                        console.error('Failed to log rate limit event', err);
                    }
                })());

                return c.json({ error: 'Too Many Requests' }, 429);
            }
        } catch (e) {
            console.error("Rate limit check failed", e);
            // Fail open
        }

        await next();
    };
};
