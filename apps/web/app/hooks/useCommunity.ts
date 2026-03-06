import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../utils/api";
import { useAuth } from "@clerk/react-router";

export function useCommunity(slug: string, filters: { type?: string; limit?: number } = {}) {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ['community', slug, filters],
        queryFn: async () => {
            const token = await getToken();
            const searchParams = new URLSearchParams();
            if (filters.type) searchParams.set('type', filters.type);
            if (filters.limit) searchParams.set('limit', String(filters.limit));

            return apiRequest(`/community?${searchParams.toString()}`, token, {
                headers: { 'X-Tenant-Slug': slug }
            });
        },
        enabled: !!slug
    });

    const createPost = useMutation({
        mutationFn: async (data: { content: string; type?: string; imageUrl?: string; media?: any[] }) => {
            const token = await getToken();
            return apiRequest(`/community`, token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify(data)
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['community', slug] });
        }
    });

    const likePost = useMutation({
        mutationFn: async (postId: string) => {
            const token = await getToken();
            return apiRequest(`/community/${postId}/like`, token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': slug }
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['community', slug] });
        }
    });

    const commentOnPost = useMutation({
        mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
            const token = await getToken();
            return apiRequest(`/community/${postId}/comments`, token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify({ content })
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['community', slug] });
        }
    });

    const generateAIContent = useMutation({
        mutationFn: async (prompt: string) => {
            const token = await getToken();
            const res = await apiRequest(`/community/generate`, token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify({ prompt })
            }) as any;
            return res as { content: string };
        }
    });

    return {
        posts: query.data as any[] || [],
        isLoading: query.isLoading,
        createPost,
        likePost,
        commentOnPost,
        generateAIContent
    };
}
