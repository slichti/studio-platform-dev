import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
    plugins: [
        reactRouter(),
        tsconfigPaths(),
    ],
    define: {
        "process.env": {},
    },
    build: {
        chunkSizeWarningLimit: 1000, // Increase warning limit to 1MB
        rollupOptions: {
            output: {
                manualChunks: (id) => {
                    // Split heavy vendor libraries into separate chunks
                    if (id.includes('node_modules')) {
                        // LiveKit (video) - large, rarely used
                        if (id.includes('livekit')) {
                            return 'vendor-livekit';
                        }
                        // Puck editor - only used in website editor
                        if (id.includes('@measured/puck')) {
                            return 'vendor-puck';
                        }
                        // Sentry - only for error tracking
                        if (id.includes('@sentry')) {
                            return 'vendor-sentry';
                        }
                        // UI Framework - Radix
                        if (id.includes('@radix-ui')) {
                            return 'vendor-radix';
                        }
                        // Charts
                        if (id.includes('recharts')) {
                            return 'vendor-charts';
                        }
                        // Date handling
                        if (id.includes('date-fns')) {
                            return 'vendor-date-fns';
                        }
                    }
                    // Default chunking
                    return undefined;
                },
            },
        },
    },
    test: {
        environment: 'node',
        include: ['app/**/*.test.ts', 'app/**/*.test.tsx'],
        globals: true,
    },
});
