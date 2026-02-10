import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { useAuth } from "@clerk/react-router";
import { apiRequest } from "~/utils/api";
import { ClientOnly } from "~/components/ClientOnly";

// Import types only if possible, but for simplicity we'll just use dynamic imports or let ClientOnly handle the mounting
// Actually, to fully exclude from server bundle, we need to move the imports inside the component or use a sub-component.

export default function LiveClassPage() {
    const { classId } = useParams();
    const [token, setToken] = useState("");
    const { getToken } = useAuth();
    const [LiveKit, setLiveKit] = useState<any>(null);

    useEffect(() => {
        // Dynamically import LiveKit components only on the client
        import("@livekit/components-react").then(mod => {
            setLiveKit(mod);
            // Also need styles
            import("@livekit/components-styles");
        });

        const fetchToken = async () => {
            try {
                const authToken = await getToken();
                const response = await apiRequest("/video/token", authToken, {
                    method: "POST",
                    body: JSON.stringify({ classId, isInstructor: false }),
                });

                if ((response as any).token) {
                    setToken((response as any).token);
                }
            } catch (error) {
                console.error("Failed to get video token", error);
            }
        };

        if (classId) fetchToken();
    }, [classId, getToken]);

    if (!token || !LiveKit) {
        return (
            <div className="flex items-center justify-center h-screen bg-zinc-900 text-white">
                <p>Loading Studio...</p>
            </div>
        );
    }

    const { LiveKitRoom, VideoConference } = LiveKit;

    return (
        <ClientOnly>
            <LiveKitRoom
                video={true}
                audio={true}
                token={token}
                serverUrl={import.meta.env.VITE_LIVEKIT_URL || "wss://your-project.livekit.cloud"}
                data-lk-theme="default"
                style={{ height: "100vh" }}
            >
                <VideoConference />
            </LiveKitRoom>
        </ClientOnly>
    );
}
