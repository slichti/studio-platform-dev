// @ts-ignore
import { LoaderFunction } from "react-router";
// @ts-ignore
import { useLoaderData, Link } from "react-router";
import { getAuth } from "@clerk/react-router/server";
// import { apiRequest } from "../utils/api"; 

// Real Data Loader
export const loader: LoaderFunction = async (args) => {
    const { request, params } = args;
    const { getToken, userId } = await getAuth(args);
    const token = await getToken();

    // We need the API URL. Since this is a loader (server-side in Remix/RR, but Edge in CF), 
    // we need context. But `args` has context if we use the right type or handling.
    // However, `getAuth` is Clerk.
    // Let's assume process.env or context.cloudflare.env is available or we use a hardcoded/env var.
    // In CF Pages Functions, context is passed. Remix loaders receive it.
    // let apiUrl = process.env.VITE_API_URL || "http://localhost:8787";
    // Better: use context context
    const context = (args as any).context;
    const apiUrl = context?.cloudflare?.env?.VITE_API_URL || "http://localhost:8787";

    if (!userId) {
        // Redirect to login if not handled by root
    }

    try {
        const [recordingRes, classRes] = await Promise.all([
            fetch(`${apiUrl}/classes/${params.id}/recording`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch(`${apiUrl}/classes/${params.id}`, { // Assuming this endpoint exists or we use a different one
                headers: { 'Authorization': `Bearer ${token}` }
            })
        ]);

        if (!recordingRes.ok) {
            if (recordingRes.status === 403) throw new Response("Access Denied", { status: 403 });
            if (recordingRes.status === 404) throw new Response("Recording Not Found", { status: 404 });
            throw new Error("Failed to fetch recording");
        }

        const recordingData = await recordingRes.json() as any;
        const classData = classRes.ok ? await classRes.json() as any : { title: "Class Recording" };

        return {
            id: params.id,
            title: classData.title || "Class Recording",
            ...recordingData // videoId, status
        };
    } catch (e) {
        // console.error(e);
        throw new Response("Error loading recording", { status: 500 });
    }
};

export default function WatchRecording() {
    const { classId, videoId, title } = useLoaderData<any>();

    return (
        <div>
            <div style={{ marginBottom: '20px' }}>
                <Link to="/dashboard/classes" style={{ color: '#71717a', textDecoration: 'none', fontSize: '0.875rem' }}>&larr; Back to Classes</Link>
            </div>

            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '20px' }}>{title}</h1>

                {videoId ? (
                    <div style={{ position: 'relative', paddingTop: '56.25%' /* 16:9 Aspect Ratio */ }}>
                        <iframe
                            src={`https://customer-<YOUR_CODE>.cloudflarestream.com/${videoId}/iframe`}
                            style={{ border: 'none', position: 'absolute', top: 0, left: 0, height: '100%', width: '100%' }}
                            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                            allowFullScreen={true}
                        ></iframe>
                    </div>
                ) : (
                    <div style={{ padding: '60px', background: '#f4f4f5', borderRadius: '8px', textAlign: 'center', color: '#71717a' }}>
                        <p>Recording is processing or not available.</p>
                        <p style={{ fontSize: '0.875rem', marginTop: '10px' }}>Simulated Video Player</p>
                    </div>
                )}
            </div>
        </div>
    );
}
