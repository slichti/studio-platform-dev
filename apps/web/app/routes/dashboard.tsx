
import { Outlet, Link, useLoaderData, Form, redirect } from "react-router";
import { LoaderFunction } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { UserButton } from "@clerk/react-router";
import Layout from "../components/Layout";

export const loader: LoaderFunction = async (args) => {
    const { userId } = await getAuth(args);
    if (!userId) {
        return redirect("/sign-in");
    }
    return {};
};

export default function DashboardRoute() {
    return (
        <Layout>
            <Outlet />
        </Layout>
    );
}
