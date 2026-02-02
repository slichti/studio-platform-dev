import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react-router";
import { apiRequest } from "~/utils/api";

export function usePayrollHistory(tenantSlug: string) {
    const { getToken } = useAuth();
    return useQuery({
        queryKey: ['payroll-history', tenantSlug],
        queryFn: async () => {
            const token = await getToken();
            const res = await apiRequest('/payroll/history', token, {
                headers: { 'X-Tenant-Slug': tenantSlug }
            });
            return (res as any).history || [];
        },
        enabled: !!tenantSlug
    });
}

export function usePayrollConfig(tenantSlug: string) {
    const { getToken } = useAuth();
    return useQuery({
        queryKey: ['payroll-config', tenantSlug],
        queryFn: async () => {
            const token = await getToken();
            const res = await apiRequest('/payroll/config', token, {
                headers: { 'X-Tenant-Slug': tenantSlug }
            });
            if ((res as any).error) throw new Error((res as any).error);
            return (res as any).instructors || [];
        },
        enabled: !!tenantSlug
    });
}
