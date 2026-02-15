import { HydratedRouter } from "react-router-dom";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";

// Initialize Sentry for error tracking (only if DSN is available)
const SENTRY_DSN = (window as any).__SENTRY_DSN__;
if (SENTRY_DSN) {
    Sentry.init({
        dsn: SENTRY_DSN,
        environment: import.meta.env.MODE || 'development',
        tracesSampleRate: 0.1, // 10% of transactions
        replaysSessionSampleRate: 0, // Disable session replays
        replaysOnErrorSampleRate: 0.5, // Capture replays on 50% of errors
    });
}

// Emergency fix for stale Service Worker cache
window.addEventListener("error", async (event) => {
    if (event.message?.includes("SSR features") || event.message?.includes("Minified React error #299") || event.message?.includes("Minified React error #418") || event.message?.includes("Hydration failed")) {
        const lastReload = sessionStorage.getItem('hydration_reload_ts');
        const now = Date.now();

        // Prevent infinite loops: only reload if we haven't done so in the last 10 seconds
        if (lastReload && (now - parseInt(lastReload)) < 10000) {
            console.error("Critical Hydration Error detected, but skipping reload to prevent loop.");
            return;
        }

        console.error("Critical Hydration Error detected. Clearing cache and reloading...");
        sessionStorage.setItem('hydration_reload_ts', now.toString());

        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
            }
        }
        window.location.reload();
    }
});

// Check if the server returned a critical error page
if (document.body.innerHTML.includes("Critical Worker Crash")) {
    console.error("Server reported a critical error. Skipping client hydration to show error details.");
} else {
    startTransition(() => {
        hydrateRoot(
            document,
            <StrictMode>
                <HydratedRouter />
            </StrictMode>
        );
    });
}
