import { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useLoaderData } from "react-router";
import { requireUser } from "~/utils/auth.server";
import { apiRequest } from "~/utils/api";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    await requireUser(request);
    // Fetch all storage buckets/videos (Platform level)
    // For MVP, we likely don't have a platform-wide R2 list API yet.
    // Placeholder.
    return { videos: [] };
};

export default function AdminVideos() {
    const { videos } = useLoaderData<typeof loader>();

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">Platform Video Management</h1>
            <div className="bg-white rounded-lg shadow p-6">
                <p className="text-gray-500">
                    Integration with Cloudflare R2 and Stream dashboard coming soon.
                    This area will allow platform admins to see global storage usage and re-trigger processing for stuck videos.
                </p>
                {/* 
                  Future: List of all R2 buckets/files.
                  Actions: "Sync to DB", "Delete".
                */}
            </div>
        </div>
    );
}
