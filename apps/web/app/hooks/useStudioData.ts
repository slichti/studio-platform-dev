import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react-router";
import { apiRequest } from "~/utils/api";

export function useStudioData(tenantSlug: string) {
    const { getToken } = useAuth();

    return useQuery({
        queryKey: ['studio-data', tenantSlug],
        queryFn: async () => {
            const token = await getToken();
            const headers = { 'X-Tenant-Slug': tenantSlug };

            const [locationsRes, instructorsRes] = await Promise.all([
                apiRequest("/locations", token, { headers }).catch(() => ({ locations: [] })),
                apiRequest("/members?role=instructor", token, { headers }).catch(() => ({ members: [] }))
            ]);

            return {
                locations: (locationsRes as any).locations || [],
                instructors: (instructorsRes as any).members || []
            };
        },
        enabled: !!tenantSlug,
        staleTime: 1000 * 60 * 10, // 10 minutes
    });
}
