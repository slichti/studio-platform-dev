import { createRequestHandler } from "react-router";
// @ts-ignore - The build file is generated at build time
import * as build from "./_server.js";

// Create the React Router request handler
const requestHandler = createRequestHandler(build as any);

export const onRequest: PagesFunction = async (context) => {
    // Pass to React Router with enhanced context matching Cloudflare Workers adapter expectations
    // We provide multiple aliases to cover different library expectations (Clerk, React Router, etc.)
    const loadContext = {
        ...context,
        context: context, // Helper alias
        platform: context, // Common adapter alias
        cloudflare: {
            cf: context.request.cf,
            env: context.env,
            ctx: {
                waitUntil: context.waitUntil.bind(context),
                passThroughOnException: context.passThroughOnException.bind(context),
            }
        }
    };

    try {
        return await requestHandler(context.request, loadContext);
    } catch (e: any) {
        console.error("DEBUG: requestHandler CRASHED:", e);
        console.error("DEBUG: Stack:", e.stack);
        return new Response("Internal Server Error: " + e.message, { status: 500 });
    }
};
