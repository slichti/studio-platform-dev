import {
    Links,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
    useLoaderData,
    useRouteError,
    type LinksFunction,
    type LoaderFunctionArgs,
} from "react-router";
import { ClerkProvider } from "@clerk/react-router";
import { rootAuthLoader } from "@clerk/react-router/ssr.server";

export const links: LinksFunction = () => [
    { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" },
];

export async function loader(args: LoaderFunctionArgs) {
    const { context } = args;
    // Environment variable check
    const env = (context as any).env || {};
    const pubKey = env.CLERK_PUBLISHABLE_KEY;
    const secretKey = env.CLERK_SECRET_KEY;

    if (!pubKey || !secretKey || pubKey === 'pk_test_...' || secretKey === 'sk_test_...') {
        console.error("Missing or invalid Clerk Keys in environment");
        const availableKeys = Object.keys(env);
        console.error("Available keys:", availableKeys);

        const debugContextKeys = (context as any).debugContextKeys || [];
        const debugEnvKeys = (context as any).debugEnvKeys || [];
        const debugCloudflareKeys = (context as any).debugCloudflareKeys || [];

        // Return a response that triggers the ErrorBoundary or handled in component
        // throwing specific response allows us to catch it easily
        throw new Response(
            JSON.stringify({
                error: "Clerk Keys Missing or Invalid",
                availableEnvKeys: availableKeys,
                debugContextKeys,
                debugEnvKeys,
                debugCloudflareKeys
            }),
            { status: 503, statusText: "Service Configuration Error" }
        );
    }

    return rootAuthLoader(args, ({ request }) => {
        return { message: "Auth Loaded" };
    });
}

export default function App() {
    const loaderData = useLoaderData<typeof loader>();

    return (
        <ClerkProvider loaderData={loaderData} signUpFallbackRedirectUrl="/" signInFallbackRedirectUrl="/dashboard">
            <html lang="en">
                <head>
                    <meta charSet="utf-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1" />
                    <Meta />
                    <Links />
                </head>
                <body style={{ margin: 0, padding: 0, fontFamily: "'Inter', sans-serif", background: '#ffffff', color: '#18181b' }}>
                    <Outlet />
                    <ScrollRestoration />
                    <Scripts />
                </body>
            </html>
        </ClerkProvider>
    );
}

export function ErrorBoundary() {
    const error = useRouteError();
    console.error(error);
    return (
        <html lang="en">
            <head>
                <title>Oh no!</title>
                <Meta />
                <Links />
            </head>
            <body style={{ padding: "20px", fontFamily: "system-ui" }}>
                <h1>App Error</h1>
                <pre>{error instanceof Error ? error.message : JSON.stringify(error)}</pre>
                <Scripts />
            </body>
        </html>
    );
}
