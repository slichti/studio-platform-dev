import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react-router";
import { apiRequest } from "~/utils/api";

// --- Types ---
export type DateRange = '30d' | '90d' | '1y' | 'custom';

interface AnalyticsParams {
    slug: string;
    startDate?: string;
    endDate?: string;
}

// --- Helpers ---
function getDateRangeParams(range: DateRange, customStart?: string, customEnd?: string) {
    const end = new Date();
    const start = new Date();

    if (range === '30d') start.setDate(end.getDate() - 30);
    else if (range === '90d') start.setDate(end.getDate() - 90);
    else if (range === '1y') start.setFullYear(end.getFullYear() - 1);
    else {
        // Custom
        return { startDate: customStart, endDate: customEnd };
    }

    return { startDate: start.toISOString(), endDate: end.toISOString() };
}

// --- Hooks ---

export function useRevenue(slug: string, range: DateRange, customStart?: string, customEnd?: string) {
    const { getToken } = useAuth();
    const { startDate, endDate } = getDateRangeParams(range, customStart, customEnd);

    return useQuery({
        queryKey: ['analytics', 'revenue', slug, range, startDate, endDate],
        queryFn: async () => {
            const token = await getToken();
            const res = await apiRequest(`/reports/revenue?startDate=${startDate}&endDate=${endDate}`, token, {
                headers: { 'X-Tenant-Slug': slug }
            });
            return res;
        },
        enabled: !!slug
    });
}

export function useAttendance(slug: string, range: DateRange, customStart?: string, customEnd?: string) {
    const { getToken } = useAuth();
    const { startDate, endDate } = getDateRangeParams(range, customStart, customEnd);

    return useQuery({
        queryKey: ['analytics', 'attendance', slug, range, startDate, endDate],
        queryFn: async () => {
            const token = await getToken();
            const res = await apiRequest(`/reports/attendance?startDate=${startDate}&endDate=${endDate}`, token, {
                headers: { 'X-Tenant-Slug': slug }
            });
            return res;
        },
        enabled: !!slug
    });
}

export function useRetention(slug: string) {
    const { getToken } = useAuth();
    return useQuery({
        queryKey: ['analytics', 'retention', slug],
        queryFn: async () => {
            const token = await getToken();
            const res = await apiRequest(`/analytics/retention`, token, {
                headers: { 'X-Tenant-Slug': slug }
            });
            return res;
        },
        enabled: !!slug
    });
}

export function useLTV(slug: string) {
    const { getToken } = useAuth();
    return useQuery({
        queryKey: ['analytics', 'ltv', slug],
        queryFn: async () => {
            const token = await getToken();
            const res = await apiRequest(`/analytics/ltv`, token, {
                headers: { 'X-Tenant-Slug': slug }
            });
            return res;
        },
        enabled: !!slug
    });
}

export function useUtilization(slug: string) {
    const { getToken } = useAuth();
    return useQuery({
        queryKey: ['analytics', 'utilization', slug],
        queryFn: async () => {
            const token = await getToken();
            const res = await apiRequest(`/analytics/utilization`, token, {
                headers: { 'X-Tenant-Slug': slug }
            });
            return res;
        },
        enabled: !!slug
    });
}

export function useReportSchedules(slug: string) {
    const { getToken } = useAuth();
    return useQuery({
        queryKey: ['reports', 'schedules', slug],
        queryFn: async () => {
            const token = await getToken();
            const res = await apiRequest('/reports/schedules', token); // API likely infers tenant from token or needs header? 
            // The original code in studio.$slug.reports.tsx used just apiRequest('/reports/schedules', token) 
            // but usually we need X-Tenant-Slug unless the backend infers it from user context.
            // Safe to add header.
            return res;
        },
        enabled: !!slug
    });
}

export function useReportScheduleMutations(slug: string) {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const token = await getToken();
            return apiRequest('/reports/schedules', token, {
                method: 'POST',
                body: JSON.stringify(data),
                headers: { 'X-Tenant-Slug': slug }
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reports', 'schedules', slug] });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const token = await getToken();
            return apiRequest(`/reports/schedules/${id}`, token, {
                method: 'DELETE',
                headers: { 'X-Tenant-Slug': slug }
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reports', 'schedules', slug] });
        }
    });

    return { createMutation, deleteMutation };
}
