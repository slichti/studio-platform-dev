import { useEffect, useState } from "react";

import { useParams } from "react-router";
import {
    LiveKitRoom,
    VideoConference,
    GridLayout,
    ParticipantTile,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { useAuth } from "@clerk/react-router";
import { apiRequest } from "~/utils/api";

export default function LiveClassPage() {
    const { classId } = useParams();
    const [token, setToken] = useState("");
    const { getToken } = useAuth();

    useEffect(() => {
        const fetchToken = async () => {
            try {
                // In a real app, 'isInstructor' should be derived from the user's role on the server
                // or passed securely. For MVP, we default strictly to student, 
                // but the API is responsible for checking roles.
                // Here we request a token.
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
    }, [classId]);

    if (!token) {
        return (
            <div className="flex items-center justify-center h-screen bg-zinc-900 text-white">
                <p>Loading Studio...</p>
            </div>
        );
    }

    return (
        <LiveKitRoom
            video={true}
            audio={true}
            token={token}
            // Use environment variable for LiveKit URL, exposing it via Vite/Remix logic would be necessary
            // For now, placeholder or hardcoded dev URL or fetch from API
            serverUrl={import.meta.env.VITE_LIVEKIT_URL || "wss://your-project.livekit.cloud"}
            data-lk-theme="default"
            style={{ height: "100vh" }}
        >
            <VideoConference />
        </LiveKitRoom>
    );
}
