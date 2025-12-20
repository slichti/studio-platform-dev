# Studio Management Platform

A multi-tenant studio management platform for yoga studios, gyms, and wellness centers.

## Tech Stack

- **Framework**: React Router v7
- **Platform**: Cloudflare Pages & Workers
- **Authentication**: Clerk
- **Database**: Cloudflare D1 (planned/integrated via Verapose patterns)
- **Styling**: Vanilla CSS / Inline styles (for now), aiming for modern UI.

## Getting Started

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Run locally**:
    ```bash
    cd apps/web
    npm run dev
    ```

## Deployment

The application is deployed to Cloudflare Pages.

### Prerequisites

- Cloudflare Account
- Clerk Account (for authentication)

### Environment Variables

You must set the following secrets in your Cloudflare Pages project:

- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

You can set these via the Cloudflare Dashboard or using the CLI:

```bash
npx wrangler pages secret put CLERK_PUBLISHABLE_KEY --project-name studio-platform-web
npx wrangler pages secret put CLERK_SECRET_KEY --project-name studio-platform-web
```

### Deploying

You can deploy using the provided workflow or manually:

```bash
# Workflow (if you are the agent)
/deploy-web

# Manually
cd apps/web
npm run build
npx wrangler pages deploy ./build/client --project-name studio-platform-web
```

## Project Structure

- `apps/web`: The main web application.
  - `app/routes`: Application routes (dashboard, admin, landing page).
  - `functions`: Cloudflare Pages Functions (server-side logic).
- `.agent/workflows`: Automated workflows for the AI assistant.

## Recent Updates

- **Deployment Fixes**: Resolved 500 errors by correctly accessing Cloudflare environment variables in `functions/[[path]].ts`.
- **Landing Page**: Updated with "Modern Studio Management" branding and navigation.
- **Error Handling**: Enhanced logging for missing environment variables.
