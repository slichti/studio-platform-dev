import { API_URL } from "~/utils/api";

type ErrorInfo = {
    message: string;
    stack?: string;
    url: string;
    userAgent: string;
};

// Rate limiting to prevent flooding
let lastErrorTime = 0;
const MIN_INTERVAL = 2000; // 2 seconds between errors

export const reportError = async (error: Error | string, extraInfo: Record<string, any> = {}) => {
    const now = Date.now();
    if (now - lastErrorTime < MIN_INTERVAL) {
        return; // Skip if too frequent
    }
    lastErrorTime = now;

    console.error("[Telemetry] Reporting error:", error);

    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    const payload: ErrorInfo = {
        message,
        stack,
        url: typeof window !== 'undefined' ? window.location.href : 'server-side',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server-side',
        ...extraInfo
    };

    try {
        // Use beacon if available for non-blocking
        if (typeof navigator !== 'undefined' && (navigator as any).sendBeacon) {
            const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
            // Needs absolute URL or relative if on same domain. 
            // Since API is separate, we need API_URL.
            // But API_URL import from `~/utils/api` might rely on env vars.
            // Let's assume `window.ENV.API_URL` or fallback.
            // Actually, `apiRequest` handles `API_URL`.
            // Let's try direct fetch catch-fire.

            // Note: navigator.sendBeacon requires CORS headers on server to be very specific if using Blob with type.
            // Simplest is fetch keepalive.
            fetch(`${API_URL}/telemetry/client-error`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                keepalive: true
            }).catch(e => console.warn("Failed to send telemetry", e));
        } else {
            // Fallback
            fetch(`${API_URL}/telemetry/client-error`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).catch(e => console.warn("Failed to send telemetry", e));
        }
    } catch (e) {
        // Do not crash the app
    }
};

export const initGlobalErrorHandlers = () => {
    if (typeof window === 'undefined') return;

    window.onerror = (msg, url, line, col, error) => {
        reportError(error || msg as string);
    };

    window.onunhandledrejection = (event) => {
        reportError(event.reason || "Unhandled Rejection");
    };
};
