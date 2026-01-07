import { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import { apiRequest } from "~/utils/api";
import { getAuth } from "@clerk/react-router/server";
import { formatBytes } from "~/utils/format";
import { FileVideo, Scissors, Trash2 } from "lucide-react";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const slug = args.params.slug!;

    // Using the video-management API we created
    const data = await apiRequest(`/video-management/`, {
        token,
        headers: { 'X-Tenant-Slug': slug }
    });

    return { videos: data?.videos || [], storageUsage: data?.storageUsage || 0 };
};

export default function StudioVerifiedVideos() {
    const { videos, storageUsage } = useLoaderData<typeof loader>();

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Video Library</h1>
                    <p className="text-gray-500">Manage your class recordings and uploads.</p>
                </div>
                <div className="bg-zinc-100 px-4 py-2 rounded-lg">
                    <span className="text-sm font-medium text-zinc-600">Storage Used: </span>
                    <span className="font-bold">{formatBytes(storageUsage)}</span>
                </div>
            </div>

            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                <table className="w-full">
                    <thead className="bg-zinc-50 border-b">
                        <tr>
                            <th className="text-left py-3 px-4 font-medium text-zinc-500">Title</th>
                            <th className="text-left py-3 px-4 font-medium text-zinc-500">Source</th>
                            <th className="text-left py-3 px-4 font-medium text-zinc-500">Size</th>
                            <th className="text-left py-3 px-4 font-medium text-zinc-500">Status</th>
                            <th className="text-right py-3 px-4 font-medium text-zinc-500">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {videos.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="text-center py-8 text-gray-400">
                                    No videos found. Recordings will appear here automatically.
                                </td>
                            </tr>
                        ) : (
                            videos.map((video: any) => (
                                <tr key={video.id} className="border-b last:border-0 hover:bg-zinc-50">
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-blue-100 p-2 rounded">
                                                <FileVideo className="text-blue-600" size={20} />
                                            </div>
                                            <div>
                                                <div className="font-medium">{video.title}</div>
                                                <div className="text-xs text-zinc-500">
                                                    Duration: {Math.floor(video.duration / 60)}m {video.duration % 60}s
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 capitalize">
                                        <span className={`px-2 py-1 rounded text-xs border ${video.source === 'zoom' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                                                video.source === 'livekit' ? 'bg-green-50 border-green-200 text-green-700' :
                                                    'bg-gray-50 border-gray-200 text-gray-700'
                                            }`}>
                                            {video.source}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-sm text-zinc-600">
                                        {formatBytes(video.sizeBytes)}
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${video.status === 'ready' ? 'bg-green-500' :
                                                    video.status === 'processing' ? 'bg-yellow-500' : 'bg-red-500'
                                                }`} />
                                            <span className="text-sm capitalize">{video.status}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <Link
                                                to={`edit/${video.id}`}
                                                className="p-2 text-zinc-600 hover:bg-zinc-200 rounded transition"
                                                title="Trim & Edit"
                                            >
                                                <Scissors size={18} />
                                            </Link>
                                            <button
                                                className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                                                title="Delete"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
