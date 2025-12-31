// @ts-ignore
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
import { ThemeProvider } from "./components/ThemeProvider";

import styles from "./index.css?url";

export const links: LinksFunction = () => [
    { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" },
    { rel: "stylesheet", href: styles },
];

// Restore Loader
export async function loader(args: LoaderFunctionArgs) {
    try {
        console.log("DEBUG: Executing rootAuthLoader");
        return await rootAuthLoader(args, ({ request }) => {
            console.log("DEBUG: rootAuthLoader callback executing");
            return { message: "Auth Loaded" };
        });
    } catch (e: any) {
        // If the error is a Response (like a redirect), re-throw it!
        if (e instanceof Response) {
            throw e;
        }
        console.error("DEBUG: rootAuthLoader CRASHED", e);
        throw new Response(`Root Auth Crash: ${e.message}`, { status: 500 });
    }
}

export default function App() {
    const loaderData = useLoaderData<typeof loader>();

    return (
        <ClerkProvider loaderData={loaderData} signUpFallbackRedirectUrl="/" signInFallbackRedirectUrl="/dashboard">
            <ThemeProvider defaultTheme="system" storageKey="studio-theme">
                <html lang="en">
                    <head>
                        <meta charSet="utf-8" />
                        <meta name="viewport" content="width=device-width, initial-scale=1" />
                        <Meta />
                        <Links />
                    </head>
                    <body className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans antialiased selection:bg-blue-100 dark:selection:bg-blue-900">
                        <Outlet />
                        <ScrollRestoration />
                        <Scripts />
                    </body>
                </html>
            </ThemeProvider>
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
