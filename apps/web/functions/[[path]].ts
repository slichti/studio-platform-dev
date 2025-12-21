import { createPagesFunctionHandler } from "@react-router/cloudflare";

// Dynamic import to catch build-time/init-time crashes
export const onRequest = async (context: any) => {
    try {
        // @ts-ignore - dynamic import of build
        const build = await import("../build/server");

        const handler = createPagesFunctionHandler({
            build,
            getLoadContext: (args: any) => ({
                env: args.context.cloudflare.env,
            }),
        });

        return handler(context);
    } catch (e: any) {
        return new Response(`
            <h1>🔥 Critical Bundle Import Error 🔥</h1>
            <p>The server bundle failed to load (init crash).</p>
            <pre>${e.stack || e.message}</pre>
        `, {
            status: 200,
            headers: { "Content-Type": "text/html" }
        });
    }
};
