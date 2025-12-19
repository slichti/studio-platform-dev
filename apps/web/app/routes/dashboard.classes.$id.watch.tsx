import { LoaderFunction } from "react-router";
import { useLoaderData, Link } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
// import { apiRequest } from "../utils/api"; 

// Mock Data for now since we haven't wired up the "Get Class with Video" endpoint fully
export const loader: LoaderFunction = async (args) => {
    // const { getToken } = await getAuth(args);
    // const token = await getToken();

    // Returning mock data for UI dev
    return {
        id: args.params.id,
        title: "Morning Vinyasa Flow",
        cloudflareStreamId: "5d5bc37ffcf54c9b82e996823fca8f4e", // Example ID
        recordingStatus: "ready"
    };
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
