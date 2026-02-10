
import { lazy, Suspense } from "react";
import { LoaderFunctionArgs, redirect } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { ClientOnly } from "~/components/ClientOnly";

const MediaLibraryPage = lazy(() => import("~/components/routes/MediaLibraryPage"));

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken, userId } = await getAuth(args);
    const { slug } = args.params;
    if (!userId) return redirect("/sign-in");

    const token = await getToken();

    // Parallel fetch: Videos and Images
    try {
        const [videoData, imageData, collectionsData] = await Promise.all([
            apiRequest(`/video-management/`, token, { headers: { 'X-Tenant-Slug': slug as string } }),
            apiRequest(`/uploads/images`, token, { headers: { 'X-Tenant-Slug': slug as string } }),
            apiRequest(`/video-management/collections`, token, { headers: { 'X-Tenant-Slug': slug as string } })
        ]) as [any, any, any];

        return {
            videos: videoData?.videos || [],
            storageUsage: videoData?.storageUsage || 0,
            images: imageData || [],
            collections: collectionsData || []
        };
    } catch (e) {
        console.error("Loader Failed", e);
        return { videos: [], storageUsage: 0, images: [], collections: [] };
    }
};

export default function StudioMediaLibrary() {
    return (
        <ClientOnly fallback={<div className="p-8">Loading Media Library...</div>}>
            <Suspense fallback={<div className="p-8">Loading Media Library...</div>}>
                <MediaLibraryPage />
            </Suspense>
        </ClientOnly>
    );
}
