
/**
 * Utility for generating tenant-specific URLs.
 * Handles custom domains and platform subdomains.
 */

// TODO: Move this to an environment variable in the future
const BASE_PLATFORM_DOMAIN = "studio-platform-dev.slichti.org";

export function getTenantUrl(tenant: { slug: string; customDomain?: string | null }): string {
    if (tenant.customDomain) {
        // Ensure protocol
        if (tenant.customDomain.startsWith("http")) {
            return tenant.customDomain;
        }
        return `https://${tenant.customDomain}`;
    }

    // Fallback to platform subdomain
    return `https://${tenant.slug}.${BASE_PLATFORM_DOMAIN}`;
}
