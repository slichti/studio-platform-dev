import { type LoaderFunctionArgs } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const url = new URL(request.url);
    const host = url.host; // e.g., "yoga-studio.studio-platform.com" or "custom-domain.com"

    // Default: Allow everything
    let content = `
User-agent: *
Allow: /
Disallow: /admin
Disallow: /dashboard
    `.trim();

    // Logic to fetch tenant specific settings could go here
    // For now, we disallow admin paths for everyone

    return new Response(content, {
        headers: {
            "Content-Type": "text/plain",
        },
    });
};
