/**
 * Timeout for outbound HTTP calls to external services (Stripe, Cloudflare, Zoom, etc.).
 * Prevents a stuck dependency from holding the Worker for the full CPU limit.
 */
export const OUTBOUND_TIMEOUT_MS = 15_000; // 15 seconds

/**
 * Fetch with a timeout. Uses AbortSignal.timeout so the request is aborted after the given ms.
 * Use for all outbound calls to external APIs. If init.signal is provided, it is used as-is (caller owns timeout).
 */
export async function fetchWithTimeout(
    input: RequestInfo | URL,
    init?: RequestInit,
    timeoutMs: number = OUTBOUND_TIMEOUT_MS
): Promise<Response> {
    const signal = init?.signal ?? AbortSignal.timeout(timeoutMs);
    return fetch(input, { ...init, signal });
}
