# Studio Management Platform

A multi-tenant studio management platform for yoga studios, gyms, and wellness centers.

## Tech Stack

- **Frontend**: React Router v7, Tailwind CSS
- **Backend**: Cloudflare Workers (Hono), Cloudflare Pages
- **Database**: Cloudflare D1 (via Drizzle ORM)
- **Authentication**: Clerk
- **Payments**: Stripe Connect & Stripe Billing
- **Email**: Resend
- **Storage**: Cloudflare R2 (for uploads/waivers)

## Getting Started

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Run locally**:
    ```bash
    # Run the Turbo repo dev command (starts web + api)
    npm run dev
    ```

## Project Structure

- `apps/web`: The main web application (React Router v7).
- `packages/api`: The backend API (Hono Worker).
- `packages/db`: Drizzle ORM schema and database configuration.
- `.agent/workflows`: Automated workflows for the AI assistant.

## Features

- **Multi-Tenancy**: Studio-specific subdomains/slugs.
- **Membership Management**: Plans, subscriptions, and billing.
- **Class Scheduling**: Recurring series, substitution management, and bookings.
- **Point of Sale (POS)**: Retail, inventory, and gift cards.
- **Financials**: Payroll configuration and history.
- **Marketing**: Email broadcasts with audience targeting.
- **Waivers**: Digital signing (mobile-optimized) and PDF generation.

## Recent Updates

- **Email Verification**: Enforced verification for studio creation.
- **Member Invitations**: Secure email invitation flow for adding students.
- **Marketing**: Integrated `EmailService` for real broadcast delivery.
- **Payroll**: Added configuration and payout history.
- **Gift Cards**: Full wallet, redemption, and history implementation.

