import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react-router";
import { apiRequest } from "~/utils/api";

export type Plan = {
    id: string;
    name: string;
    price: number;
    interval: 'month' | 'year' | 'week' | 'one_time';
    description?: string;
    intervalCount?: number;
    autoRenew?: boolean;
    imageUrl?: string;
    overlayTitle?: string;
    overlaySubtitle?: string;
    vodEnabled: boolean;
    trialDays?: number;
    isIntroOffer?: boolean;
    introOfferLimit?: number;
    winBackPeriodDays?: number | null;
    updatedAt?: string;
    active?: boolean;
};

export type Subscription = {
    id: string;
    memberId?: string; // tenant member id — use for link to /studio/:slug/students/:memberId
    status: string;
    currentPeriodEnd: string;
    user: {
        email: string;
        displayName?: string; // API-computed: fullName or firstName + lastName or email
        profile: {
            fullName?: string;
            firstName?: string;
            lastName?: string;
        };
    };
    planName: string;
    createdAt?: string; // ISO date string
};

export function usePlans(tenantSlug: string, options?: { includeArchived?: boolean }) {
    const { getToken } = useAuth();
    const includeArchived = options?.includeArchived ?? false;

    return useQuery({
        queryKey: ['plans', tenantSlug, includeArchived],
        queryFn: async () => {
            const token = await getToken();
            const qs = includeArchived ? '?includeArchived=true' : '';
            const res = await apiRequest(`/memberships/plans${qs}`, token, {
                headers: { 'X-Tenant-Slug': tenantSlug }
            });
            return (res || []) as Plan[];
        },
        enabled: !!tenantSlug,
        staleTime: 1000 * 60 * 5,
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
