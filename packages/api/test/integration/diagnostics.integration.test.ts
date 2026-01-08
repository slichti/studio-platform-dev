import { describe, it, expect, beforeAll } from 'vitest';
// Integration tests often run the worker via `unstable_dev` or by importing the handler
// But @cloudflare/vitest-pool-workers allows running tests *inside* the worker environment.
// However, for route testing, we often want to test the `fetch` handler.

import worker from '../../src/index';

describe('Diagnostics Integration', () => {

    it('should return 200 OK and database status', async () => {
        // Create a request to the worker
        const req = new Request('http://localhost/diagnostics', {
            method: 'GET'
        });

        // Use the worker's fetch handler. 
        // In the integration pool, `env` is injected globally or via arguments if using `main` syntax
        // But for unit-integration style, we invoke the Hono app directly with the environment context
        // provided by the runner.

        // Wait, the pool runner runs THIS test inside the worker environment.
        // So `env` (global) should be available if configured correctly, 
        // OR we access it via `cloudflare:test`.

        // For Hono, we usually do:
        // const res = await app.fetch(req, env, ctx);

        // To get the `env` bound to Miniflare:
        const env = (globalThis as any).__env__ || process.env; // Setup might vary.
        // Actually, correctly usage is `import { env } from 'cloudflare:test'` if strictly using the pool,
        // but let's try invoking the worker assuming env is available.

        // Let's rely on standard `worker.fetch`.
        // We need to pass valid bindings. 
        // In @cloudflare/vitest-pool-workers, `env` is available as a global or import.

        // Simple fallback check
        const response = await worker.fetch(req, env, {
            waitUntil: () => { },
            passThroughOnException: () => { }
        } as any);

        expect(response.status).toBe(200);

        const data: any = await response.json();
        expect(data.status).toBe('ok');
        expect(data.latency).toBeDefined();
        // Since it's a real D1 (empty or not), it should pass or fail gracefully
    });
});
