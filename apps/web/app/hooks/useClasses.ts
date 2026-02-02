import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react-router";
import { apiRequest } from "~/utils/api";

export function useClasses(tenantSlug: string, filters?: { search?: string; status?: string }) {
    const { getToken } = useAuth();

    return useQuery({
        queryKey: ['classes', tenantSlug, filters],
        queryFn: async () => {
            const token = await getToken();
            const queryParams = new URLSearchParams();
            if (filters?.search) queryParams.set('search', filters.search);
            if (filters?.status && filters.status !== 'all') queryParams.set('status', filters.status);

            return apiRequest(`/classes?${queryParams.toString()}`, token, {
                headers: { 'X-Tenant-Slug': tenantSlug }
            });
        },
        enabled: !!tenantSlug,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}
