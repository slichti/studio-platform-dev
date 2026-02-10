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
    ssr: {
        external: [
            "mermaid",
            "recharts",
            "@livekit/components-react",
            "@livekit/components-styles",
            "@puckeditor/core",
            "@sentry/react",
            "lucide-react",
            "date-fns"
        ],
    },
    // ... build config ...
    build: {
        minify: true,
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
            external: [
                "mermaid",
                "recharts",
                "@livekit/components-react",
                "@livekit/components-styles",
                "@puckeditor/core",
                "@sentry/react",
                "lucide-react",
                "date-fns"
            ],
            output: {
                inlineDynamicImports: false,
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
