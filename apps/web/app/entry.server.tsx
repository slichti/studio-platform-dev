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

    if (isbot(request.headers.get("user-agent") || "")) {
        await body.allReady;
    }

    responseHeaders.set("Content-Type", "text/html");
    // Prepend DOCTYPE
    return new Response(body.pipeThrough(new TransformStream({
        start(controller) {
            controller.enqueue(new TextEncoder().encode("<!DOCTYPE html>\n"));
        }
    })), {
        headers: responseHeaders,
        status: responseStatusCode,
    });
}
