
import { Outlet, useLoaderData, useParams } from "react-router";
import { LoaderFunction } from "react-router";
import { apiRequest } from "~/utils/api";

export const loader: LoaderFunction = async (args) => {
    // Kiosk is public-ish but gated by PIN flow.
    // We check if the Kiosk feature is enabled for this tenant.
    const slug = args.params.slug;

    // We can't really "load" much without headers if we are unauthenticated.
    // The underlying requests in children will handle auth.
    // But we might want basic branding.
    try {
        const res = await fetch(`${(args.context as any).ENV.API_URL}/public/tenant/${slug}`).then(r => r.json());
        if (res.error) throw new Error(res.error);
        return { tenant: res };
    } catch (e) {
        return { tenant: null, error: "Studio not found" };
    }
};

export default function KioskLayout() {
    const { tenant } = useLoaderData<any>();

    if (!tenant) return <div className="h-screen flex items-center justify-center bg-zinc-950 text-white">Studio Not Found</div>;

    const brandColor = (tenant.branding as any)?.primaryColor || '#7c3aed';

    return (
        <div className="h-screen w-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white overflow-hidden flex flex-col font-sans selection:bg-purple-500/30">
            {/* Header */}
            <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-6 bg-white dark:bg-zinc-900 shrink-0">
                <div className="flex items-center gap-3">
                    {(tenant.branding as any)?.logoUrl && (
                        <img src={(tenant.branding as any).logoUrl} className="h-8 w-8 object-contain" alt="Logo" />
                    )}
                    <span className="font-bold text-lg tracking-tight">{tenant.name}</span>
                </div>
                <div className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-bold uppercase rounded tracking-wider">
                    Kiosk Mode
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 relative overflow-y-auto">
                <Outlet context={{ tenant, brandColor }} />
            </main>
        </div>
    );
}
