---
description: Deploy the web application to Cloudflare Pages
---

> [!IMPORTANT]
> This application requires `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to be set in the Cloudflare Pages project.
> You can set them in the Cloudflare Dashboard under Settings > Environment variables, or via CLI:
> `npx wrangler pages secret put CLERK_PUBLISHABLE_KEY --project-name studio-platform-web`
> `npx wrangler pages secret put CLERK_SECRET_KEY --project-name studio-platform-web`

1. Build the web application
// turbo
```bash
cd apps/web
npm run build
```

2. Deploy to Cloudflare Pages
// turbo
```bash
cd apps/web
npx wrangler pages deploy ./build/client --project-name studio-platform-web
```
