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

export function useBulkApprovePayouts(tenantSlug: string) {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (ids: string[]) => {
            const token = await getToken();
            const res = await apiRequest('/payroll/payouts/bulk-approve', token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': tenantSlug },
                body: JSON.stringify({ ids })
            });
            if ((res as any).error) throw new Error((res as any).error);
            return res;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payroll-history', tenantSlug] });
        }
    });
}

export function useExportPayrollHistory(tenantSlug: string) {
    const { getToken } = useAuth();

    return async (startDate?: string, endDate?: string) => {
        const token = await getToken();
        let url = `/payroll/history/export`;
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (params.toString()) url += `?${params.toString()}`;

        const baseUrl = (window as any).ENV.VITE_API_URL || '';
        const response = await fetch(`${baseUrl}${url}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Tenant-Slug': tenantSlug
            }
        });

        if (!response.ok) throw new Error('Export failed');

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `payroll_history_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
    };
}
