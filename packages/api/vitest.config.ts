import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts', 'src/**/*.bench.ts'],
        globals: true,
        alias: {
            'db/src': path.resolve(__dirname, '../db/src'),
            'db': path.resolve(__dirname, '../db'),
        },
    },
});
