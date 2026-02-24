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

Owners can customize SEO settings via the Studio Admin Dashboard under **Settings > SEO**.
- **Default Meta Description**: Fallback description for the studio.
- **Keywords**: Comma-separated list for legacy search support.
- **Review Prompt Link**: The Google Maps direct review URL.
