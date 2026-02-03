import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react-router";
import { apiRequest } from "~/utils/api";

export type WebhookEndpoint = {
    id: string;
    url: string;
    description?: string;
    events: string[] | string; // API might return string list or comma string
    secret: string;
    createdAt: string;
};

export function useWebhooks(tenantSlug: string, enabled: boolean = true) {
    const { getToken } = useAuth();

    return useQuery({
        queryKey: ['webhooks', tenantSlug],
        queryFn: async () => {
            const token = await getToken();
            const res = await apiRequest("/tenant/webhooks/endpoints", token, {
                headers: { 'X-Tenant-Slug': tenantSlug }
            });
            // Handle { endpoints: [...] } or [...] response shape
            const list = (res as any).endpoints || res || [];
            return list as WebhookEndpoint[];
        },
        enabled: !!tenantSlug && enabled,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}
