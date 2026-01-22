// @ts-ignore
import { Outlet, useLoaderData } from "react-router";
// @ts-ignore
import type { LoaderFunctionArgs } from "react-router";
import { ThemeProvider } from "../components/ThemeProvider";

export const loader = async ({ params }: LoaderFunctionArgs) => {
    const { slug } = params;
    // Use public endpoint
    const API_URL = (import.meta as any).env.VITE_API_URL || "http://localhost:8787";
    const res = await fetch(`${API_URL}/public/tenant/${slug}`);

    if (!res.ok) {
        throw new Response("Studio not found", { status: 404 });
    }

    const tenant = await res.json();
    return { tenant };
};

export default function EmbedLayout() {
    const { tenant } = useLoaderData<typeof loader>() as any;

    // Apply Branding
    const style = tenant.branding ? {
        '--primary': tenant.branding.primaryColor || '#3b82f6',
        '--font-sans': tenant.branding.font || 'Inter',
    } as React.CSSProperties : {};

    return (
        <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
            <div style={style} className="font-sans antialiased bg-transparent min-h-screen">
                <style>{`
                    :root {
                        --radius: 0.5rem;
                    }
                `}</style>
                <Outlet context={{ tenant }} />
            </div>
        </ThemeProvider>
    );
}
