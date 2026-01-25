// Admin Chat System - Platform-wide chat management

import { useLoaderData, Link, useSubmit, Form } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { useState } from "react";
import { useAuth } from "@clerk/react-router";
import { toast } from "sonner";
import { MessageCircle, Users, Shield, ExternalLink, Plus } from "lucide-react";

export const loader = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();

    try {
        // Get all tenants and open support tickets
        const [tenants, tickets] = await Promise.all([
            apiRequest<any[]>("/admin/tenants", token),
            apiRequest<any[]>("/chat/tickets?status=open", token).catch(() => []) // Graceful fail
        ]);
        return { tenants, tickets, error: null };
    } catch (e: any) {
        return { tenants: [], tickets: [], error: e.message };
    }
};

export const action = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const formData = await args.request.formData();
    const intent = formData.get("intent");

    if (intent === "create_support_room") {
        const tenantId = formData.get("tenantId");
        const tenantSlug = formData.get("tenantSlug");

        // 1. Check if room exists? For now just create new one or the backend logic should handle singleton support room if desired.
        // We'll just create a new one "Support [Date]"
        try {
            const room = await apiRequest("/chat/rooms", token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': tenantSlug }, // Context for creating room in that tenant
                body: JSON.stringify({
                    type: "support",
                    name: "Platform Support",
                    metadata: { createdBy: "admin" }
                })
            });
            return { success: true, roomId: room.id };
        } catch (e: any) {
            return { error: e.message };
        }
    }
    return null;
};

export default function AdminChat() {
    const { tenants, tickets: initialTickets, error } = useLoaderData<any>();

    // Client-side filtering/management could go here or use useRevalidator
    const tickets = initialTickets || [];

    const actionData = useLoaderData<any>();

    const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

    const handleOpenSupport = async (tenant: any) => {
        setLoadingMap(prev => ({ ...prev, [tenant.id]: true }));
        try {
            const token = await (window as any).Clerk.session.getToken();

            // 1. Find existing support room? (Backend list filtered by type?)
            // GET /chat/rooms?type=support
            const rooms = await apiRequest(`/chat/rooms?type=support`, token, {
                headers: { 'X-Tenant-Slug': tenant.slug }
            });

            let roomId;
            if (rooms && rooms.length > 0) {
                roomId = rooms[0].id;
            } else {
                // 2. Create if not exists
                const newRoom = await apiRequest("/chat/rooms", token, {
                    method: "POST",
                    headers: { 'X-Tenant-Slug': tenant.slug },
                    body: JSON.stringify({
                        type: "support",
                        name: "Platform Support",
                        metadata: { createdBy: "admin" }
                    })
                });
                roomId = newRoom.id;
            }

            // 3. Navigate
            window.location.href = `/admin/chat/${roomId}`;
        } catch (e) {
            toast.error("Failed to open support chat: " + e);
            setLoadingMap(prev => ({ ...prev, [tenant.id]: false }));
        }
    };

    if (error) {
        return (
            <div className="p-8">
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
                    Error: {error}
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <MessageCircle className="text-blue-600" />
                    Chat System
                </h1>
                <p className="text-zinc-500 dark:text-zinc-400 mt-1">Manage tenant chat rooms and platform support</p>
            </div>

            {/* Support Tickets Inbox */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <Shield className="text-indigo-600 dark:text-indigo-400" size={20} />
                        Support Inbox (Open)
                    </h2>
                    <div className="text-sm text-zinc-500">
                        {tickets.length} open tickets
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                    {tickets.length === 0 ? (
                        <div className="p-8 text-center text-zinc-500 dark:text-zinc-400">
                            No open support tickets found. Great job!
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
                                <tr>
                                    <th className="p-4 font-medium">Tenant</th>
                                    <th className="p-4 font-medium">Subject</th>
                                    <th className="p-4 font-medium">Priority</th>
                                    <th className="p-4 font-medium">Status</th>
                                    <th className="p-4 font-medium">Assigned</th>
                                    <th className="p-4 font-medium">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {tickets.map((ticket: any) => (
                                    <tr key={ticket.id} className="hover:bg-zinc-50 group">
                                        <td className="p-4">
                                            <div className="font-medium text-zinc-900 dark:text-zinc-100">{ticket.tenantName}</div>
                                            <div className="text-xs text-zinc-500 dark:text-zinc-400">ID: {ticket.tenantId?.slice(0, 8)}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-zinc-900 dark:text-zinc-100">{ticket.name}</div>
                                            <div className="text-xs text-zinc-500 dark:text-zinc-400">{new Date(ticket.createdAt).toLocaleDateString()}</div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-medium capitalize
                                            ${ticket.priority === 'urgent' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                                                    ticket.priority === 'high' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' :
                                                        'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}>
                                                {ticket.priority || 'normal'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs font-medium capitalize">
                                                {ticket.status || 'open'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-zinc-500 dark:text-zinc-400">
                                            {ticket.assignedToId ? 'Agent' : 'Unassigned'}
                                        </td>
                                        <td className="p-4">
                                            <Link
                                                to={`/admin/chat/${ticket.id}`}
                                                className="px-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 text-indigo-600 dark:text-indigo-400"
                                            >
                                                Open
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Overview Stats */}
            <div className="grid grid-cols-4 gap-4 mb-8">
                {/* ... existing stats ... */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
                    <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{tenants?.length || 0}</div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">Total Tenants</div>
                </div>
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                        {tenants?.filter((t: any) => Array.isArray(t.features) && t.features.includes('chat'))?.length || 0}
                    </div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">With Chat Enabled</div>
                </div>
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{tickets.length}</div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">Open Tickets</div>
                </div>
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
                    <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">—</div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">Messages Today</div>
                </div>
            </div>

            {/* Tenant Chat Rooms */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-between">
                    <h2 className="font-medium text-zinc-900 dark:text-zinc-100">Tenant Chat Rooms</h2>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Real-time via Durable Objects</span>
                </div>
                {tenants.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500 dark:text-zinc-400">
                        No tenants available
                    </div>
                ) : (
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {tenants.slice(0, 50).map((tenant: any) => (
                            <div key={tenant.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg flex items-center justify-center font-medium">
                                        {tenant.name?.charAt(0) || "?"}
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{tenant.name}</h3>
                                        <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                                            <span>{tenant.slug}</span>
                                            {Array.isArray(tenant.features) && tenant.features.includes('chat') && (
                                                <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-[10px] font-bold">CHAT ACTIVE</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleOpenSupport(tenant)}
                                        disabled={loadingMap[tenant.id]}
                                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg disabled:opacity-50"
                                    >
                                        <Shield size={14} />
                                        {loadingMap[tenant.id] ? "Opening..." : "Support"}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Chat Features */}
            <div className="mt-8 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-xl p-4">
                <h4 className="font-medium text-purple-900 dark:text-purple-300 mb-2">Chat System Features</h4>
                <ul className="text-sm text-purple-800 dark:text-purple-300 space-y-1">
                    <li>• <strong>Durable Objects:</strong> Real-time WebSocket connections with SQLite persistence</li>
                    <li>• <strong>Room Types:</strong> Support, Class, Community, Direct messaging</li>
                    <li>• <strong>User Presence:</strong> Live online/offline status tracking</li>
                    <li>• <strong>Message History:</strong> Full persistence to D1 database</li>
                </ul>
            </div>
        </div>
    );
}
