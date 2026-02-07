import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "~/utils/api";

interface Member {
    id: string;
    userId: string;
    profile: any;
    status: string;
    joinedAt: string;
    roles?: { role: string }[];
}

export function useMembers(tenantSlug: string) {
    return useQuery({
        queryKey: ['members', tenantSlug],
        queryFn: async (): Promise<Member[]> => {
            const token = await (window as any).Clerk?.session?.getToken();
            const data = await apiRequest<{ members: Member[] }>(`/members?slug=${tenantSlug}`, token, {
                headers: { 'X-Tenant-Slug': tenantSlug }
            });
            return data.members;
        },
        enabled: !!tenantSlug
    });
}
