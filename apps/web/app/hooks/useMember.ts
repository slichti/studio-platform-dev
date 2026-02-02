import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react-router";

export function useMember(tenantSlug: string, memberId: string) {
    const { getToken } = useAuth();

    return useQuery({
        queryKey: ['member', tenantSlug, memberId],
        queryFn: async () => {
            const token = await getToken();
            if (!token) throw new Error("No token");
            const res = await fetch(`${(window as any).ENV.VITE_API_URL}/members/${memberId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'X-Tenant-Slug': tenantSlug
                }
            });
            const data = await res.json() as { member: any; error?: string };
            if (data.error) throw new Error(data.error);
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
            const res = await fetch(`${(window as any).ENV.VITE_API_URL}/members/${memberId}/notes`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'X-Tenant-Slug': tenantSlug
                }
            });
            const data = await res.json() as { notes: any[] };
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
            const res = await fetch(`${(window as any).ENV.VITE_API_URL}/members/${memberId}/coupons`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'X-Tenant-Slug': tenantSlug
                }
            });
            const data = await res.json() as { coupons: any[] };
            return data.coupons || [];
        },
        enabled: !!tenantSlug && !!memberId
    });
}
