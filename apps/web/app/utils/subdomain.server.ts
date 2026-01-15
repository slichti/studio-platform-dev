import { apiRequest } from "~/utils/api";

const BASE_DOMAIN = "studio-platform-dev.slichti.org";
const RESERVED_SUBDOMAINS = ['www', 'api', 'admin', 'app', 'mail', 'staging', 'dev', 'test'];

export function getSubdomain(request: Request): string | null {
    const url = new URL(request.url);
    const hostname = url.hostname;

    if (hostname.endsWith(BASE_DOMAIN) && hostname !== BASE_DOMAIN) {
        const subdomain = hostname.replace(`.${BASE_DOMAIN}`, '');
        if (RESERVED_SUBDOMAINS.includes(subdomain.toLowerCase())) {
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
