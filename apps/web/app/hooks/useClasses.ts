import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react-router";
import { apiRequest } from "~/utils/api";

export function useClasses(tenantSlug: string, filters?: { search?: string; status?: string; limit?: number; offset?: number }, tokenOverride?: string | null) {
    const { getToken } = useAuth();

    return useQuery({
        queryKey: ['classes', tenantSlug, filters, tokenOverride],
        queryFn: async () => {
            const token = tokenOverride || await getToken();
            const queryParams = new URLSearchParams();
            if (filters?.search) queryParams.set('search', filters.search);
            if (filters?.status && filters.status !== 'all') queryParams.set('status', filters.status);
            if (filters?.limit) queryParams.set('limit', filters.limit.toString());
            if (filters?.offset) queryParams.set('offset', filters.offset.toString());

            return apiRequest(`/classes?${queryParams.toString()}`, token, {
                headers: { 'X-Tenant-Slug': tenantSlug }
            });
        },
        enabled: !!tenantSlug,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}

export function useInfiniteClasses(tenantSlug: string, filters?: { search?: string; status?: string; limit?: number }, tokenOverride?: string | null) {
    const { getToken } = useAuth();
    const limit = filters?.limit || 20;

    return useInfiniteQuery({
        queryKey: ['classes-infinite', tenantSlug, filters, tokenOverride],
        queryFn: async ({ pageParam = 0 }) => {
            const token = tokenOverride || await getToken();
            const queryParams = new URLSearchParams();
            if (filters?.search) queryParams.set('search', filters.search);
            if (filters?.status && filters.status !== 'all') queryParams.set('status', filters.status);
            queryParams.set('limit', limit.toString());
            queryParams.set('offset', pageParam.toString());

            return apiRequest(`/classes?${queryParams.toString()}`, token, {
                headers: { 'X-Tenant-Slug': tenantSlug }
            }) as Promise<any[]>;
        },
        initialPageParam: 0,
        getNextPageParam: (lastPage, allPages) => {
            return lastPage.length === limit ? allPages.length * limit : undefined;
        },
        enabled: !!tenantSlug,
        staleTime: 1000 * 60 * 5,
    });
}
