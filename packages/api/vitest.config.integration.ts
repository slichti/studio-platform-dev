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
                    compatibilityFlags: ['nodejs_compat'],
                },
            },
        },
        alias: {
            'db/src': join(__dirname, '../db/src'),
            'db': join(__dirname, '../db'),
        },
        include: ['**/*.integration.test.ts'],
    },
});
