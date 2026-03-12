
/**
 * Utility for generating tenant-specific URLs.
 * Handles custom domains and platform subdomains.
 */

const DEFAULT_PLATFORM_DOMAIN = "studio-platform-dev.slichti.org";

function getPlatformDomain(): string {
    if (typeof window !== "undefined" && (window as any).ENV?.VITE_PLATFORM_DOMAIN) {
        return (window as any).ENV.VITE_PLATFORM_DOMAIN;
    }
    const env = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_PLATFORM_DOMAIN) as string | undefined;
    return env && env.length > 0 ? env : DEFAULT_PLATFORM_DOMAIN;
}

export function getTenantUrl(tenant: { slug: string; customDomain?: string | null }): string {
    if (tenant.customDomain) {
        // Ensure protocol
        if (tenant.customDomain.startsWith("http")) {
            return tenant.customDomain;
        }
        return `https://${tenant.customDomain}`;
    }

    // Fallback to platform subdomain
    return `https://${tenant.slug}.${getPlatformDomain()}`;
}
