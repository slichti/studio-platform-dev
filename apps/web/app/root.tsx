
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
import { rootAuthLoader } from "./utils/auth-wrapper.server";
import { ThemeProvider } from "./components/ThemeProvider";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/query-client";
import { ClientOnly } from "./components/ClientOnly";

import styles from "./index.css?url";

export const links: LinksFunction = () => [
    { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" },
    { rel: "stylesheet", href: styles },
    { rel: "manifest", href: "/manifest.json" },
    { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
];

export const meta: MetaFunction = () => [
    { title: "Studio Platform – Yoga Studio & Small Gym Management Software" },
    { name: "description", content: "Studio Platform is yoga studio management software and small gym management software. Run your fitness studio, yoga studio, or boutique gym with class scheduling, memberships, payments, and more." },
    { name: "keywords", content: "yoga studio management, small gym management, fitness studio software, studio management platform, gym hosting platform, yoga studio software, boutique gym management, class booking software" },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "theme-color", content: "#18181B" },
    { name: "mobile-web-app-capable", content: "yes" },
    { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
];

export async function loader(args: LoaderFunctionArgs) {
    console.log('[ROOT] Loader Start'); // DEBUG

    try {
        return await rootAuthLoader(args, ({ request }) => {
            console.log('[ROOT] AuthLoader Callback'); // DEBUG
            return {
                message: "Auth Loaded",
                env: {
                    VITE_API_URL: process.env.VITE_API_URL,
                    VITE_CLERK_PUBLISHABLE_KEY: process.env.VITE_CLERK_PUBLISHABLE_KEY,
                    VITE_GA_ID: process.env.VITE_GA_ID
                }
            };
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
        <ClerkProvider
            loaderData={loaderData}
            signUpFallbackRedirectUrl="/"
            signInFallbackRedirectUrl="/dashboard"
        >
            <QueryClientProvider client={queryClient}>
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
                            {/* E2E Bypass Injection: If server-side says it's bypassed, we can force-render here or rely on loaders */}
                            <Outlet context={loaderData} />
                            <ClientOnly>
                                <Toaster position="top-right" richColors />
                            </ClientOnly>
                            <ScrollRestoration />
                            <Scripts />
                            <script dangerouslySetInnerHTML={{
                                __html: `window.ENV = ${JSON.stringify((loaderData as any)?.env || {})}`
                            }} />
                        </body>
                    </html>
                </ThemeProvider>
            </QueryClientProvider>
        </ClerkProvider>
    );
}

export function ErrorBoundary() {
    const error = useRouteError();
    console.error(error);

    return (
        <html lang="en" className="h-full">
            <head>
                <title>Application Error</title>
                <Meta />
                <Links />
            </head>
            <body className="h-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-50">
                <div className="w-full max-w-md p-6 space-y-6 text-center">
                    <div className="flex justify-center">
                        <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/20">
                            <svg className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-2xl font-semibold tracking-tight">System Error</h1>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            We encountered an unexpected issue. Please try refreshing the page.
                        </p>
                    </div>

                    <div className="bg-zinc-100 dark:bg-zinc-900 rounded-md p-4 text-left overflow-auto max-h-48 text-xs font-mono border border-zinc-200 dark:border-zinc-800">
                        {error instanceof Error ? error.message : JSON.stringify(error)}
                    </div>

                    <div className="flex gap-4 justify-center">
                        <button
                            onClick={() => window.location.reload()}
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:ring-offset-zinc-950 dark:focus-visible:ring-zinc-300 bg-zinc-900 text-zinc-50 hover:bg-zinc-900/90 h-10 px-4 py-2 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-50/90"
                        >
                            Reload Page
                        </button>
                        <a
                            href="/"
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:ring-offset-zinc-950 dark:focus-visible:ring-zinc-300 border border-zinc-200 bg-white hover:bg-zinc-100 hover:text-zinc-900 h-10 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                        >
                            Go Home
                        </a>
                    </div>
                </div>
                <Scripts />
            </body>
        </html>
    );
}
