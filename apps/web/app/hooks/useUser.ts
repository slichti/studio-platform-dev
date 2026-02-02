import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react-router";
import { apiRequest } from "~/utils/api";

export function useUser(tenantSlug?: string) {
    const { getToken, userId } = useAuth();

    return useQuery({
        queryKey: ['user', userId, tenantSlug],
        queryFn: async () => {
            const token = await getToken();
            const headers: Record<string, string> = {};
            if (tenantSlug) headers['X-Tenant-Slug'] = tenantSlug;

            const [profile, familyRes] = await Promise.all([
                apiRequest('/users/me', token, { headers }).catch(() => null),
                apiRequest('/users/me/family', token, { headers }).catch(() => ({ family: [] })) as Promise<{ family: any[] }>
            ]);

            return {
                profile,
                family: familyRes?.family || []
            };
        },
        enabled: !!userId,
        staleTime: 1000 * 60 * 10, // 10 minutes
    });
}
