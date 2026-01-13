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
                        // Note: Removed vendor-react and vendor-charts to avoid dependency order issues
                    }
                    // Default chunking
                    return undefined;
                },
            },
        },
    },
});
