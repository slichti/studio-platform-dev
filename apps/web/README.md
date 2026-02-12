# Studio Platform Web App

## Overview
The Studio Platform frontend is a high-performance web application built with **React Router v7** and deployed to **Cloudflare Pages**. It provides a seamless experience for both studio owners (Dashboard) and students (Portal).

## Performance Features

### 1. Zero Layout Shift
We use a centralized `SkeletonLoader` component (located in `app/components/shared`) to maintain layout stability during data transitions. Every core route is optimized to show skeletons before the edge hydration completes.

### 2. Infinite Scroll & Pagination
To ensure fast load times even for studios with thousands of sessions, we implement:
- **Admin Pages**: Paginated fetching with "Load More" capability via TanStack Query.
- **Student Portal**: Continuous class listing with chunked data fetching.

### 3. Aggressive Code Splitting
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
