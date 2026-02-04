import { useState, useRef, useEffect } from "react";

import { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";

import { useLoaderData, Form, useNavigate } from "react-router";
import { apiRequest } from "~/utils/api";
import { getAuth } from "@clerk/react-router/server";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const { videoId, slug } = args.params;

    // Fetch Video Details
    // We assume listing endpoint can filter or we add a specific GET /video/:id endpoint
    // For MVP, filtering the list is inefficient but works if list is small, 
    // or we assume the API supports getting by ID directly in future refactor.
    // Let's assume we have a GET endpoint or fetch list and find.
    // Actually, let's use the patch endpoint logic which likely has a GET sibling or we just add it.
    // Simplified: Fetch all and find (Not performant for prod but ok for MVP)

    // BETTER: Add Detail GET to API later. For now, we stub data or use client fetch if needed.
    // Let's Mock for now or reuse the list endpoint if it returns details.

    const data: any = await apiRequest(`/video-management/`, token, {
        headers: { 'X-Tenant-Slug': slug! }
    });

    const video = data?.videos.find((v: any) => v.id === videoId);
    if (!video) throw new Response("Video Not Found", { status: 404 });

    const branding = await apiRequest(`/video-management/branding`, token, {
        headers: { 'X-Tenant-Slug': slug! }
    });

    return { video, branding };
};

export const action = async (args: ActionFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const { videoId, slug } = args.params;
    const formData = await args.request.formData();

    const trimStart = formData.get("trimStart");
    const trimEnd = formData.get("trimEnd");

    await apiRequest(`/video-management/${videoId}`, token, {
        method: "PATCH",
        headers: { 'X-Tenant-Slug': slug! },
        body: JSON.stringify({
            trimStart: Number(trimStart),
            trimEnd: Number(trimEnd)
        })
    });

    return { success: true };
};

export default function EditVideo() {
    const { video, branding } = useLoaderData<typeof loader>();
    const navigate = useNavigate();

    const [start, setStart] = useState(video.trimStart || 0);
    const [end, setEnd] = useState(video.trimEnd || video.duration);

    // Mock Player Ref
    const videoRef = useRef<HTMLVideoElement>(null);

    // Sync Player to Trim
    useEffect(() => {
        if (videoRef.current) {
            const checkTime = () => {
                if (videoRef.current && videoRef.current.currentTime > end) {
                    videoRef.current.pause();
                    videoRef.current.currentTime = end;
                }
            };
            videoRef.current.addEventListener('timeupdate', checkTime);
            return () => videoRef.current?.removeEventListener('timeupdate', checkTime);
        }
    }, [end]);

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <button onClick={() => navigate("..")} className="mb-4 text-sm text-zinc-500 hover:underline">
                &larr; Back to Library
            </button>
            <h1 className="text-2xl font-bold mb-2">Edit: {video.title}</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                    {/* Video Player Preview */}
                    <div className="bg-black aspect-video rounded-lg overflow-hidden relative">
                        {/* Cloudflare Stream Player would go here. Using HTML5 video for generic preview if URL available */}
                        {/* In real implementation, use <Stream /> component or an iframe */}
                        <div className="w-full h-full flex items-center justify-center text-white">
                            {video.cloudflareStreamId ? (
                                <iframe
                                    src={`https://customer-<your-code>.cloudflarestream.com/${video.cloudflareStreamId}/iframe`}
                                    className="w-full h-full"
                                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                                    allowFullScreen
                                />
                            ) : (
                                <p>Video Processing or Unavailable</p>
                            )}
                        </div>
                    </div>

                    {/* Trim Controls */}
                    <div className="mt-6 bg-white p-4 rounded border">
                        <h3 className="font-bold mb-4">Trimming</h3>
                        <div className="flex gap-4 items-center">
                            <div className="flex-1">
                                <label className="text-xs font-bold text-zinc-500 uppercase">Start Time (s)</label>
                                <input
                                    type="number"
                                    value={start}
                                    onChange={(e) => setStart(Number(e.target.value))}
                                    className="w-full border p-2 rounded"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs font-bold text-zinc-500 uppercase">End Time (s)</label>
                                <input
                                    type="number"
                                    value={end}
                                    onChange={(e) => setEnd(Number(e.target.value))}
                                    className="w-full border p-2 rounded"
                                />
                            </div>
                        </div>

                        <Form method="post" className="mt-4 flex justify-end">
                            <input type="hidden" name="trimStart" value={start} />
                            <input type="hidden" name="trimEnd" value={end} />
                            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700">
                                Save Changes
                            </button>
                        </Form>
                    </div>
                </div>

                <div>
                    {/* Branding Controls */}
                    <div className="bg-white p-4 rounded border">
                        <h3 className="font-bold mb-4">Branding</h3>
                        <p className="text-sm text-zinc-500 mb-4">
                            Intros and Outros are applied automatically by the player.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Intro</label>
                                <select className="w-full border p-2 rounded text-sm">
                                    <option value="">None</option>
                                    {branding.filter((b: any) => b.type === 'intro').map((b: any) => (
                                        <option key={b.id} value={b.id} selected={b.active}>{b.title}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Outro</label>
                                <select className="w-full border p-2 rounded text-sm">
                                    <option value="">None</option>
                                    {branding.filter((b: any) => b.type === 'outro').map((b: any) => (
                                        <option key={b.id} value={b.id} selected={b.active}>{b.title}</option>
                                    ))}
                                </select>
                            </div>
                            <button className="w-full mt-2 bg-zinc-100 text-zinc-700 px-3 py-2 rounded text-sm font-medium hover:bg-zinc-200">
                                Update Branding
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
