import type { Config } from "drizzle-kit";

export default {
    schema: "./src/schema.ts",
    out: "./migrations",
    driver: "d1",
    dbCredentials: {
        wranglerConfigPath: "wrangler.toml",
        dbName: "studio-platform-db",
    }
} satisfies Config;
