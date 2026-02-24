import { Context, Next } from 'hono';
import { createDb } from '../db';
import { tenants } from '@studio/db/src/schema';

export const seoMiddleware = async (c: Context, next: Next) => {
    // We only want to rewrite if we are proxying or returning HTML.
    // Wait for the response to be produced.
    await next();

    const contentType = c.res.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
        return;
    }

    // Retrieve tenant context set by tenantMiddleware
    const tenant = c.get('tenant') as any;
    if (!tenant) return;

    // Retrieve SEO Config
    const seoConfig = (tenant.seoConfig as any) || {};

    // Format Meta Data
    const metaTitle = seoConfig.titleTemplate
        ? seoConfig.titleTemplate.replace('{Studio_Name}', tenant.name)
        : `${tenant.name} - Boutique Fitness`;

    const metaDescription = seoConfig.defaultMetaDescription || `Book classes and learn more about ${tenant.name}.`;

    // Basic HTML Tags
    const injectedTags = `
    <title>${metaTitle}</title>
    <meta name="description" content="${metaDescription}" />
    <meta property="og:title" content="${metaTitle}" />
    <meta property="og:description" content="${metaDescription}" />
  `;

    // JSON-LD Schema (LocalBusiness / YogaStudio / ExerciseGym)
    const schemaType = seoConfig.defaultSchemaType || 'ExerciseGym';
    const schemaJsonLd = {
        "@context": "https://schema.org",
        "@type": schemaType,
        "name": tenant.name,
        "url": `https://studio-platform.com/studios/${tenant.slug}`,
    };

    const schemaTag = `<script type="application/ld+json">${JSON.stringify(schemaJsonLd)}</script>`;

    // Injector logic
    class MetaInjector {
        element(element: any) {
            element.append(injectedTags + '\\n' + schemaTag, { html: true });
        }
    }

    // Edge-based HTML Rewriter
    const rewriter = new HTMLRewriter().on('head', new MetaInjector());

    // Transform and replace the response
    const transformedResponse = rewriter.transform(c.res);
    c.res = new Response(transformedResponse.body, transformedResponse);
};
