// @ts-ignore
import { Outlet, Link, useLoaderData, Form, redirect, NavLink } from "react-router";
// @ts-ignore
import { LoaderFunction } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { UserButton } from "@clerk/react-router";
import Layout from "../components/Layout";
import { apiRequest } from "../utils/api";

export const loader: LoaderFunction = async (args) => {
    const { userId, getToken } = await getAuth(args);
    if (!userId) {
        return redirect("/sign-in");
    }

    const token = await getToken();
    let isSystemAdmin = false;
    let tenants: any[] = [];
    let userProfile: any = null;

    try {
        const user = await apiRequest("/users/me", token);
        if (user) {
            if (user.isSystemAdmin) {
                isSystemAdmin = true;
            }
            tenants = user.tenants || [];
            userProfile = user;
        }
    } catch (e) {
        // Fail gracefully if we can't fetch profile
        console.error("Failed to fetch user profile", e);
    }

    return { isSystemAdmin, tenants, userProfile };
};

export default function DashboardRoute() {
    const { isSystemAdmin } = useLoaderData<{ isSystemAdmin: boolean }>();

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

    if (isSystemAdmin) {
        navItems.push(
            <div key="separator" className="my-2 border-t border-zinc-200 dark:border-zinc-800" />
        );
        navItems.push(
            <NavLink
                key="admin"
                to="/admin"
                className="block px-3 py-2 rounded-md text-sm font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
            >
                🛡️ System Admin
            </NavLink>
        );
    }

    return (
        <Layout navItems={navItems}>
            <Outlet />
        </Layout>
    );
}
