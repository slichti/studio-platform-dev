# Contributing to Studio Platform

Welcome to the Studio Platform repository! We're excited you're here.

## Getting Started

### Prerequisites

- Node.js (v20+)
- npm (v10+)
- Wrangler CLI (`npm install -g wrangler`)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd studio-platform-dev
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Setup Environment Variables:
   - Copy `.env.example` to `.env` in `packages/api`.
   - Configure `WRANGLER_TOML` if needed.

### Running Locally

We use Turborepo to manage our monorepo.

- **Start all apps**:
  ```bash
  npm run dev
  ```
  - API: http://localhost:8787
  - Web: http://localhost:5173

- **Run specific workspace**:
  ```bash
  npm run dev -w api
  ```

## Testing

### Unit & Integration Tests

We use Vitest for backend testing.

```bash
# Run all tests
npm test

# Run specific integration tests
npm run test:integration packages/api/test/integration/checkout.integration.test.ts
```

### End-to-End Tests

We use Playwright for frontend E2E testing.

```bash
# Install browsers
npx playwright install

# Run E2E tests
npx playwright test
```

## Project Structure

- `apps/web`: React Frontend (Remix/Vite + Cloudflare Pages)
- `apps/mobile`: React Native (Expo) App
- `packages/api`: Backend API (Hono + Cloudflare Workers)
- `packages/db`: Database Schema (Drizzle ORM)
- `packages/emails`: Transactional Emails (react-email)

## Branching Strategy

- `main`: Production-ready code.
- `feat/*`: New features.
- `fix/*`: Bug fixes.

## Conventions

- **Commits**: Follow [Conventional Commits](https://www.conventionalcommits.org/).
- **Linting**: Run `npm run lint` before committing.
