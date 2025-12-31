const CACHE_NAME = 'studio-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event: any) => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            // Cache critical assets
            // In Remix, we might want to cache build assets, but names are hashed.
            // For MVP, just cache the offline page if we had one.
            // await cache.add(new Request(OFFLINE_URL, { cache: 'reload' }));
        })()
    );
    // Force update
    (self as any).skipWaiting();
});

self.addEventListener('activate', (event: any) => {
    event.waitUntil(
        (async () => {
            // Enable navigation preload if it's supported.
            if ('navigationPreload' in self.registration) {
                await self.registration.navigationPreload.enable();
            }

            // Cleanup old caches
            const keys = await caches.keys();
            await Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) return caches.delete(key);
                })
            )
        })()
    );
    (self as any).clients.claim();
});

self.addEventListener('fetch', (event: any) => {
    // We only want to call event.respondWith() if this is a navigation request
    // for an HTML page.
    if (event.request.mode === 'navigate') {
        event.respondWith(
            (async () => {
                try {
                    // First, try to use the navigation preload response if it's supported.
                    const preloadResponse = await event.preloadResponse;
                    if (preloadResponse) {
                        return preloadResponse;
                    }

                    // Always try the network first.
                    const networkResponse = await fetch(event.request);
                    return networkResponse;
                } catch (error) {
                    // catch is only triggered if an exception is thrown, which is likely
                    // due to a network error.
                    // If fetch() returns a valid HTTP response with a response code in
                    // the 4xx or 5xx range, the catch() will NOT be called.
                    console.log('Fetch failed; returning offline page instead.', error);

                    const cache = await caches.open(CACHE_NAME);
                    const cachedResponse = await cache.match(OFFLINE_URL);
                    return cachedResponse || new Response("You are offline.", { status: 200, headers: { 'Content-Type': 'text/plain' } });
                }
            })()
        );
    }

    // For non-navigation requests (styles, scripts, images), try network first, then cache?
    // Or Stale-while-revalidate? 
    // Network first is safest for dynamic app.
});
