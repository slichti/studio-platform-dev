import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
import { join } from 'path';

export default defineWorkersConfig({
    test: {
        poolOptions: {
            workers: {
                main: './src/index.ts',
                wrangler: { configPath: './wrangler.toml' },
                miniflare: {
                    kvNamespaces: ['KV'],
                    d1Databases: ['DB'],
                    r2Buckets: ['R2'],
                    durableObjects: {
                        RATE_LIMITER: 'RateLimiter',
                        CHAT_ROOM: 'ChatRoom',
                        METRICS: 'Metrics'
                    },
                    bindings: {
                        ENVIRONMENT: 'test',
                        ENCRYPTION_SECRET: 'test-secret-must-be-32-chars-lng',
                        GOOGLE_CLIENT_ID: 'mock-google-id',
                        GOOGLE_CLIENT_SECRET: 'mock-google-secret',
                        STRIPE_SECRET_KEY: 'sk_test_mock',
                        STRIPE_CLIENT_ID: 'ca_mock'
                    },
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
