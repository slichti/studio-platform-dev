
import { type LoaderFunctionArgs } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    return new Response(`
    <html>
        <head><title>SSR Debug</title></head>
        <body style="font-family:system-ui; padding:2rem;">
            <h1>SSR is Working</h1>
            <p>Time: ${new Date().toISOString()}</p>
            <p>Url: ${request.url}</p>
            <pre>
Headers:
${JSON.stringify(Object.fromEntries(request.headers.entries()), null, 2)}
            </pre>
        </body>
    </html>
    `, {
        headers: {
            "Content-Type": "text/html",
        }
    });
};

export default function DebugSSR() {
    return null; // Should not be rendered if loader returns Response
}
