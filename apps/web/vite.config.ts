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
            external: [],
            output: {
                inlineDynamicImports: false,
            },
        },
    },
    test: {
        environment: 'jsdom',
        include: ['app/**/*.test.ts', 'app/**/*.test.tsx'],
        globals: true,
    },
});
