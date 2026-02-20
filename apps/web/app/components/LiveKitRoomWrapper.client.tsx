import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";

interface Props {
    token: string;
    serverUrl: string;
}

export function LiveKitRoomWrapper({ token, serverUrl }: Props) {
    return (
        <LiveKitRoom
            video={true}
            audio={true}
            token={token}
            serverUrl={serverUrl}
            data-lk-theme="default"
            style={{ height: "100vh" }}
        >
            <VideoConference />
        </LiveKitRoom>
    );
}
