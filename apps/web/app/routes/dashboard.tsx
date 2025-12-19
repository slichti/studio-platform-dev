import { Outlet, redirect } from "@remix-run/react";
import { getAuth } from "@clerk/remix/ssr.server";
import { LoaderFunction } from "@remix-run/cloudflare";
import Layout from "../components/Layout";

export const loader: LoaderFunction = async (args) => {
    const { userId } = await getAuth(args);
    if (!userId) {
        return redirect("/sign-in");
    }
    return null;
};

export default function DashboardRoute() {
    return (
        <Layout>
            <Outlet />
        </Layout>
    );
}
