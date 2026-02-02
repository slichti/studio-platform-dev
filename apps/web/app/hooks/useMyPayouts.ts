import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react-router";
import { apiRequest } from "~/utils/api";

export function useMyPayouts(tenantSlug: string) {
    const { getToken } = useAuth();
    return useQuery({
        queryKey: ['my-payouts', tenantSlug],
        queryFn: async () => {
            const token = await getToken();
            const res = await apiRequest('/payroll/history?mine=true', token, {
                headers: { 'X-Tenant-Slug': tenantSlug }
            });
            return (res as any).history || [];
        },
        enabled: !!tenantSlug
    });
}
