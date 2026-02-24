# SEO-PROGRESS.md: Tiered Implementation Roadmap
The following structure defines the progress tracking for the SEO feature rollout.

## Tier 1: Technical Foundation and Crawlability
The objective of Tier 1 is to ensure the platform is fundamentally "Search Ready" by establishing the edge-routing logic and sitemap infrastructure.

| Task ID | Component | Description | Status |
|---|---|---|---|
| T1.1 | Edge Routing | Implement subdirectory routing logic in Cloudflare Workers | Completed |
| T1.2 | HTMLRewriter | Build metadata injection middleware for dynamic `<title>` and `<meta>` | Completed |
| T1.3 | Streamed Sitemap | Deploy `/sitemap.xml` route using memory-efficient D1 streaming | Completed |
| T1.4 | Caching API | Integrate Cloudflare Cache API for sitemaps and metadata | Completed |
| T1.5 | Tier Flags | Implement tier-based access control for basic SEO tools | Completed |

## Tier 2: Search Visibility and Local Integration
Tier 2 focuses on active communication with search engines and the establishment of local ranking signals.

| Task ID | Component | Description | Status |
|---|---|---|---|
| T2.1 | GBP OAuth | Implement 'Connect to Google' flow for tenants | Completed |
| T2.2 | NAP Sync | Automate business hour and location updates to Google Maps | Completed |
| T2.3 | Indexing Queue| Build Cloudflare Queue for Google Indexing API submissions | Completed |
| T2.4 | Schema Factory| Automate LocalBusiness and Event schema generation | Completed |
| T2.5 | Review Engine | Trigger Google Review prompts via class check-in data | Completed |

## Tier 3: Advanced Automation and Competitive Dominance
Tier 3 introduces high-level AI features and deep integration with the LMS and Video modules to secure top-tier rankings.

| Task ID | Component | Description | Status |
|---|---|---|---|
| T3.1 | AI Meta-Gen | Dynamic meta descriptions using class descriptions | Completed |
| T3.2 | Video Schema | VideoObject schema for on-demand videos | Completed |
| T3.3 | Multi-Loc SEO| Sub-sitemaps for multi-studio tenants | Completed |
| T3.4 | Review AI | Generate draft responses for Google Reviews using tenant context | Pending |
| T3.5 | Local Pages | Programmatic generation of neighborhood-specific landing pages | Pending |
| T3.6 | SEO Dashboard | Tenant-facing ranking and visibility metrics (via SE Ranking API) | Pending |
