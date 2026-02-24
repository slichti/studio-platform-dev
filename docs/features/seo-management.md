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
- **Dynamic Schema Factory**: High-level service that generates valid Schema.org JSON-LD for:
    - `LocalBusiness` (Studios)
    - `Event` (Classes)
    - `VideoObject` (VOD Lessons)
- **Streaming Sitemaps**: Dynamic XML generation that streams directly from D1 to the client, supporting deep links for classes and videos.

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
