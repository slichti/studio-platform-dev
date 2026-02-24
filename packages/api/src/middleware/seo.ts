import { Context, Next } from 'hono';
import { SchemaFactory } from '../services/schema-factory';
import { createDb } from '../db';
import { tenants, classes, videos } from '@studio/db/src/schema';
import { eq, and } from 'drizzle-orm';

export const seoMiddleware = async (c: Context, next: Next) => {
    // Only apply to HTML GET requests for studio pages
    if (c.req.method !== 'GET') {
        return await next();
    }

    const tenant = c.get('tenant');
    if (!tenant) return await next();

    await next();

    // If response is not HTML, skip
    const contentType = c.res.headers.get('Content-Type');
    if (!contentType || !contentType.includes('text/html')) {
        return;
    }

    const seoConfig = (tenant.seoConfig || {}) as any;
    const titleTemplate = seoConfig.titleTemplate || '{{studioName}} | Studio Platform';
    const title = titleTemplate.replace('{{studioName}}', tenant.name);

    // AI Meta-Gen / Dynamic Fallback
    let description = seoConfig.defaultMetaDescription || `Book classes and manage your memberships at ${tenant.name}.`;

    const injectedTags = [
        `<title>${title}</title>`,
        `<meta property="og:title" content="${title}">`,
        `<meta property="og:type" content="website">`,
        `<meta name="twitter:card" content="summary_large_image">`
    ];

    // Use SchemaFactory for Tier 2/3 schemas
    let schemas: any[] = [SchemaFactory.generateLocalBusiness(tenant)];

    const db = createDb(c.env.DB);

    // Detect if class page for Event Schema
    const classMatch = c.req.path.match(/\/studios\/[^\/]+\/classes\/([^\/]+)/);
    if (classMatch) {
        const classId = classMatch[1];
        try {
            const cls = await db.query.classes.findFirst({
                where: and(eq(classes.id, classId), eq(classes.tenantId, tenant.id))
            });
            if (cls) {
                schemas.push(SchemaFactory.generateEvent(cls, tenant));
                // Update description if it's a default/generic one
                if (cls.description && description.includes(tenant.name)) {
                    description = cls.description.substring(0, 160);
                }
            }
        } catch (e) {
            console.error('SEO Middleware Class Fetch Error:', e);
        }
    }

    // Detect if video page for VideoObject Schema (Tier 3)
    const videoMatch = c.req.path.match(/\/studios\/[^\/]+\/videos\/([^\/]+)/);
    if (videoMatch) {
        const videoId = videoMatch[1];
        try {
            const vid = await db.query.videos.findFirst({
                where: and(eq(videos.id, videoId), eq(videos.tenantId, tenant.id))
            });
            if (vid) {
                schemas.push(SchemaFactory.generateVideoObject(vid, tenant));
                if (vid.description) description = vid.description.substring(0, 160);
            }
        } catch (e) {
            console.error('SEO Middleware Video Fetch Error:', e);
        }
    }

    injectedTags.push(`<meta name="description" content="${description}">`);
    injectedTags.push(`<meta property="og:description" content="${description}">`);

    const schemaTag = `<script type="application/ld+json">${JSON.stringify(schemas.length === 1 ? schemas[0] : schemas)}</script>`;

    // Injector logic
    class MetaInjector {
        element(element: any) {
            element.append(injectedTags.join('\n') + '\n' + schemaTag, { html: true });
        }
    }

    // Edge-based HTML Rewriter
    const rewriter = new HTMLRewriter().on('head', new MetaInjector());

    // Transform and replace the response
    const transformedResponse = rewriter.transform(c.res);
    c.res = new Response(transformedResponse.body, transformedResponse);
};
