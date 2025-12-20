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
                responseStatusCode = 500;
            },
        }
    );

    if (responseStatusCode === 500) {
        // logic to handle early errors?
    }


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
    } catch (e: any) {
        console.error("Server Start Error Details:", e);
        return new Response(`
            <h1>Server Start Error</h1>
            <p>The server crashed before it could start streaming.</p>
            <pre>${e instanceof Error ? e.stack : JSON.stringify(e)}</pre>
            <hr>
            <p>Ensure CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY are set.</p>
        `, {
            status: 500,
            headers: { 'Content-Type': 'text/html' }
        });
    }

    return new Response(body.pipeThrough(transformStream), {
        headers: responseHeaders,
        status: responseStatusCode,
    });
}
