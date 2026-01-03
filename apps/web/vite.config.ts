import { reactRouter } from "@react-router/dev/vite";
import cloudflare from "@react-router/dev/vite/cloudflare";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
    plugins: [
        reactRouter({
            adapter: cloudflare
        }),
        tsconfigPaths(),
    ],
    define: {
        "process.env": {},
    },
});
