// @ts-ignore
import type { AppLoadContext, EntryContext } from "react-router";
// @ts-ignore
import { ServerRouter } from "react-router-dom";
import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";

export default async function handleRequest(
    request: Request,
    responseStatusCode: number,
    responseHeaders: Headers,
    routerContext: EntryContext,
    loadContext: AppLoadContext
) {
    try {
        let body = await renderToReadableStream(
            <ServerRouter context={routerContext} url={request.url} />,
            {
                signal: request.signal,
                onError(error: unknown) {
                    // Log streaming rendering errors from inside the shell
                    console.error("SSR Error:", error);
                    responseStatusCode = 500;
                },
            }
        );

        if (isbot(request.headers.get("user-agent") || "")) {
            await body.allReady;
        }

        responseHeaders.set("Content-Type", "text/html");
        // Emergency Cache Kill - only for HTML documents
        // responseHeaders.set("Clear-Site-Data", '"cache", "cookies", "storage"');
        responseHeaders.set("Cache-Control", "no-cache, no-store, must-revalidate");

        return new Response(body, {
            headers: responseHeaders,
            status: responseStatusCode,
        });
    } catch (e: any) {
        if (e instanceof Response) {
            return e;
        }
        console.error("CRITICAL WORKER CRASH:", e);
        return new Response(`
            <h1>🔥 Critical Worker Crash 🔥</h1>
            <p>${e.message}</p>
            <pre>${e.stack}</pre>
            <hr>
            <p>Environment: ${JSON.stringify(Object.keys(loadContext.context?.env || {}))}</p>
        `, {
            status: 200, // Return 200 to show the error page
            headers: { "Content-Type": "text/html" }
        });
    }
}
