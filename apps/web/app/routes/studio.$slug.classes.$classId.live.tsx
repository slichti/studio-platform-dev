import { useEffect, useState, lazy, Suspense } from "react";
import { useParams } from "react-router";
import { useAuth } from "@clerk/react-router";
import { apiRequest } from "~/utils/api";
import { ClientOnly } from "~/components/ClientOnly";

const LiveKitRoomWrapper = lazy(() => import("~/components/LiveKitRoomWrapper.client").then(m => ({ default: m.LiveKitRoomWrapper })));

export default function LiveClassPage() {
    const { classId } = useParams();
    const [token, setToken] = useState("");
    const { getToken } = useAuth();

    useEffect(() => {
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

    if (!token) {
        return (
            <div className="flex items-center justify-center h-screen bg-zinc-900 text-white">
                <p>Loading Studio...</p>
            </div>
        );
    }

    return (
        <ClientOnly>
            <Suspense fallback={
                <div className="flex items-center justify-center h-screen bg-zinc-900 text-white">
                    <p>Connecting to Video...</p>
                </div>
            }>
                <LiveKitRoomWrapper
                    token={token}
                    serverUrl={import.meta.env.VITE_LIVEKIT_URL || "wss://your-project.livekit.cloud"}
                />
            </Suspense>
        </ClientOnly>
    );
}

