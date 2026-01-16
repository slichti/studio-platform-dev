---
description: How to deploy the web application to Cloudflare Pages
---
1.  **Build the application:**
    Run from the root directory:
    ```bash
    npm run build
    ```
    (This runs `turbo run build`, ensuring all packages including `api` and `web` are built).

2.  **Deploy the web app:**
    Run the deployment command from within the `apps/web` directory or using the workspace script.
    **Option A (Recommended):**
    ```bash
    npm run deploy -w web
    ```
    
    **Option B (Manual):**
    ```bash
    cd apps/web
    npx wrangler pages deploy ./build/client --project-name studio-platform-web
    ```

    > **Important:** Running this from the `apps/web` directory is critical so that Cloudflare Wrangler detects the `functions/` directory for Server-Side Rendering.

3.  **Deploy the API (if changed):**
    ```bash
    npm run deploy:api
    ```
    (Or `cd packages/api && npm run deploy`)
