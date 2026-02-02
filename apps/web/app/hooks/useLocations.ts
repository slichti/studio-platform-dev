import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react-router";
import { apiRequest } from "~/utils/api";

export type Location = {
    id: string;
    name: string;
    address?: string;
    timezone?: string;
    isPrimary: boolean;
    isActive: boolean;
    settings?: {
        phone?: string;
        hours?: string;
    };
};

export function useLocations(tenantSlug: string) {
    const { getToken } = useAuth();

    return useQuery({
        queryKey: ['locations', tenantSlug],
        queryFn: async () => {
            const token = await getToken();
            const res = await apiRequest("/locations", token, {
                headers: { 'X-Tenant-Slug': tenantSlug }
            });
            return ((res as any).locations || []) as Location[];
        },
        enabled: !!tenantSlug,
        staleTime: 1000 * 60 * 60, // 1 hour (locations rarely change)
    });
}
