# Studio Platform Web App

## Overview
The Studio Platform frontend is a high-performance web application built with **React Router v7** and deployed to **Cloudflare Pages**. It provides a seamless experience for both studio owners (Dashboard) and students (Portal).

## Key UX & Performance Features

### 1. Zero Layout Shift
We use a centralized `SkeletonLoader` component (located in `app/components/shared`) to maintain layout stability during data transitions. Every core route is optimized to show skeletons before the edge hydration completes.

### 2. Schedule Views: Calendar, Tile, List

- Student and staff schedule views share a unified control bar with **Calendar / Tile / List** toggles and a **Show previous** checkbox.
- **Calendar**: Week/day/month calendar with event-colors toggle and configurable visible hours.
- **Tile**: Card-based class grid grouped by day, optimized for discovery and booking actions.
- **List**: Compact list view grouped into **Today**, **Tomorrow**, and then weekday sections, with instructor avatars, modality (in-person / virtual / hybrid), location, and duration.
- Admins get a single **Bulk Operations** modal (schedule, reschedule, cancel) that powers high-volume schedule management.

### 3. Infinite Scroll & Pagination
To ensure fast load times even for studios with thousands of sessions, we implement:
- **Admin Pages**: Paginated fetching with "Load More" capability via TanStack Query.
- **Student Portal**: Continuous class listing with chunked data fetching.

### 4. Aggressive Code Splitting
Heavy visualization and utility libraries are excluded from the main bundle:
- **Charts**: `recharts` is loaded dynamically only on analytics pages.
- **Diagrams**: `mermaid` is code-split for documentation views.
- **Icons**: Icons are imported as individual sub-components to prevent SVG bloat.

## Development

### Prerequisites
- Node.js 18+
- Wrangler CLI

### Commands
- `npm run dev`: Start the development server.
- `npm run build`: Build for production.
- `npm run typecheck`: Run TypeScript validation.
- `npm run test`: Run unit tests.

## Deployment
Deployed via Cloudflare Pages. See root `README.md` for deployment commands.
