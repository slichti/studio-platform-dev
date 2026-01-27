
import { useLoaderData, useParams, Link } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { ChatWindow } from "~/components/chat/ChatWindow";
import { apiRequest, API_URL } from "~/utils/api";
import { ArrowLeft, Grip, Settings } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const loader = async (args: any) => {
    const { getToken, userId } = await getAuth(args);
    const token = await getToken();
    const roomId = args.params.roomId;

    if (!userId) throw new Response("Unauthorized", { status: 401 });

    try {
        // Fetch room details using the new Admin API (bypasses tenant filters)
        const room = await apiRequest(`/admin/chat/rooms/${roomId}`, token);

        // Fetch current user details for the chat UI
        const me = await apiRequest('/users/me', token);

        return {
            room,
            token,
            user: { id: me.userId, name: me.firstName + ' ' + me.lastName },
            apiUrl: API_URL
        };
    } catch (e: any) {
        console.error("Chat Room Load Error:", e);
        throw new Response("Room not found or access denied", { status: 404 });
    }
};

export default function AdminChatRoom() {
    const { room, token, user, apiUrl } = useLoaderData<any>();

    const [status, setStatus] = useState(room.status || 'open');
    const [priority, setPriority] = useState(room.priority || 'normal');
    const [assignee, setAssignee] = useState(room.assignedToId || null);

    const updateTicket = async (updates: any) => {
        try {
            await apiRequest(`/admin/chat/rooms/${room.id}`, token, {
                method: 'PATCH',
                body: JSON.stringify(updates)
            });
            // Optimistic update
            if (updates.status) setStatus(updates.status);
            if (updates.priority) setPriority(updates.priority);
            if (updates.assignedToId !== undefined) setAssignee(updates.assignedToId);
        } catch (e) {
            toast.error("Failed to update ticket");
        }
    };

    return (
        <div className="h-[calc(100vh-64px)] bg-zinc-50 flex flex-col">
            {/* Header */}
            <header className="bg-white border-b border-zinc-200 px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link to="/admin/chat" className="p-2 hover:bg-zinc-100 rounded-full text-zinc-500">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="font-bold text-zinc-900 leading-tight">{room.name}</h1>
                        <div className="text-xs text-zinc-500 flex items-center gap-2">
                            <span className="uppercase tracking-wider font-semibold">{room.type}</span>
                            <span>•</span>
                            <span className="font-mono text-zinc-400">{room.id.slice(0, 8)}</span>
                        </div>
                    </div>
                </div>

                {/* Ticket Controls */}
                {room.type === 'support' && (
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end">
                            <select
                                value={status}
                                onChange={(e) => updateTicket({ status: e.target.value })}
                                className={`text-sm rounded-md border-zinc-200 py-1 pl-2 pr-6 font-medium ${status === 'open' ? 'text-green-600 bg-green-50' :
                                    status === 'closed' ? 'text-zinc-600 bg-zinc-100' : 'text-blue-600 bg-blue-50'
                                    }`}
                            >
                                <option value="open">Open</option>
                                <option value="in_progress">In Progress</option>
                                <option value="closed">Closed</option>
                            </select>
                        </div>
                        <div className="flex flex-col items-end">
                            <select
                                value={priority}
                                onChange={(e) => updateTicket({ priority: e.target.value })}
                                className={`text-sm rounded-md border-zinc-200 py-1 pl-2 pr-6 font-medium ${priority === 'urgent' ? 'text-red-700 bg-red-50' :
                                    priority === 'high' ? 'text-orange-700 bg-orange-50' : 'text-zinc-600 bg-zinc-50'
                                    }`}
                            >
                                <option value="low">Low Priority</option>
                                <option value="normal">Normal</option>
                                <option value="high">High Priority</option>
                                <option value="urgent">Urgent</option>
                            </select>
                        </div>
                        <button
                            onClick={() => updateTicket({ assignedToId: assignee ? null : user.id })}
                            className="text-sm px-3 py-1 bg-white border border-zinc-200 rounded-md text-zinc-600 hover:bg-zinc-50"
                        >
                            {assignee ? (assignee === user.id ? 'Assigned to You' : 'Assigned') : 'Assign to Me'}
                        </button>
                    </div>
                )}

                {!room.type.includes('support') && (
                    <div className="flex items-center gap-2">
                        <button className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400">
                            <Settings size={20} />
                        </button>
                    </div>
                )}
            </header>

            {/* Chat Area - Centered for now, can be full width */}
            <main className="flex-1 p-6 flex justify-center overflow-hidden">
                <div className="w-full max-w-4xl h-full flex flex-col">
                    <ChatWindow
                        roomId={room.id}
                        token={token}
                        currentUser={user}
                        wsUrl={apiUrl}
                        tenantSlug={room.tenant?.slug}
                    />
                </div>
            </main>
        </div>
    );
}
