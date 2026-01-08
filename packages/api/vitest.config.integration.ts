import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
import { join } from 'path';

export default defineWorkersConfig({
    test: {
        poolOptions: {
            workers: {
                wrangler: { configPath: './wrangler.toml' },
                miniflare: {
                    // Add any specific miniflare options here if needed, e.g. bindings
                    kvNamespaces: ['KV'],
                    d1Databases: ['DB'],
                    r2Buckets: ['R2'],
                    compatibiltyFlags: ['nodejs_compat'],
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
