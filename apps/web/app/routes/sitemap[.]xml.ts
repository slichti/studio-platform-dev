import { type LoaderFunctionArgs } from "react-router";
// import { getTenant } from "~/utils/subdomain.server"; 

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const url = new URL(request.url);
    const origin = url.origin;

    // We would typically fetch dynamic pages here (e.g. classes, teachers)
    // For now, static sitemap for core pages

    const pages = [
        { path: "", priority: "1.0" },
        { path: "/pricing", priority: "0.9" },
        { path: "/features", priority: "0.9" },
        { path: "/schedule", priority: "0.8" },
        { path: "/instructors", priority: "0.7" },
        { path: "/contact", priority: "0.7" },
    ];

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${pages.map(({ path, priority }) => `
    <url>
        <loc>${origin}${path}</loc>
        <changefreq>weekly</changefreq>
        <priority>${priority}</priority>
    </url>
    `).join('')}
</urlset>`;

    return new Response(sitemap, {
        headers: {
            "Content-Type": "application/xml",
            "xml-version": "1.0",
            "encoding": "UTF-8"
        },
    });
};
