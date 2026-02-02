import { useQuery } from "@tanstack/react-query";

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
            const res = await fetch(`${(window as any).ENV.VITE_API_URL}/members?slug=${tenantSlug}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch members');
            const data = await res.json() as { members: Member[] };
            return data.members;
        },
        enabled: !!tenantSlug
    });
}
