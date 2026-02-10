
import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { lazy, Suspense } from "react";
import { ClientOnly } from "../components/ClientOnly";

const AdminVideosPage = lazy(() => import("../components/routes/AdminVideosPage"));

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken, userId } = await getAuth(args);
    if (!userId) return redirect("/sign-in");

    const token = await getToken();
    const url = new URL(args.request.url);
    const q = url.searchParams.get("q") || "";

    try {
        const [videosData, brandingData, tenantsData] = await Promise.all([
            apiRequest(`/admin/videos?q=${q}`, token),
            apiRequest('/admin/branding', token),
            apiRequest('/admin/tenants', token)
        ]) as [any, any, any];

        return {
            videos: videosData.videos || [],
            stats: videosData.stats || { totalVideos: 0, totalStorageBytes: 0, processingCount: 0 },
            brandingAssets: brandingData.assets || [],
            tenants: tenantsData || []
        };
    } catch (e) {
        console.error("Failed to fetch admin videos", e);
        return { videos: [], stats: { totalVideos: 0, totalStorageBytes: 0, processingCount: 0 }, brandingAssets: [], tenants: [] };
    }
};

export const action = async (args: ActionFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const formData = await args.request.formData();
    const intent = formData.get("intent");
    const id = formData.get("id");

    if (intent === "delete_video" && id) {
        await apiRequest(`/admin/videos/${id}`, token, { method: "DELETE" });
    }

    if (intent === "delete_branding" && id) {
        await apiRequest(`/admin/branding/${id}`, token, { method: "DELETE" });
    }

    return { success: true };
};

export default function AdminVideos() {
    return (
        <ClientOnly fallback={
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        }>
            <Suspense fallback={
                <div className="p-8 flex items-center justify-center min-h-[400px]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            }>
                <AdminVideosPage />
            </Suspense>
        </ClientOnly>
    );
}
