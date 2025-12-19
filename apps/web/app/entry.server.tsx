import type { AppLoadContext, EntryContext } from "react-router";
import { ServerRouter } from "react-router";
import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";

export default async function handleRequest(
    request: Request,
    responseStatusCode: number,
    responseHeaders: Headers,
    routerContext: EntryContext,
    loadContext: AppLoadContext
) {
    let body = await renderToReadableStream(
        <ServerRouter context={routerContext} url={request.url} />,
        {
            signal: request.signal,
            onError(error: unknown) {
                // Log streaming rendering errors from inside the shell
                console.error("SSR Error:", error);
                // In dev/debug, we can try to surface this. 
                // We'll rely on the console log which the browser tool captures, 
                // but if that fails, we might need to modify the stream, which is hard once started.
                responseStatusCode = 500;
            },
        }
    );

    if (isbot(request.headers.get("user-agent") || "")) {
        await body.allReady;
    }

    // DEBUG: Wrap stream to inject errors if any occur during start
    const transformStream = new TransformStream({
        start(controller) {
            controller.enqueue(new TextEncoder().encode("<!DOCTYPE html>\n"));
        },
        flush(controller) {
            // If we could detect error here we would, but usually it's too late.
        }
    });

    // Attempting to catch synchronous errors before streaming starts
    try {
        // This is just the shell, typically generic errors happen here.
    } catch (e) {
        return new Response(`<h1>Server Start Error</h1><pre>${e instanceof Error ? e.message : 'Unknown'}</pre>`, { status: 500, headers: { 'Content-Type': 'text/html' } });
    }

    return new Response(body.pipeThrough(transformStream), {
        headers: responseHeaders,
        status: responseStatusCode,
    });
}
