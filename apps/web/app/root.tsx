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
    type MetaFunction,
} from "react-router";
import { useEffect } from "react";
import { ClerkProvider } from "@clerk/react-router";
import { rootAuthLoader } from "@clerk/react-router/server";
import { ThemeProvider } from "./components/ThemeProvider";

import styles from "./index.css?url";

export const links: LinksFunction = () => [
    { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" },
    { rel: "stylesheet", href: styles },
    { rel: "manifest", href: "/manifest.json" },
    { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
];

export const meta: MetaFunction = () => [
    { title: "Studio Platform" },
    { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" },
    { name: "theme-color", content: "#18181B" },
    { name: "mobile-web-app-capable", content: "yes" },
    { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
];

export async function loader(args: LoaderFunctionArgs) {
    try {
        return await rootAuthLoader(args, ({ request }) => {
            return { message: "Auth Loaded" };
        });
    } catch (e: any) {
        if (e instanceof Response) {
            throw e;
        }
        console.error("DEBUG: rootAuthLoader CRASHED", e);
        throw new Response(`Root Auth Crash: ${e.message}`, { status: 500 });
    }
}

import { Toaster } from "sonner";

export default function App() {
    const loaderData = useLoaderData<typeof loader>();

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
                for (const registration of registrations) {
                    registration.unregister();
                    console.log('SW unregistered');
                }
            });
        }
    }, []);

    return (
        <ClerkProvider loaderData={loaderData} signUpFallbackRedirectUrl="/" signInFallbackRedirectUrl="/dashboard">
            <ThemeProvider defaultTheme="light" storageKey="studio-theme">
                <html lang="en" suppressHydrationWarning>
                    <head>
                        <meta charSet="utf-8" />
                        <Meta />
                        <Links />
                        {/* Google Analytics */}
                        {(loaderData as any)?.env?.VITE_GA_ID && (
                            <>
                                <script async src={`https://www.googletagmanager.com/gtag/js?id=${(loaderData as any).env.VITE_GA_ID}`}></script>
                                <script dangerouslySetInnerHTML={{
                                    __html: `
                                    window.dataLayer = window.dataLayer || [];
                                    function gtag(){dataLayer.push(arguments);}
                                    gtag('js', new Date());
                                    gtag('config', '${(loaderData as any).env.VITE_GA_ID}');
                                `}} />
                            </>
                        )}
                        {/* Emergency SW Kill Script - runs before hydration */}
                        <script dangerouslySetInnerHTML={{
                            __html: `
                            if ('serviceWorker' in navigator && !sessionStorage.getItem('sw_killed_v3')) {
                                navigator.serviceWorker.getRegistrations().then(registrations => {
                                    if (registrations.length > 0) {
                                        for (let r of registrations) r.unregister();
                                        sessionStorage.setItem('sw_killed_v3', 'true');
                                        window.location.reload();
                                    }
                                });
                            }
                        `}} />
                    </head>
                    <body className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans antialiased selection:bg-blue-100 dark:selection:bg-blue-900" suppressHydrationWarning>
                        <Outlet />
                        <Toaster position="top-right" richColors />
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
