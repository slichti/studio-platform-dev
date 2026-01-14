
import { useLoaderData, useParams, Link } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { ChatWindow } from "~/components/chat/ChatWindow";
import { apiRequest, API_URL } from "~/utils/api";
import { ArrowLeft, Grip, Settings, CheckCircle, Clock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const loader = async (args: any) => {
    const { getToken, userId } = await getAuth(args);
    const token = await getToken();
    const roomId = args.params.roomId;

    if (!userId) throw new Response("Unauthorized", { status: 401 });

    try {
        // Fetch room details
        const room = await apiRequest(`/chat/rooms/${roomId}`, token);
        // Fetch current user details
        const me = await apiRequest('/tenant/me', token); // Use tenant/me to get tenant member profile

        return {
            room,
            token,
            user: { id: me.userId, name: me.firstName + ' ' + me.lastName },
            apiUrl: API_URL
        };
    } catch (e: any) {
        throw new Response("Room not found or access denied", { status: 404 });
    }
};

export default function StudioChatRoom() {
    const { room, token, user, apiUrl } = useLoaderData<any>();
    const { slug } = useParams();

    const [status, setStatus] = useState(room.status || 'open');
    const isCustomerChat = room.metadata?.source === 'widget' || room.customerEmail;

    const updateStatus = async (newStatus: string) => {
        try {
            await apiRequest(`/chat/rooms/${room.id}`, token, {
                method: 'PATCH',
                body: JSON.stringify({ status: newStatus })
            });
            setStatus(newStatus);
        } catch (e) {
            toast.error("Failed to update status");
        }
    };

    return (
        <div className="h-[calc(100vh-64px)] bg-zinc-50 flex flex-col">
            {/* Header */}
            <header className="bg-white border-b border-zinc-200 px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link to={`/studio/${slug}/chat`} className="p-2 hover:bg-zinc-100 rounded-full text-zinc-500">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="font-bold text-zinc-900 leading-tight">{room.name}</h1>
                        <div className="text-xs text-zinc-500 flex items-center gap-2">
                            <span className="uppercase tracking-wider font-semibold">
                                {isCustomerChat ? 'Customer Inquiry' : 'Platform Ticket'}
                            </span>
                            <span>•</span>
                            <span className="font-mono text-zinc-400">{room.id.slice(0, 8)}</span>
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2">
                    {/* Status Badge */}
                    <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${status === 'open' ? 'bg-green-100 text-green-700' :
                        status === 'closed' ? 'bg-zinc-100 text-zinc-600' : 'bg-blue-50 text-blue-700'
                        }`}>
                        {status}
                    </span>

                    {/* If Customer Chat, allow Tenant to Resolve */}
                    {isCustomerChat && status !== 'closed' && (
                        <button
                            onClick={() => updateStatus('closed')}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-md text-sm hover:bg-green-700"
                        >
                            <CheckCircle size={14} />
                            Resolve
                        </button>
                    )}
                    {isCustomerChat && status === 'closed' && (
                        <button
                            onClick={() => updateStatus('open')}
                            className="flex items-center gap-1 px-3 py-1.5 bg-zinc-100 text-zinc-700 rounded-md text-sm hover:bg-zinc-200"
                        >
                            <Clock size={14} />
                            Reopen
                        </button>
                    )}
                </div>
            </header>

            {/* Chat Area */}
            <main className="flex-1 p-6 flex justify-center overflow-hidden">
                <div className="w-full max-w-4xl h-full flex flex-col">
                    <ChatWindow
                        roomId={room.id}
                        token={token}
                        currentUser={user}
                        wsUrl={apiUrl}
                    />
                </div>
            </main>
        </div>
    );
}
