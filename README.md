# Studio Platform

The modern, all-in-one platform for dance, yoga, and fitness studios.

## Features

*   **Studio Management:** Class scheduling, member management, and point-of-sale.
*   **Website Builder:** Drag-and-drop website editor with custom domains.
*   **Student App:** Mobile app for students to book classes and manage their accounts.
*   **Automations:** Powerful email and SMS marketing automations with trigger events (Birthday, Absent, Trial Ending, etc).
*   **QR Codes:** Generate tracking-ready QR codes for check-in, app downloads, and marketing.
*   **High Performance Edge:** Sub-50ms latency for core operations via Cloudflare Workers and D1 batching.

## Development

### Prerequisites

*   Node.js 18+
*   NPM
*   Cloudflare Wrangler

### Getting Started

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Run Development Server:**
    ```bash
    npm run dev
    ```

3.  **Deploy Web App:**
    ```bash
    npm run deploy -w web
    ```

## Disaster Recovery

The platform includes automated daily database backups:
- **Schedule:** Daily at 2 AM UTC
- **Storage:** Cloudflare R2 (90-day retention)
- **Recovery:** See [docs/disaster-recovery.md](docs/disaster-recovery.md)

## Architecture

See [docs/architecture.md](docs/architecture.md) for detailed system architecture.
