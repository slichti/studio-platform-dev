/**
 * Public health endpoint: no auth, returns 200 when DB is up and 503 when DB check fails.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { setupTestDb } from './test-utils';

describe('Health endpoint', () => {
    beforeAll(async () => {
        await setupTestDb(env.DB);
    });

    it('GET /health returns 200 and status ok when DB is available', async () => {
        const res = await SELF.fetch(new Request('http://localhost/health', { method: 'GET' }));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toHaveProperty('status', 'ok');
        expect(body).toHaveProperty('db', 'ok');
    });
});
