import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
import { join } from 'path';

export default defineWorkersConfig({
    test: {
        poolOptions: {
            workers: {
                wrangler: { configPath: './wrangler.toml' },
                miniflare: {
                    kvNamespaces: ['KV'],
                    d1Databases: ['DB'],
                    r2Buckets: ['R2'],
                    durableObjects: { RATE_LIMITER: 'RateLimiter' },
                    bindings: { ENVIRONMENT: 'test', ENCRYPTION_SECRET: 'test-secret-must-be-32-chars-lng' },
                    compatibilityFlags: ['nodejs_compat'],
                },
            },
        },
        alias: {
            '@studio/db/src': join(__dirname, '../db/src'),
            '@studio/db': join(__dirname, '../db'),
            '@studio/emails': join(__dirname, '../emails/src'),
        },
        include: ['**/*.integration.test.ts'],
        setupFiles: ['./test/setup-integration.ts'],
        fileParallelism: false,
        maxWorkers: 1,
    },
});
