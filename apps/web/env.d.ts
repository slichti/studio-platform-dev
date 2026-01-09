/// <reference types="vite/client" />
/// <reference types="@cloudflare/workers-types" />

import "react-router";

interface Env {
    CLERK_PUBLISHABLE_KEY: string;
    CLERK_SECRET_KEY: string;
    ENVIRONMENT: string;
}

declare module "react-router" {
    interface AppLoadContext {
        env: Env;
    }
}
