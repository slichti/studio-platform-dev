import { apiRequest } from "~/utils/api";

const BASE_DOMAIN = "studio-platform-dev.slichti.org";
const RESERVED_SUBDOMAINS = ['www', 'api', 'admin', 'app', 'mail', 'staging', 'dev', 'test'];

export function getSubdomain(request: Request): string | null {
    const url = new URL(request.url);
    const hostname = url.hostname.toLowerCase();

    // Exact match for base domain -> no subdomain
    if (hostname === BASE_DOMAIN) return null;

    // Must end with .BASE_DOMAIN to be a subdomain
    if (hostname.endsWith(`.${BASE_DOMAIN}`)) {
        const subdomain = hostname.slice(0, -1 * (BASE_DOMAIN.length + 1));
        if (RESERVED_SUBDOMAINS.includes(subdomain)) {
            return null;
        }
        return subdomain;
    }

    // If it doesn't end with BASE_DOMAIN, it's a custom domain
    return hostname;
}

export async function getStudioPage(tenantSlug: string, pageSlug: string) {
    try {
        const page = await apiRequest<any>(`/website/public/pages/${pageSlug}`, null, {
            headers: {
                "X-Tenant-Slug": tenantSlug
            }
        });
        return page;
    } catch (e) {
        console.error(`Failed to load page ${pageSlug} for tenant ${tenantSlug}:`, e);
        return null;
    }
}

export async function getTenantBySlug(slug: string) {
    try {
        const tenant = await apiRequest<any>(`/tenants/${slug}`, null);
        return tenant;
    } catch (e) {
        console.error(`Failed to load tenant ${slug}:`, e);
        return null;
    }
}
