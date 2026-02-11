import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import worker from '../../src/index';

describe('Diagnostics Integration', () => {

    beforeAll(async () => {
        // Manually apply minimal schema using batch() to avoid exec() tooling bugs
        await env.DB.batch([
            env.DB.prepare(`
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id TEXT PRIMARY KEY, 
                    action TEXT, 
                    created_at INTEGER, 
                    details TEXT, 
                    ip_address TEXT,
                    tenant_id TEXT,
                    actor_id TEXT,
                    target_id TEXT,
                    country TEXT,
                    city TEXT,
                    region TEXT
                )
            `),
            env.DB.prepare(`
                CREATE TABLE IF NOT EXISTS tenants (
                    id TEXT PRIMARY KEY,
                    status TEXT
                )
            `)
        ]);
    });

    it('should return 200 OK and database status', async () => {
        const req = new Request('http://localhost/diagnostics', {
            method: 'GET',
            headers: {
                'TEST-AUTH': 'platform_admin' // Mocks authentication
            }
        });

        // Use the worker's fetch handler with the integration environment
        const waitUntils: Promise<any>[] = [];
        const response = await worker.fetch(req, env, {
            waitUntil: (p: Promise<any>) => waitUntils.push(p),
            passThroughOnException: () => { }
        } as any);

        await Promise.all(waitUntils);

        expect(response.status).toBe(200);

        const data: any = await response.json();
        expect(data.status).toBe('ok');
        expect(data.latency).toBeDefined();
        // Since it's a real D1 (empty or not), it should pass or fail gracefully
    });
});
