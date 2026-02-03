import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const isTest = process.env.VITEST === 'true';

export default defineConfig({
    plugins: [
        !isTest && reactRouter(),
        tsconfigPaths(),
    ],
    define: {
        "process.env": {},
    },
    // ... build config ...
    build: {
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
            output: {
                manualChunks: (id) => {
                    if (id.includes('node_modules')) {
                        if (id.includes('livekit')) return 'vendor-livekit';
                        if (id.includes('@puckeditor/core')) return 'vendor-puck';
                        if (id.includes('@sentry')) return 'vendor-sentry';
                        if (id.includes('@radix-ui')) return 'vendor-radix';
                        if (id.includes('recharts')) return 'vendor-charts';
                        if (id.includes('date-fns')) return 'vendor-date-fns';
                    }
                    return undefined;
                },
            },
        },
    },
    test: {
        environment: 'jsdom',
        include: ['app/**/*.test.ts', 'app/**/*.test.tsx'],
        globals: true,
        environmentMatchGlobs: [
            ['**/*.server.test.ts', 'node'],
        ],
    },
});
