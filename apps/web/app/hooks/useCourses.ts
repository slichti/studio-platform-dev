import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react-router";
import { apiRequest } from "~/utils/api";

export function useCourses(tenantSlug: string, filters?: { status?: string; limit?: number; offset?: number }, tokenOverride?: string | null) {
    const { getToken } = useAuth();

    return useQuery({
        queryKey: ['courses', tenantSlug, filters, tokenOverride],
        queryFn: async () => {
            const token = tokenOverride || await getToken();
            // Since /courses is in authenticatedPaths, we should ideally have a token.
            // However, we'll let the apiRequest handle it and just ensure we don't fire 
            // if we are certain it will 401, or just let it fire and retry.
            const queryParams = new URLSearchParams();
            if (filters?.status && filters.status !== 'all') queryParams.set('status', filters.status);
            if (filters?.limit) queryParams.set('limit', filters.limit.toString());
            if (filters?.offset) queryParams.set('offset', filters.offset.toString());

            return apiRequest(`/courses?${queryParams.toString()}`, token, {
                headers: { 'X-Tenant-Slug': tenantSlug }
            });
        },
        enabled: !!tenantSlug,
        staleTime: 1000 * 60 * 5,
    });
}

export function useCourse(tenantSlug: string, id: string, tokenOverride?: string | null) {
    const { getToken } = useAuth();

    return useQuery({
        queryKey: ['course', tenantSlug, id, tokenOverride],
        queryFn: async () => {
            const token = tokenOverride || await getToken();
            return apiRequest(`/courses/${id}`, token, {
                headers: { 'X-Tenant-Slug': tenantSlug }
            });
        },
        enabled: !!tenantSlug && !!id,
        staleTime: 1000 * 60 * 5,
    });
}
