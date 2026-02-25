import { type LoaderFunctionArgs } from "react-router";

const FALLBACK_ROBOTS = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /studio",
    "Disallow: /sign-in",
    "Disallow: /documentation",
    "Disallow: /create-studio",
    "Sitemap: https://studio-platform.com/sitemap.xml",
].join("\n");

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
    const apiUrl =
        (context as any)?.cloudflare?.env?.VITE_API_URL ||
        (typeof process !== "undefined" && process.env?.VITE_API_URL) ||
        (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_URL) ||
        "https://studio-platform-api.slichti.workers.dev";

    try {
        const res = await fetch(`${apiUrl}/public/robots.txt`, {
            headers: { "Accept": "text/plain" },
        });
        if (res.ok) {
            const content = await res.text();
            return new Response(content, {
                headers: {
                    "Content-Type": "text/plain; charset=utf-8",
                    "Cache-Control": res.headers.get("Cache-Control") || "public, max-age=3600",
                },
            });
        }
    } catch {
        // fall through to fallback
    }

    return new Response(FALLBACK_ROBOTS, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
        },
    });
};
