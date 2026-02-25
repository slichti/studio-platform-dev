# SEO Management System

The Studio Platform features a high-performance, edge-optimized SEO infrastructure designed to give tenants maximum search visibility with zero manual effort.

## Architecture

The system operates across three tiers:

### Tier 1: Core Visibility
- **HTML Rewriter**: An edge-based middleware that dynamically injects `<title>` and `<meta>` tags into the SSR response from Cloudflare Pages.
- **Tenant Context**: Automatic detection of studio identity via subdomains or `X-Tenant-Slug` headers.

### Tier 2: Local Search Dominance
- **Google Business Profile (GBP)**:
    - Secure OAuth flow for studio owners to link their GBP.
    - Automated NAP (Name, Address, Phone) synchronisation.
    - Review Engine: Dispatches review prompts to students after they attend a class.
- **Google Indexing API**:
    - Real-time notification of new or updated pages.
    - Orchestrated via Cloudflare Queues (`seo-indexing-queue`) to handle high-volume class schedule updates.

### Tier 3: Advanced Automation
- **LMS SEO**: Automatic `VideoObject` schema generation for on-demand videos, including thumbnail locations and duration.
- **Dynamic Schema Factory**: High-level service that generates valid Schema.org JSON-LD for `LocalBusiness`, `Event`, and `VideoObject`.
- **Streaming Sitemaps**: Dynamic XML generation that streams directly from D1 to the client.

### Tier 4: Local Dominance & Insights
- **Local Landing Pages**: Automated generation of SEO-optimized public pages for studio locations (e.g., `/site/:slug`).
- **SEO Analytics**: Real-time tracking of search visibility and local rankings surfaced in the Studio Dashboard.

### Tier 5: Platform SEO Intelligence
- **Governance Dashboard**: Centralized platform-wide monitoring of sitemap health, indexing queues, and GBP sync failures.
- **Validation Engine**: Automated health checks for tenant sitemaps and NAP consistency across the platform.

### Tier 6: Growth & Funnel Optimization
- **Active Management**: Capability for platform admins to override tenant SEO configs and toggle indexing/GBP features.
- **Strategic Guidance**: Built-in recommendations and strategy overlays to help studio owners optimize their local search presence.

### Tier 7: SEO Content Automation (Local Blogging)
- **AI-Powered Blogging**: Automated generation of location-specific blog posts using Gemini AI, based on global SEO topics.
- **Cross-Platform Syndication**: Blog posts are automatically distributed to the Marketing Site (Public), Student Portal (Engaged), and Mobile App (On-the-go).
- **Structured Data**: Automatic injection of `BlogPosting` schema to maximize organic reach for studio locations.

### Review AI (T3.4) & Crawl Controls
- **Review AI**: Per-review AI draft replies for Google Reviews via Gemini (`GeminiService.generateReviewReplyDraft`). Stored in `reviews.reply_draft` / `reviews.reply_draft_generated_at`. Studio Reviews page: Generate / Edit / Copy / Clear. API: `POST /reviews/:id/draft-reply`, `PATCH /reviews/:id/reply-draft`. Requires `GEMINI_API_KEY`.
- **Per-tenant robots.txt**: Platform serves `GET /public/robots.txt` with safe defaults (Disallow: /admin, /studio, /sign-in, etc.) plus per-tenant `Disallow: /studios/<slug><path>` for each path in `tenant.settings.seo.robotsDisallow`. Web app `robots.txt` loader fetches from API with fallback. Tenants configure "Paths to hide from search engines" in **Settings → SEO** (one path per line, e.g. `/draft`, `/preview`).
- **LLM / GEO Snapshot**: `GET /aggregators/llm-snapshot` returns a machine-readable JSON profile per tenant (studio info + up to 25 upcoming classes with booking URLs) for external LLMs and GEO visibility.
- **SEO safety rails**: Tenant SEO UI validates at least one of title or description; warns when title > 60 or description > 155 characters; Save disabled when both fields empty.

### Phase 8: Strategic Polish & AI Enrichment
- **Localized Strategy Guidance**: Built-in strategy overlays on the Admin Dashboard to guide internal staff on governing platform SEO.
- **Competitive Ranking**: Real-time tracking of keyword performance against local competitors for each studio.
- **AI-Generated Imagery**: Automated blogs are enriched with aesthetic AI-generated images based on the blog content.
- **Automated Re-engagement**: Push notifications are automatically dispatched to studio members whenever new localized content is published.

## Database Integration

SEO configuration is stored in the `tenants` table:
- `seoConfig`: JSON blob containing default descriptions, keywords, and Google API preferences.
- `gbpToken`: Encrypted OAuth credentials for Google Business Profile.

Videos and classes are enriched with SEO metadata:
- `videos` table: `posterUrl` and `tags` (JSON) are used to populate `VideoObject` schema.

## Performance

- **Zero-Latency Injection**: HTMLRewriter processes tags on the stream, ensuring no measurable delay to Time to First Byte (TTFB).
- **Batch Indexing**: The indexing queue batches updates to minimize API usage and stay within Google's rate limits.
- **Cached Sitemaps**: Sitemaps are cached at the edge with a 1-hour TTL, but can be invalidated on schedule changes.

## Configuration

Owners can customize SEO settings via the Studio Admin Dashboard under **Settings → SEO & Discoverability**.
- **Default Meta Title & Description**: Fallback for search results and social shares; validation warns on empty or over-length.
- **Local Service Area (City)**: Used for local search and meta (e.g. "Yoga Studio in Ann Arbor").
- **Paths to hide from search engines**: Optional list of paths (e.g. `/draft`, `/preview`) added as `Disallow: /studios/<slug><path>` in the global robots.txt.
- **Review Prompt Link**: The Google Maps direct review URL (in tenant SEO/GBP config). Use **Marketing → Reviews** for Review AI draft replies.
