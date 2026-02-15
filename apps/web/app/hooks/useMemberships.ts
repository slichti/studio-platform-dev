import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react-router";
import { apiRequest } from "~/utils/api";

export type Plan = {
    id: string;
    name: string;
    price: number;
    interval: 'month' | 'year' | 'week' | 'one_time';
    description?: string;
    imageUrl?: string;
    overlayTitle?: string;
    overlaySubtitle?: string;
    vodEnabled: boolean;
};

export type Subscription = {
    id: string;
    status: string;
    currentPeriodEnd: string;
    user: {
        email: string;
        profile: {
            fullName?: string;
        };
    };
    planName: string;
    createdAt?: string; // ISO date string
};

export function usePlans(tenantSlug: string) {
    const { getToken } = useAuth();

    return useQuery({
        queryKey: ['plans', tenantSlug],
        queryFn: async () => {
            const token = await getToken();
            const res = await apiRequest("/memberships/plans", token, {
                headers: { 'X-Tenant-Slug': tenantSlug }
            });
            return (res || []) as Plan[];
        },
        enabled: !!tenantSlug,
        staleTime: 1000 * 60 * 60, // 1 hour
    });
}

export function useSubscriptions(tenantSlug: string, planId?: string) {
    const { getToken } = useAuth();

    return useQuery({
        queryKey: ['subscriptions', tenantSlug, planId],
        queryFn: async () => {
            const token = await getToken();
            const queryParams = planId ? `?planId=${planId}` : '';
            const res = await apiRequest(`/memberships/subscriptions${queryParams}`, token, {
                headers: { 'X-Tenant-Slug': tenantSlug }
            });
            return (res || []) as Subscription[];
        },
        enabled: !!tenantSlug,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}
