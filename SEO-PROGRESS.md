# SEO-PROGRESS.md: Tiered Implementation Roadmap
The following structure defines the progress tracking for the SEO feature rollout. Full feature spec and configuration details: **docs/features/seo-management.md**.

## T3.4 Review AI — Implementation Log
- **Migration**: `0076_review_reply_draft.sql` — added `reply_draft` and `reply_draft_generated_at` to `reviews`.
- **Schema**: `packages/db` — `reviews.replyDraft`, `reviews.replyDraftGeneratedAt`.
- **Gemini**: `GeminiService.generateReviewReplyDraft()` — studio name, location, business type, review content/rating → short reply text.
- **API**: `POST /reviews/:id/draft-reply` (generate), `PATCH /reviews/:id/reply-draft` (save/clear). Requires `manage_marketing` and `GEMINI_API_KEY`.
- **UI**: Studio Reviews page — “Generate reply draft” per review; show draft with Copy / Edit / Clear. Human-approved only (copy to Google or edit before use).

## F.3 Robots overlay — Implementation Log
- **API**: `GET /public/robots.txt` — Platform defaults (Disallow: /admin, /studio, /sign-in, etc.; Sitemap) plus per-tenant `Disallow: /studios/<slug><path>` for each path in `tenant.settings.seo.robotsDisallow` (string[]).
- **Web**: `robots.txt` loader fetches from API, fallback to static default if fetch fails. Cache 1h.
- **Tenant SEO UI**: "Paths to hide from search engines" textarea (one path per line); saved to `settings.seo.robotsDisallow`.

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
| T3.4 | Review AI | Generate draft responses for Google Reviews using tenant context | Completed |
| T3.5 | Local Pages | Programmatic generation of neighborhood-specific landing pages | Completed |
| T3.6 | SEO Dashboard | Tenant-facing ranking and visibility metrics (via SE Ranking API) | Completed |

---

## Future Ideas & Recommendations (Tracked)

The following items are documented for future implementation. Status: **Not Started** unless noted.

| ID | Idea | Description |
|----|------|-------------|
| F.1 | LLM / GEO Snapshot | Machine-readable endpoint per tenant (e.g. `/studios/{slug}/llm.json`) with FAQ JSON, top classes, instructors, locations for external LLMs and GEO. | Completed (`GET /aggregators/llm-snapshot`) |
| F.2 | Canonical & hreflang | Strict canonical rules for subdirectory vs custom domain; basic `hreflang` for multi-region studios to avoid authority split. | Not Started |
| F.3 | Robots & Crawl Budget | Per-tenant robots.txt overlay (allow/disallow sections, noindex for experiments) with safe platform defaults. | Completed |
| F.4 | SEO Safety Rails | Validation in tenant SEO UI: warn on empty titles, duplicate titles, over-long meta to prevent self-sabotage. | Completed |
| F.5 | Internal Link Scaffolding | Auto-generate internal link blocks on public pages (“Popular classes in {city}”, “Meet our instructors”) from activity data. |
| F.6 | Programmatic FAQ Harvest | Mine support/tickets and class descriptions to auto-suggest FAQs per tenant with approve/edit UI feeding FAQPage schema. |
