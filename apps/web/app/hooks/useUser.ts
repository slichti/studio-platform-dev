import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react-router";
import { apiRequest } from "~/utils/api";

export function useUser(tenantSlug?: string, tokenOverride?: string | null) {
    const { getToken, userId: authUserId } = useAuth();

    // If impersonating, we don't know the exact userId easily unless decoded, 
    // but the token changes. We can use token as part of key.
    // Or just rely on tokenOverride existence.
    const userId = tokenOverride ? 'impersonated' : authUserId;

    return useQuery({
        queryKey: ['user', userId, tenantSlug, tokenOverride],
        queryFn: async () => {
            const token = tokenOverride || await getToken();
            if (!token) return null;

            const headers: Record<string, string> = {
                'Authorization': `Bearer ${token}`
            };
            if (tenantSlug) headers['X-Tenant-Slug'] = tenantSlug;

            // Note: apiRequest handles Bearer prefix if passed as 2nd arg
            // but here we are constructing headers manually for some reason?
            // apiRequest source: apiRequest(endpoint, token, options)
            // It adds Authorization header.

            const [profile, familyRes] = await Promise.all([
                apiRequest('/users/me', token, { headers: tenantSlug ? { 'X-Tenant-Slug': tenantSlug } : {} }).catch(() => null),
                apiRequest('/users/me/family', token, { headers: tenantSlug ? { 'X-Tenant-Slug': tenantSlug } : {} }).catch(() => ({ family: [] })) as Promise<{ family: any[] }>
            ]);

            return {
                profile,
                family: familyRes?.family || []
            };
        },
        enabled: !!userId || !!tokenOverride,
        staleTime: 1000 * 60 * 10, // 10 minutes
    });
}
