import { QueryClient } from "@tanstack/react-query";

/** Don't retry on 4xx (client errors); retry up to 2 times on network/5xx with backoff */
function defaultRetry(failureCount: number, error: unknown): boolean {
    if (failureCount >= 2) return false;
    const status = (error as { status?: number })?.status;
    if (typeof status === "number" && status >= 400 && status < 500) return false;
    return true;
}

/** Exponential backoff: 1s, 2s, 4s (capped) */
function defaultRetryDelay(failureCount: number): number {
    return Math.min(1000 * 2 ** failureCount, 4000);
}

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: defaultRetry,
            retryDelay: defaultRetryDelay,
            refetchOnWindowFocus: false, // Prevent aggressive refetching
        },
    },
});
