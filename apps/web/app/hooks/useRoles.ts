import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react-router";
import { apiRequest } from "~/utils/api";

export type Role = {
    id: string;
    name: string;
    description?: string;
    permissions: string[];
    isSystem?: boolean; // If applicable
};

export function useRoles(tenantSlug: string) {
    const { getToken } = useAuth();

    return useQuery({
        queryKey: ['roles', tenantSlug],
        queryFn: async () => {
            const token = await getToken();
            const res = await apiRequest("/tenant/roles", token, {
                headers: { 'X-Tenant-Slug': tenantSlug }
            });
            return (res || []) as Role[];
        },
        enabled: !!tenantSlug,
        staleTime: 1000 * 60 * 60, // 1 hour
    });
}
