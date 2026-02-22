
import { Outlet, useLoaderData } from "react-router";

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

import { useRef, useEffect } from "react";
export default function EmbedLayout() {
    const { tenant } = useLoaderData<typeof loader>() as any;
    const containerRef = useRef<HTMLDivElement>(null);

    // Auto-resize host iframe
    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            const height = entries[0].contentRect.height;
            window.parent.postMessage({
                type: 'studio-resize',
                slug: tenant.slug,
                height: height
            }, '*');
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [tenant.slug]);

    // Apply Branding
    const style = tenant.branding ? {
        '--primary': tenant.branding.primaryColor || '#3b82f6',
        '--font-sans': tenant.branding.font || 'Inter',
    } as any : {};

    return (
        <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
            <div ref={containerRef} style={style} className="font-sans antialiased bg-transparent transition-all duration-200">
                <style>{`
                    :root {
                        --radius: 0.5rem;
                    }
                    body { background: transparent !important; }
                `}</style>
                <Outlet context={{ tenant }} />
            </div>
        </ThemeProvider>
    );
}
