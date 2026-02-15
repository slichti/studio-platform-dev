import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { apiRequest } from "~/utils/api";

export interface Member {
    id: string;
    userId: string;
    profile: any;
    status: string;
    joinedAt: string;
    roles?: { role: string }[];
    user?: { email: string };
}

interface UseMembersOptions {
    role?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
}

export function useInfiniteMembers(tenantSlug: string, options: UseMembersOptions = {}) {
    const { role, status, search, limit = 50 } = options;

    return useInfiniteQuery({
        queryKey: ['members', 'infinite', tenantSlug, role, status, search, limit],
        queryFn: async ({ pageParam = 0 }) => {
            const token = await (window as any).Clerk?.session?.getToken();
            const params = new URLSearchParams();
            if (role && role !== 'all') params.append('role', role);
            if (search) params.append('q', search);
            params.append('limit', limit.toString());
            params.append('offset', (pageParam as number).toString());

            const data = await apiRequest<{ members: Member[], total: number }>(`/members?slug=${tenantSlug}&${params.toString()}`, token, {
                headers: { 'X-Tenant-Slug': tenantSlug }
            });

            // Client-side status filtering if API doesn't support it yet
            let members = data.members;
            if (status && status !== 'all') {
                members = members.filter(m => m.status === status);
            }

            return {
                members,
                total: data.total,
                nextOffset: (pageParam as number) + limit
            };
        },
        getNextPageParam: (lastPage: any, allPages: any) => {
            if (lastPage.members.length < limit) return undefined;
            return lastPage.nextOffset;
        },
        initialPageParam: 0,
        enabled: !!tenantSlug,
        keepPreviousData: true
    } as any);
}

export function useMembers(tenantSlug: string, options: UseMembersOptions = {}) {
    const { role, status, search, limit = 100, offset = 0 } = options;

    return useQuery({
        queryKey: ['members', tenantSlug, role, status, search, limit, offset],
        queryFn: async () => {
            const token = await (window as any).Clerk?.session?.getToken();
            const params = new URLSearchParams();
            if (role && role !== 'all') params.append('role', role);
            if (search) params.append('q', search);
            params.append('limit', limit.toString());
            params.append('offset', offset.toString());

            const data = await apiRequest<{ members: Member[], total: number }>(`/members?slug=${tenantSlug}&${params.toString()}`, token, {
                headers: { 'X-Tenant-Slug': tenantSlug }
            });

            // Client-side status filtering if API doesn't support it yet
            let members = data.members;
            if (status && status !== 'all') {
                members = members.filter(m => m.status === status);
            }

            return {
                members,
                total: data.total
            };
        },
        enabled: !!tenantSlug,
        keepPreviousData: true
    } as any);
}
