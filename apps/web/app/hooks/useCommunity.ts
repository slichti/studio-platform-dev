import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../utils/api";
import { useAuth } from "@clerk/react-router";

export function useCommunity(slug: string, filters: { type?: string; topicId?: string; limit?: number } = {}) {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ['community', slug, filters],
        queryFn: async () => {
            const token = await getToken();
            const searchParams = new URLSearchParams();
            if (filters.type) searchParams.set('type', filters.type);
            if (filters.topicId) searchParams.set('topicId', filters.topicId);
            if (filters.limit) searchParams.set('limit', String(filters.limit));

            return apiRequest(`/community?${searchParams.toString()}`, token, {
                headers: { 'X-Tenant-Slug': slug }
            });
        },
        enabled: !!slug
    });

    const createPost = useMutation({
        mutationFn: async (data: { content: string; type?: string; imageUrl?: string; media?: any[]; topicId?: string }) => {
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

    const reactToPost = useMutation({
        mutationFn: async ({ postId, type }: { postId: string, type: 'like' | 'heart' | 'celebrate' | 'fire' }) => {
            const token = await getToken();
            return apiRequest(`/community/${postId}/react`, token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify({ type })
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['community', slug] });
        }
    });

    const commentOnPost = useMutation({
        mutationFn: async ({ postId, content, parentId }: { postId: string; content: string; parentId?: string }) => {
            const token = await getToken();
            return apiRequest(`/community/${postId}/comments`, token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify({ content, parentId })
            });
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['community', slug] });
            queryClient.invalidateQueries({ queryKey: ['community', 'comments', slug, variables.postId] });
        }
    });

    const updatePost = useMutation({
        mutationFn: async ({ postId, data }: { postId: string, data: { content?: string; topicId?: string | null } }) => {
            const token = await getToken();
            return apiRequest(`/community/${postId}`, token, {
                method: 'PATCH',
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify(data)
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['community', slug] });
        }
    });

    const deletePost = useMutation({
        mutationFn: async (postId: string) => {
            const token = await getToken();
            return apiRequest(`/community/${postId}`, token, {
                method: 'DELETE',
                headers: { 'X-Tenant-Slug': slug }
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['community', slug] });
        }
    });

    const generateAIContent = useMutation({
        mutationFn: async (prompt: string) => {
            const token = await getToken();
            const res = await apiRequest(`/community/ai-generate`, token, {
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
        updatePost,
        deletePost,
        reactToPost,
        commentOnPost,
        generateAIContent
    };
}

export function useCommunityTopics(slug: string, filters: { includeArchived?: boolean } = {}) {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ['community', 'topics', slug, filters],
        queryFn: async () => {
            const token = await getToken();
            const searchParams = new URLSearchParams();
            if (filters.includeArchived) searchParams.set('includeArchived', 'true');

            return apiRequest(`/community/topics?${searchParams.toString()}`, token, {
                headers: { 'X-Tenant-Slug': slug }
            });
        },
        enabled: !!slug
    });

    const createTopic = useMutation({
        mutationFn: async (data: { name: string; description?: string; icon?: string; color?: string }) => {
            const token = await getToken();
            return apiRequest(`/community/topics`, token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify(data)
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['community', 'topics', slug] });
        }
    });

    const deleteTopic = useMutation({
        mutationFn: async (id: string) => {
            const token = await getToken();
            return apiRequest(`/community/topics/${id}`, token, {
                method: 'DELETE',
                headers: { 'X-Tenant-Slug': slug }
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['community', 'topics', slug] });
        }
    });

    const updateTopic = useMutation({
        mutationFn: async ({ id, data }: { id: string, data: { name?: string; description?: string; icon?: string; color?: string; visibility?: string; isArchived?: boolean } }) => {
            const token = await getToken();
            return apiRequest(`/community/topics/${id}`, token, {
                method: 'PATCH',
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify(data)
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['community', 'topics', slug] });
        }
    });

    return {
        topics: query.data as any[] || [],
        isLoading: query.isLoading,
        createTopic,
        updateTopic,
        deleteTopic
    };
}

export function useCommunityComments(slug: string, postId: string | null) {
    const { getToken } = useAuth();

    return useQuery({
        queryKey: ['community', 'comments', slug, postId],
        queryFn: async () => {
            const token = await getToken();
            return apiRequest(`/community/${postId}/comments`, token, {
                headers: { 'X-Tenant-Slug': slug }
            });
        },
        enabled: !!slug && !!postId
    });
}

export function useTopicDetails(slug: string, topicId: string | null) {
    const { getToken } = useAuth();

    return useQuery({
        queryKey: ['community', 'topic', slug, topicId],
        queryFn: async () => {
            const token = await getToken();
            return apiRequest(`/community/topics/${topicId}`, token, {
                headers: { 'X-Tenant-Slug': slug }
            });
        },
        enabled: !!slug && !!topicId
    });
}

export function useTopicRules(slug: string, topicId: string) {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();

    const addRule = useMutation({
        mutationFn: async (data: { type: 'course' | 'membership_plan' | 'group'; targetId: string }) => {
            const token = await getToken();
            return apiRequest(`/community/topics/${topicId}/rules`, token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify(data)
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['community', 'topic', slug, topicId] });
        }
    });

    const removeRule = useMutation({
        mutationFn: async (ruleId: string) => {
            const token = await getToken();
            return apiRequest(`/community/topics/rules/${ruleId}`, token, {
                method: 'DELETE',
                headers: { 'X-Tenant-Slug': slug }
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['community', 'topic', slug, topicId] });
        }
    });

    return { addRule, removeRule };
}

export function useTopicMembers(slug: string, topicId: string) {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();

    const addMember = useMutation({
        mutationFn: async (data: { memberId: string; role?: string }) => {
            const token = await getToken();
            return apiRequest(`/community/topics/${topicId}/members`, token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify(data)
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['community', 'topic', slug, topicId] });
        }
    });

    return { addMember };
}

export function useMemberPreview(slug: string, memberId: string | null) {
    const { getToken } = useAuth();

    return useQuery({
        queryKey: ['community', 'member-preview', slug, memberId],
        queryFn: async () => {
            const token = await getToken();
            return apiRequest(`/community/members/${memberId}/preview`, token, {
                headers: { 'X-Tenant-Slug': slug }
            });
        },
        enabled: !!slug && !!memberId
    });
}
