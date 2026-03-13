
import { Outlet, Link, useLoaderData, Form, redirect, NavLink } from "react-router";

import { LoaderFunction } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { UserButton } from "@clerk/react-router";
import Layout from "../components/Layout";
import { apiRequest } from "../utils/api";

export const loader: LoaderFunction = async (args) => {
    const { userId, getToken } = await getAuth(args);
    if (!userId) {
        return redirect("/sign-in");
    }

    const token = await getToken();
    let isPlatformAdmin = false;
    let tenants: any[] = [];
    let userProfile: any = null;

    let error = null;

    try {
        const user = await apiRequest("/users/me", token);
        if (user) {
            if (user.isPlatformAdmin || user.role === 'admin') {
                isPlatformAdmin = true;
            }
            tenants = user.tenants || [];
            userProfile = user;
        }
    } catch (e: any) {
        // Fail gracefully but expose error
        console.error("Failed to fetch user profile", e);
        error = e.message || "Failed to load profile";
    }

    if (isPlatformAdmin && tenants.length === 0) {
        return redirect("/admin");
    }

    return { isPlatformAdmin, tenants, userProfile, error };
};

type DashboardLoaderData = { isPlatformAdmin: boolean; tenants: any[]; userProfile: any; error: string | null };

export default function DashboardRoute() {
    const { isPlatformAdmin, userProfile, tenants, error } = useLoaderData<DashboardLoaderData>();

    let navItems = [
        <NavLink
            key="overview"
            to="/dashboard"
            end
            className={({ isActive }) =>
                `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                }`
            }
        >
            Overview
        </NavLink>
    ];

    if (isPlatformAdmin) {
        navItems.push(
            <div key="separator" className="my-2 border-t border-zinc-200 dark:border-zinc-800" />
        );
        navItems.push(
            <NavLink
                key="admin"
                to="/admin"
                className="block px-3 py-2 rounded-md text-sm font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
            >
                🛡️ Platform Admin
            </NavLink>
        );
    }

    return (
        <Layout navItems={navItems} role={userProfile?.role}>
            {(!isPlatformAdmin && error) && (
                <div className="bg-red-50 text-red-700 p-4 border-b border-red-200 text-sm text-center">
                    Warning: Profile load failed. Admin features may be hidden. <br />
                    <span className="font-mono text-xs opacity-75">{error}</span>
                </div>
            )}
            {tenants && tenants.length > 0 && (
                <section className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                            Your studios
                        </h2>
                        {tenants.length > 1 && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                                {tenants.length} studios
                            </span>
                        )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {tenants.map((t: any) => {
                            const hasStaffRole = (t.roles || []).some((r: string) =>
                                ['owner', 'admin', 'instructor', 'staff'].includes(r),
                            );
                            const primaryColor = t.branding?.primaryColor || '#4f46e5';
                            const href = hasStaffRole ? `/studio/${t.slug}` : `/portal/${t.slug}`;
                            return (
                                <Link
                                    key={t.id}
                                    to={href}
                                    className="group flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 hover:border-indigo-500 hover:shadow-sm transition-all"
                                >
                                    <div
                                        className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-semibold text-sm overflow-hidden"
                                        style={{ backgroundColor: primaryColor }}
                                    >
                                        {t.branding?.logoUrl ? (
                                            <img
                                                src={t.branding.logoUrl}
                                                alt={t.name}
                                                className="w-full h-full object-contain bg-white/5"
                                            />
                                        ) : (
                                            (t.name || 'Studio').substring(0, 1).toUpperCase()
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50 truncate">
                                                {t.name}
                                            </span>
                                            {hasStaffRole && (
                                                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-200">
                                                    Staff
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                                            {hasStaffRole ? `/studio/${t.slug}` : `/portal/${t.slug}`}
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </section>
            )}
            <Outlet />
        </Layout>
    );
}
