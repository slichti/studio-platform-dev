import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
        globals: true,
        alias: {
            '@studio/db/src': path.resolve(__dirname, '../db/src'),
            '@studio/db': path.resolve(__dirname, '../db'),
            '@studio/emails': path.resolve(__dirname, '../emails/src/index.ts'),
        },
    },
});
