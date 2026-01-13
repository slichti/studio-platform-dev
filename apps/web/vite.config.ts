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
                        // Recharts and D3 (charts)
                        if (id.includes('recharts') || id.includes('d3-')) {
                            return 'vendor-charts';
                        }
                        // LiveKit (video)
                        if (id.includes('livekit')) {
                            return 'vendor-livekit';
                        }
                        // Puck editor
                        if (id.includes('@measured/puck')) {
                            return 'vendor-puck';
                        }
                        // Sentry
                        if (id.includes('@sentry')) {
                            return 'vendor-sentry';
                        }
                        // React core - keep together
                        if (id.includes('react') || id.includes('react-dom')) {
                            return 'vendor-react';
                        }
                    }
                    // Default chunking
                    return undefined;
                },
            },
        },
    },
});
