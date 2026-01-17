import { apiRequest } from "~/utils/api";

const BASE_DOMAIN = "studio-platform-dev.slichti.org";
const RESERVED_SUBDOMAINS = ['www', 'api', 'admin', 'app', 'mail', 'staging', 'dev', 'test'];

export function getSubdomain(request: Request): string | null {
    const url = new URL(request.url);
    const hostname = url.hostname;

    const normalizedHostname = hostname.toLowerCase();

    // Exact match for base domain -> no subdomain
    if (normalizedHostname === BASE_DOMAIN) return null;

    // Must end with .BASE_DOMAIN to be a subdomain
    if (normalizedHostname.endsWith(`.${BASE_DOMAIN}`)) {
        const subdomain = normalizedHostname.slice(0, -1 * (BASE_DOMAIN.length + 1)); // Remove .BASE_DOMAIN
        if (RESERVED_SUBDOMAINS.includes(subdomain)) {
            return null;
        }
        return subdomain;
    }
    return null;
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
