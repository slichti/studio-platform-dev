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
    console.log("Root Loader Context Keys:", Object.keys(context));
    // Check for Env in context
    if (context && typeof context === 'object' && 'env' in context) {
        console.log("Env keys available:", Object.keys((context as any).env));
    } else {
        console.log("No 'env' found in context");
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
                <body>
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
