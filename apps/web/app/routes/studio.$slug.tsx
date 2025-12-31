// @ts-ignore
import { Outlet, useLoaderData, useParams, NavLink, redirect, Link } from "react-router";
// @ts-ignore
import type { LoaderFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { apiRequest } from "../utils/api";
import { UserButton } from "@clerk/react-router";
import {
    LayoutGrid,
    Calendar,
    Users,
    Settings,
    CreditCard,
    Dumbbell,
    DollarSign,
    FileSignature,
    AlertTriangle,
    Package,
    RefreshCw
} from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";

export const loader = async (args: LoaderFunctionArgs) => {
    const { params, request } = args;
    const { userId, getToken } = await getAuth(args);

    if (!userId) {
        return redirect(`/sign-in?redirect_url=${request.url}`);
    }

    const { slug } = params;
    if (!slug) return redirect("/");

    const token = await getToken();

    try {
        const tenantInfo = await apiRequest(`/tenant/info`, token, {
            headers: { 'X-Tenant-Slug': slug }
        });

        // Fetch My Role in this specific tenant
        if (tenantInfo.error) {
            console.error("Studio layout loader: Tenant fetch error", tenantInfo.error);
            throw new Response("Studio Not Found", { status: 404 });
        }

        // Status Enforcement
        if (tenantInfo.status === 'suspended') {
            throw new Response("This studio has been suspended by the platform administrator.", { status: 403 });
        }

        const me = await apiRequest(`/tenant/me`, token, {
            headers: { 'X-Tenant-Slug': slug }
        });

        return {
            slug: params.slug,
            tenant: tenantInfo,
            me,
            isPaused: tenantInfo.status === 'paused',
            features: tenantInfo.features || []
        };
    } catch (e: any) {
        if (e instanceof Response) throw e;

        console.error("Studio layout loader failed:", e);
        throw new Response("Studio Not Found or Access Denied", { status: 404 });
    }
};

export default function StudioLayout() {
    const { slug, tenant, me, isPaused, features } = useLoaderData<typeof loader>();
    const featureSet = new Set(features);

    return (
        <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 transition-colors duration-300">
            {/* Sidebar */}
            <aside className="w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col fixed inset-y-0 z-20 transition-colors duration-300">
                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                    <Link to={`/studio/${slug}`} className="flex items-center gap-2 group">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold group-hover:scale-105 transition-transform">
                            {tenant.name.substring(0, 1)}
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-sm leading-tight text-zinc-900 dark:text-zinc-100">{tenant.name}</span>
                            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">/studio/{slug}</span>
                        </div>
                    </Link>
                </div>

                <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                    <NavItem to={`/studio/${slug}`} end icon={<LayoutGrid size={18} />}>Dashboard</NavItem>
                    <NavItem to="schedule" icon={<Calendar size={18} />}>Schedule</NavItem>
                    <NavItem to="memberships" icon={<CreditCard size={18} />}>Memberships</NavItem>
                    <NavItem to="commerce/packs" icon={<Package size={18} />}>Class Packs</NavItem>
                    <NavItem to="students" icon={<Users size={18} />}>Students</NavItem>
                    <NavItem to="classes" icon={<Dumbbell size={18} />}>Classes</NavItem>
                    <NavItem to="substitutions" icon={<RefreshCw size={18} />}>Substitutions</NavItem>
                    <NavItem to="finances" icon={<DollarSign size={18} />}>Finances</NavItem>
                    <NavItem to="waivers" icon={<FileSignature size={18} />}>Waivers</NavItem>
                    <NavItem to="settings" icon={<Settings size={18} />}>Settings</NavItem>
                </nav>

                <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <UserButton />
                        <div className="flex flex-col overflow-hidden">
                            <span className="text-sm font-medium truncate text-zinc-900 dark:text-zinc-200">
                                {me.firstName} {me.lastName}
                            </span>
                            <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{me.email}</span>
                        </div>
                    </div>
                    <ThemeToggle />
                </div>
            </aside >

            {/* Main Content */}
            < main className="flex-1 ml-64 flex flex-col min-w-0" >
                {isPaused && (
                    <div className="bg-amber-100 border-b border-amber-200 text-amber-800 px-6 py-3 text-sm font-medium flex items-center gap-2">
                        <AlertTriangle size={16} />
                        <span>This studio is currently paused. Some features may be restricted.</span>
                    </div>
                )
                }
                <div className="flex-1 overflow-auto">
                    <Outlet context={{ tenant, me, features: featureSet }} />
                </div>
            </main >
        </div >
    );
}

function NavItem({ to, children, icon, end }: { to: string, children: React.ReactNode, icon: React.ReactNode, end?: boolean }) {
    return (
        <NavLink
            to={to}
            end={end}
            className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm transition-colors mb-0.5 flex items-center gap-3 ${isActive
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`
            }
        >
            {icon}
            {children}
        </NavLink>
    );
}


