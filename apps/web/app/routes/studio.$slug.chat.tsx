
import { useLoaderData, Link, Outlet, useParams } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { MessageCircle, User, Shield, ExternalLink, Plus, Settings } from "lucide-react";
import { useState } from "react";
import { Modal } from "~/components/Modal";
import { toast } from "sonner";

export const loader = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();

    try {
        const [rooms, tenantInfo] = await Promise.all([
            apiRequest<any[]>("/chat/rooms?type=support", token),
            apiRequest<any>("/tenant/info", token)
        ]);
        return { rooms, tenant: tenantInfo, token, error: null };
    } catch (e: any) {
        return { rooms: [], tenant: null, token: null, error: e.message };
    }
};

export default function StudioChat() {
    const { rooms, tenant, token, error } = useLoaderData<any>();
    const { slug } = useParams();

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [chatConfig, setChatConfig] = useState(tenant?.settings?.chatConfig || {
        timezone: 'UTC',
        offlineEmail: '',
        schedule: {
            Mon: ["09:00", "17:00"],
            Tue: ["09:00", "17:00"],
            Wed: ["09:00", "17:00"],
            Thu: ["09:00", "17:00"],
            Fri: ["09:00", "17:00"]
        }
    });

    const saveSettings = async () => {
        try {
            await apiRequest("/tenant/settings", token, {
                method: "PATCH",
                body: JSON.stringify({
                    settings: { chatConfig }
                })
            });
            setIsSettingsOpen(false);
        } catch (e) {
            toast.error("Failed to save settings");
        }
    };

    const updateSchedule = (start: string, end: string) => {
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
        const newSchedule = { ...chatConfig.schedule };
        days.forEach(day => {
            newSchedule[day] = [start, end];
        });
        setChatConfig({ ...chatConfig, schedule: newSchedule });
    };

    const [roleFilter, setRoleFilter] = useState<string>('all');

    if (error) {
        return <div className="p-8 text-red-600">Error: {error}</div>;
    }

    // Classify rooms
    const customerChats = rooms.filter((r: any) => r.metadata?.source === 'widget' || r.customerEmail);
    const platformTickets = rooms.filter((r: any) => !r.customerEmail && r.metadata?.source !== 'widget');

    // Apply role filter
    const filteredCustomerChats = roleFilter === 'all'
        ? customerChats
        : customerChats.filter((r: any) => r.metadata?.routedRole === roleFilter);

    return (
        <div className="p-8 max-w-6xl mx-auto h-full flex flex-col">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
                        <MessageCircle className="text-blue-600" />
                        Messages
                    </h1>
                    <p className="text-zinc-500 mt-1">Manage customer support inquiries and platform tickets</p>
                </div>
                <div>
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900 mr-4"
                    >
                        <Settings size={14} />
                        Chat Settings
                    </button>
                    <Link
                        to={`/embed/${slug}/chat`}
                        target="_blank"
                        className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                    >
                        <ExternalLink size={14} />
                        Test Widget
                    </Link>
                </div>
            </div>

            <Modal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                title="Chat Settings"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Offline Email</label>
                        <input
                            type="email"
                            className="w-full border border-zinc-300 rounded-lg p-2 text-sm"
                            placeholder="support@example.com"
                            value={chatConfig.offlineEmail}
                            onChange={(e) => setChatConfig({ ...chatConfig, offlineEmail: e.target.value })}
                        />
                        <p className="text-xs text-zinc-500 mt-1">Visitors will be asked to email this address when you are offline.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Timezone</label>
                        <select
                            className="w-full border border-zinc-300 rounded-lg p-2 text-sm"
                            value={chatConfig.timezone}
                            onChange={(e) => setChatConfig({ ...chatConfig, timezone: e.target.value })}
                        >
                            <option value="UTC">UTC</option>
                            <option value="America/New_York">Eastern Time (US)</option>
                            <option value="America/Chicago">Central Time (US)</option>
                            <option value="America/Denver">Mountain Time (US)</option>
                            <option value="America/Los_Angeles">Pacific Time (US)</option>
                            <option value="Europe/London">London (UK)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Weekday Hours (Mon-Fri)</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="time"
                                className="border border-zinc-300 rounded-lg p-2 text-sm"
                                value={chatConfig.schedule?.Mon?.[0] || "09:00"}
                                onChange={(e) => updateSchedule(e.target.value, chatConfig.schedule?.Mon?.[1] || "17:00")}
                            />
                            <span className="text-zinc-400">to</span>
                            <input
                                type="time"
                                className="border border-zinc-300 rounded-lg p-2 text-sm"
                                value={chatConfig.schedule?.Mon?.[1] || "17:00"}
                                onChange={(e) => updateSchedule(chatConfig.schedule?.Mon?.[0] || "09:00", e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <button
                            onClick={saveSettings}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                        >
                            Save Settings
                        </button>
                    </div>
                </div>
            </Modal>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Customer Inquiries */}
                <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden flex flex-col h-[600px]">
                    <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex justify-between items-center">
                        <h2 className="font-semibold text-zinc-900 flex items-center gap-2">
                            <User size={18} className="text-blue-600" />
                            Customer Inquiries
                        </h2>
                        <div className="flex items-center gap-2">
                            <select
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value)}
                                className="text-xs border border-zinc-200 rounded px-2 py-1"
                            >
                                <option value="all">All</option>
                                <option value="owner">Owner</option>
                                <option value="admin">Admin</option>
                                <option value="instructor">Instructor</option>
                                <option value="support">Support</option>
                            </select>
                            <span className="text-xs bg-zinc-200 text-zinc-600 px-2 py-0.5 rounded-full">{filteredCustomerChats.length}</span>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
                        {filteredCustomerChats.length === 0 ? (
                            <div className="p-8 text-center text-zinc-500 text-sm">
                                {roleFilter === 'all' ? 'No customer messages yet.' : `No messages routed to ${roleFilter}.`}
                            </div>
                        ) : (
                            filteredCustomerChats.map((room: any) => (
                                <Link
                                    key={room.id}
                                    to={`/studio/${slug}/chat/${room.id}`}
                                    className="block p-4 hover:bg-zinc-50 transition-colors"
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-medium text-zinc-900">{room.name}</span>
                                        <span className="text-xs text-zinc-400">{new Date(room.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                                        {room.customerEmail && <span>{room.customerEmail}</span>}
                                        <span className={`px-1.5 py-0.5 rounded capitalize ${room.status === 'open' ? 'bg-green-100 text-green-700' :
                                            room.status === 'closed' ? 'bg-zinc-100 text-zinc-500' : 'bg-blue-50 text-blue-700'
                                            }`}>
                                            {room.status || 'open'}
                                        </span>
                                        {room.metadata?.routedRole && (
                                            <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 capitalize">
                                                → {room.metadata.routedRole}
                                            </span>
                                        )}
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                </div>

                {/* Platform Support Tickets */}
                <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden flex flex-col h-[600px]">
                    <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex justify-between items-center">
                        <h2 className="font-semibold text-zinc-900 flex items-center gap-2">
                            <Shield size={18} className="text-purple-600" />
                            Platform Support Tickets
                        </h2>
                        <button className="text-xs flex items-center gap-1 bg-purple-100 text-purple-700 px-2 py-1 rounded hover:bg-purple-200 transition-colors">
                            <Plus size={12} />
                            New Ticket
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
                        {platformTickets.length === 0 ? (
                            <div className="p-8 text-center text-zinc-500 text-sm">
                                No active support tickets with Platform Admin.
                            </div>
                        ) : (
                            platformTickets.map((room: any) => (
                                <Link
                                    key={room.id}
                                    to={`/studio/${slug}/chat/${room.id}`}
                                    className="block p-4 hover:bg-zinc-50 transition-colors"
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-medium text-zinc-900">{room.name}</span>
                                        <span className="text-xs text-zinc-400">{new Date(room.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                                        <span className={`px-1.5 py-0.5 rounded capitalize ${room.status === 'open' ? 'bg-green-100 text-green-700' :
                                            room.status === 'closed' ? 'bg-zinc-100 text-zinc-500' : 'bg-blue-50 text-blue-700'
                                            }`}>
                                            {room.status || 'open'}
                                        </span>
                                        {room.assignedToId && <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">Assigned</span>}
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
