
import { lazy } from "react";
import { useLoaderData } from "react-router";
import { LoaderFunction, ActionFunction } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { ClientOnly } from "~/components/ClientOnly";

const SettingsIndexComponent = lazy(() => import("~/components/routes/SettingsIndex"));

export const action: ActionFunction = async (args) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const formData = await args.request.formData();
    const intent = formData.get("intent");
    const tenantSlug = args.params.slug;

    if (intent === "create_location") {
        const name = formData.get("name");
        const address = formData.get("address");

        if (!name) return { error: "Name is required" };

        try {
            await apiRequest(`/locations`, token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': tenantSlug },
                body: JSON.stringify({
                    name,
                    address
                })
            });
            return { success: true };
        } catch (e) {
            return { error: "Failed to create location" };
        }
    }

    if (intent === "delete_location") {
        const id = formData.get("id");
        try {
            await apiRequest(`/locations/${id}`, token, {
                method: "DELETE",
                headers: { 'X-Tenant-Slug': tenantSlug }
            });
            return { success: true };
        } catch (e) {
            return { error: "Failed to delete location" };
        }
    }

    return null;
};

export const loader: LoaderFunction = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const slug = args.params.slug;

    let locations = [];
    try {
        // Use X-Tenant-Slug to avoid pre-fetching tenant by ID
        const res = await apiRequest(`/locations`, token, {
            headers: { 'X-Tenant-Slug': slug }
        });
        locations = res.locations || [];
    } catch (e: any) {
        console.error("Failed to load locations", e);
        // Non-blocking
    }

    return { locations, token };
};

export default function SettingsIndex() {
    const { locations } = useLoaderData<any>();

    return (
        <ClientOnly fallback={<div className="p-8 animate-pulse bg-zinc-50 dark:bg-zinc-900 rounded-xl h-96" />}>
            <SettingsIndexComponent locations={locations} />
        </ClientOnly>
    );
}
