// Admin Chat System - Platform-wide chat management

import { useLoaderData, Link } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { useState } from "react";
import { useAuth } from "@clerk/react-router";
import { MessageCircle, Users, Shield, ExternalLink } from "lucide-react";

export const loader = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();

    try {
        // Get all tenants
        const tenants = await apiRequest<any[]>("/admin/tenants", token);
        return { tenants, error: null };
    } catch (e: any) {
        return { tenants: [], error: e.message };
    }
};

export default function AdminChat() {
    const { tenants, error } = useLoaderData<any>();
    const [selectedTenant, setSelectedTenant] = useState<any>(null);

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
                <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
                    <MessageCircle className="text-blue-600" />
                    Chat System
                </h1>
                <p className="text-zinc-500 mt-1">Manage tenant chat rooms and platform support</p>
            </div>

            {/* Overview Stats */}
            <div className="grid grid-cols-4 gap-4 mb-8">
                <div className="bg-white border border-zinc-200 rounded-xl p-6">
                    <div className="text-3xl font-bold text-zinc-900">{tenants?.length || 0}</div>
                    <div className="text-sm text-zinc-500">Total Tenants</div>
                </div>
                <div className="bg-white border border-zinc-200 rounded-xl p-6">
                    <div className="text-3xl font-bold text-green-600">
                        {tenants?.filter((t: any) => t.features?.includes('chat'))?.length || 0}
                    </div>
                    <div className="text-sm text-zinc-500">With Chat Enabled</div>
                </div>
                <div className="bg-white border border-zinc-200 rounded-xl p-6">
                    <div className="text-3xl font-bold text-blue-600">—</div>
                    <div className="text-sm text-zinc-500">Active Rooms</div>
                </div>
                <div className="bg-white border border-zinc-200 rounded-xl p-6">
                    <div className="text-3xl font-bold text-purple-600">—</div>
                    <div className="text-sm text-zinc-500">Messages Today</div>
                </div>
            </div>

            {/* Platform Support Chat */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 mb-8 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Shield size={24} />
                            Platform Support Chat
                        </h2>
                        <p className="text-white/80 mt-1">Chat with tenants requiring platform-level support</p>
                    </div>
                    <button className="bg-white text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-blue-50 transition">
                        Open Support Console
                    </button>
                </div>
            </div>

            {/* Tenant Chat Rooms */}
            <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
                <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
                    <h2 className="font-medium text-zinc-900">Tenant Chat Rooms</h2>
                    <span className="text-xs text-zinc-500">Real-time via Durable Objects</span>
                </div>
                {tenants.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500">
                        No tenants available
                    </div>
                ) : (
                    <div className="divide-y divide-zinc-100">
                        {tenants.slice(0, 10).map((tenant: any) => (
                            <div key={tenant.id} className="p-4 flex items-center justify-between hover:bg-zinc-50">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center font-medium">
                                        {tenant.name?.charAt(0) || "?"}
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-zinc-900">{tenant.name}</h3>
                                        <div className="flex items-center gap-2 text-sm text-zinc-500">
                                            <span>0 active rooms</span>
                                            <span>•</span>
                                            <span>0 messages</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg">
                                        <MessageCircle size={14} />
                                        View Rooms
                                    </button>
                                    <button className="flex items-center gap-1 px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 rounded-lg">
                                        <Shield size={14} />
                                        Support
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Chat Features */}
            <div className="mt-8 bg-purple-50 border border-purple-100 rounded-xl p-4">
                <h4 className="font-medium text-purple-900 mb-2">Chat System Features</h4>
                <ul className="text-sm text-purple-800 space-y-1">
                    <li>• <strong>Durable Objects:</strong> Real-time WebSocket connections with SQLite persistence</li>
                    <li>• <strong>Room Types:</strong> Support, Class, Community, Direct messaging</li>
                    <li>• <strong>User Presence:</strong> Live online/offline status tracking</li>
                    <li>• <strong>Message History:</strong> Full persistence to D1 database</li>
                </ul>
            </div>
        </div>
    );
}
