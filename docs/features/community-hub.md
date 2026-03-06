# Community Hub

## Architecture Alignment

- **Unified Component**: The `CommunityHub.tsx` component is designed to be context-aware. It accepts a `slug` prop; if provided, it operates in **Tenant Mode**. If omitted, it operates in **Platform Mode** (using the virtual `platform` tenant).
- **Tenant Middleware**: The `tenantMiddleware` in `packages/api/src/middleware/tenant.ts` was enhanced to support a fallback to the `platform` tenant when specific headers are present or when routing to global admin endpoints.
- **RBAC**: Access is governed by standard `authMiddleware` and `tenantMiddleware`, ensuring that users only see content relevant to their context (Platform or specific Studio).

## Features

### 1. Admin Management Dashboard
- **Location**: `/admin/community`
- **Purpose**: Centralized control for the entire platform's social features.
- **Global Control**: Disable the Community Hub platform-wide if needed.
- **Tenant Management**: Enable/disable the Community Hub for specific tenants (e.g., restricted to higher-tier plans).
- **Adoption Tracking**: Real-time stats on community adoption across the tenant network.

### 2. Global Platform Community (Legacy/Note)
- **Note**: The platform-wide community feed is accessible via tenant-specific views if needed, but the admin portal now focuses on management rather than posting.

### 2. Per-Tenant Studio Community
- **Access**: Studio owners and students can access their studio's private community at `/studio/:slug/community`.
- **Isolation**: All posts, comments, and likes are strictly isolated by `tenant_id`.
- **Customization**: Individual tenants can choose to enable or disable the Community Hub in their feature settings.
- **Toggle**: Controlled via the `community` feature key in the `tenant_features` table.

### 3. Rich Media Engagement (Planned/Partial)
- **Sharing**: Supports sharing of text, photos, and videos.
- **Integration**: Leverages Cloudflare R2 for storage and Cloudflare Stream for high-performance video delivery.

## API Summary

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/community` | List community posts for the current context |
| POST | `/community` | Create a new community post |
| GET | `/community/:id` | Get details for a specific post |
| POST | `/community/:id/like` | Toggle a like on a post |
| POST | `/community/:id/comments` | Add a comment to a post |

## Management

### Enabling for Platform
To enable the Community Hub globally for the platform, ensure the following row exists in `platform_config`:
```sql
INSERT INTO platform_config (key, enabled, description) 
VALUES ('feature_community', 1, 'Enable rich social engagement');
```

### Enabling for a Tenant
To enable the Community Hub for a specific tenant (e.g., `garden-yoga`):
```sql
INSERT INTO tenant_features (id, tenant_id, feature_key, enabled)
VALUES (lower(hex(randomblob(16))), (SELECT id FROM tenants WHERE slug = 'garden-yoga'), 'community', 1);
```
