import { defineConfig } from "drizzle-kit";

export default defineConfig({
    schema: "./src/schema.ts",
    out: "../api/migrations",
    dialect: "sqlite"
});
// actually, for just "generate", we don't need dbCredentials if we aren't introspecting.
// Let's stick to simple config for generation.
// Old config used wranglerConfigPath. Newer one might support it or not. 
// "drizzle-kit generate" only needs schema and out for sqlite. 

