
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

export default function DashboardRoute() {
    const { isPlatformAdmin, userProfile } = useLoaderData<{ isPlatformAdmin: boolean, userProfile: any }>();

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
            {(isPlatformAdmin === false && (useLoaderData() as any).error) && (
                <div className="bg-red-50 text-red-700 p-4 border-b border-red-200 text-sm text-center">
                    Warning: Profile load failed. Admin features may be hidden. <br />
                    <span className="font-mono text-xs opacity-75">{(useLoaderData() as any).error}</span>
                </div>
            )}
            <Outlet />
        </Layout>
    );
}
