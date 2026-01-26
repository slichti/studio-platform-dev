import { type LoaderFunctionArgs } from "react-router";
// import { getTenant } from "~/utils/subdomain.server"; 

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const url = new URL(request.url);
    const origin = url.origin;

    // We would typically fetch dynamic pages here (e.g. classes, teachers)
    // For now, static sitemap for core pages

    const pages = [
        "",
        "/schedule",
        "/pricing",
        "/instructors",
        "/contact"
    ];

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${pages.map(page => `
    <url>
        <loc>${origin}${page}</loc>
        <changefreq>daily</changefreq>
        <priority>${page === "" ? "1.0" : "0.8"}</priority>
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
