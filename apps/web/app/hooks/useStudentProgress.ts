import { useState, useEffect } from 'react';
import { apiRequest } from '~/utils/api';

interface ProgressData {
    attendanceStreak: number;
    classesThisMonth: number;
    totalClassesAttended: number;
    favoriteInstructors: Array<{
        id: string;
        name: string;
        classCount: number;
    }>;
    upcomingBookings: Array<{
        id: string;
        className: string;
        startTime: string;
        instructor: string;
    }>;
    packCredits: {
        remaining: number;
        total: number;
    } | null;
}

export function useStudentProgress(token: string | null, tenantSlug: string) {
    const [progress, setProgress] = useState<ProgressData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!token) {
            setLoading(false);
            return;
        }

        const fetchProgress = async () => {
            try {
                setLoading(true);

                // Fetch student progress data
                const data = await apiRequest('/progress/my-stats', token, {
                    headers: { 'X-Tenant-Slug': tenantSlug },
                });

                setProgress(data);
                setError(null);
            } catch (err: any) {
                console.error('Failed to fetch progress:', err);
                setError(err.message || 'Failed to load progress data');
                // Set default empty state
                setProgress({
                    attendanceStreak: 0,
                    classesThisMonth: 0,
                    totalClassesAttended: 0,
                    favoriteInstructors: [],
                    upcomingBookings: [],
                    packCredits: null,
                });
            } finally {
                setLoading(false);
            }
        };

        fetchProgress();
    }, [token, tenantSlug]);

    return { progress, loading, error };
}
