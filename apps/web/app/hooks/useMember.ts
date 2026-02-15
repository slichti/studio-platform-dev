import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react-router";
import { apiRequest } from "../utils/api";

export function useMember(tenantSlug: string, memberId: string) {
    const { getToken } = useAuth();

    return useQuery({
        queryKey: ['member', tenantSlug, memberId],
        queryFn: async () => {
            const token = await getToken();
            const data = await apiRequest<{ member: any }>(`/members/${memberId}`, token, {
                headers: { 'X-Tenant-Slug': tenantSlug }
            });
            return data.member;
        },
        enabled: !!tenantSlug && !!memberId
    });
}

export function useMemberNotes(tenantSlug: string, memberId: string) {
    const { getToken } = useAuth();

    return useQuery({
        queryKey: ['member-notes', tenantSlug, memberId],
        queryFn: async () => {
            const token = await getToken();
            const data = await apiRequest<{ notes: any[] }>(`/members/${memberId}/notes`, token, {
                headers: { 'X-Tenant-Slug': tenantSlug }
            });
            return data.notes || [];
        },
        enabled: !!tenantSlug && !!memberId
    });
}

export function useMemberCoupons(tenantSlug: string, memberId: string) {
    const { getToken } = useAuth();

    return useQuery({
        queryKey: ['member-coupons', tenantSlug, memberId],
        queryFn: async () => {
            const token = await getToken();
            const data = await apiRequest<{ coupons: any[] }>(`/members/${memberId}/coupons`, token, {
                headers: { 'X-Tenant-Slug': tenantSlug }
            });
            return data.coupons || [];
        },
        enabled: !!tenantSlug && !!memberId
    });
}
