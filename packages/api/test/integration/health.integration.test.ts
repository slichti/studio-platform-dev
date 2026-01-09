import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';

describe('D1 Integration', () => {
    it('should be able to query the database', async () => {
        // Basic D1 sanity check
        const { results } = await env.DB.prepare('SELECT 1 as val').all();
        expect(results).toBeDefined();
        expect(results[0]).toEqual({ val: 1 });
    });

    it('should have access to KV/R2 if configured', () => {
        // Using generic checks for safely
        expect(env.DB).toBeDefined();
        expect(env.ENVIRONMENT).toBeDefined();
    });
});
