import { createRequestHandler } from "@react-router/cloudflare";
// @ts-ignore - The build file is generated at build time
import * as build from "./_server.js";

// Base domain pattern for subdomain detection
// Format: {slug}.studio-platform-dev.slichti.org
const BASE_DOMAIN = "studio-platform-dev.slichti.org";

// Reserved subdomains that should NOT be treated as studio slugs
const RESERVED_SUBDOMAINS = ['www', 'api', 'admin', 'app', 'mail', 'staging', 'dev', 'test'];

/**
 * Detect if request is from a studio subdomain and rewrite URL if so.
 * Example: garden-yoga.studio-platform-dev.slichti.org → /site/garden-yoga/home
 */
function handleSubdomain(request: Request): Request {
    const url = new URL(request.url);
    const hostname = url.hostname;

    // Check if this is a subdomain request
    if (hostname.endsWith(BASE_DOMAIN) && hostname !== BASE_DOMAIN) {
        // Extract the subdomain (studio slug)
        const subdomain = hostname.replace(`.${BASE_DOMAIN}`, '');

        // Skip reserved subdomains
        if (RESERVED_SUBDOMAINS.includes(subdomain.toLowerCase())) {
            return request;
        }

        // Only rewrite if path is root or /home
        // Other paths like /schedule should also be rewritten
        const path = url.pathname;

        if (path === '/' || path === '') {
            // Rewrite to /site/{slug}/home
            url.pathname = `/site/${subdomain}/home`;
        } else if (!path.startsWith('/site/') && !path.startsWith('/studio/') && !path.startsWith('/embed/')) {
            // For other paths on subdomain, prepend /site/{slug}
            // Example: garden-yoga.domain.com/about → /site/garden-yoga/about
            url.pathname = `/site/${subdomain}${path}`;
        }

        // Create new request with rewritten URL
        return new Request(url.toString(), {
            method: request.method,
            headers: request.headers,
            body: request.body,
            redirect: request.redirect,
            // @ts-ignore - Cloudflare specific
            cf: (request as any).cf,
        });
    }

    return request;
}

// Create the React Router request handler
const requestHandler = createRequestHandler({ build: build as any });

export const onRequest: PagesFunction = async (context) => {
    // Apply subdomain detection and URL rewriting
    const rewrittenRequest = handleSubdomain(context.request);

    // Pass to React Router with enhanced context matching Cloudflare Workers adapter expectations
    const loadContext = {
        ...context,
        cloudflare: {
            // @ts-ignore
            cf: rewrittenRequest.cf || context.request.cf,
            env: context.env,
            ctx: {
                waitUntil: context.waitUntil.bind(context),
                passThroughOnException: context.passThroughOnException.bind(context),
            }
        }
    };

    return requestHandler(rewrittenRequest, loadContext);
};
