import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react-router";
import { apiRequest } from "~/utils/api";

type PackDefinition = {
    id: string;
    name: string;
    credits: number;
    price: number;
};

export function usePacks(tenantSlug: string) {
    const { getToken } = useAuth();

    return useQuery({
        queryKey: ['packs', tenantSlug],
        queryFn: async () => {
            const token = await getToken();
            const res = await apiRequest("/commerce/packs", token, {
                headers: { 'X-Tenant-Slug': tenantSlug }
            });
            return (res as any).packs as PackDefinition[] || [];
        },
        enabled: !!tenantSlug
    });
}
