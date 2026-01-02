import { HydratedRouter } from "react-router-dom";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";

// Emergency fix for stale Service Worker cache
window.addEventListener("error", async (event) => {
    if (event.message?.includes("SSR features") || event.message?.includes("Minified React error #299")) {
        console.error("Critical Hydration Error detected. Clearing cache and reloading...");
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
            }
        }
        window.location.reload();
    }
});

startTransition(() => {
    hydrateRoot(
        document,
        <StrictMode>
            <HydratedRouter />
        </StrictMode>
    );
});
