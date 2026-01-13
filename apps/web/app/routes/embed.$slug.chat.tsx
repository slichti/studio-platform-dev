
import { useState, useEffect } from "react";
import { useLoaderData, useParams } from "react-router";
import { ChatWindow } from "~/components/chat/ChatWindow";
import { apiRequest, API_URL } from "~/utils/api";
import { MessageCircle, X } from "lucide-react";

export const loader = async ({ params }: { params: { slug: string } }) => {
    try {
        const res = await fetch(`${API_URL}/public/tenant/${params.slug}`);
        if (!res.ok) throw new Error("Tenant not found");
        const tenant = await res.json();
        return { apiUrl: API_URL, tenant };
    } catch (e) {
        return { apiUrl: API_URL, tenant: null };
    }
};

export default function EmbedChat() {
    const { apiUrl, tenant } = useLoaderData<any>();
    const { slug } = useParams();
    const [view, setView] = useState<'welcome' | 'chat'>('welcome');
    const [session, setSession] = useState<{ token: string, roomId: string, user: any } | null>(null);
    const [loading, setLoading] = useState(false);

    // Offline Logic
    const isOnline = () => {
        if (!tenant?.chatConfig?.schedule) return true; // Default to online if no schedule
        const { timezone, schedule } = tenant.chatConfig;

        try {
            // Get current time in tenant's timezone
            const now = new Date();
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone || 'UTC',
                weekday: 'short',
                hour: 'numeric',
                minute: 'numeric',
                hour12: false
            });

            const parts = formatter.formatToParts(now);
            const weekday = parts.find(p => p.type === 'weekday')?.value; // "Mon", "Tue"...
            const hour = parseInt(parts.find(p => p.type === 'hour')?.value || "0");
            const minute = parseInt(parts.find(p => p.type === 'minute')?.value || "0");
            const currentTime = hour * 60 + minute;

            if (!weekday) return true;

            const ranges = (schedule as any)[weekday];
            if (!ranges || !Array.isArray(ranges) || ranges.length !== 2) return false;

            const [startStr, endStr] = ranges;
            const [startH, startM] = startStr.split(':').map(Number);
            const [endH, endM] = endStr.split(':').map(Number);

            const startTime = startH * 60 + startM;
            const endTime = endH * 60 + endM;

            return currentTime >= startTime && currentTime < endTime;
        } catch (e) {
            console.error("Timezone Check Error", e);
            return true; // Fail open
        }
    };

    const online = isOnline();

    // Form State
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [selectedRoutedRole, setSelectedRoutedRole] = useState<string | null>(null);

    useEffect(() => {
        // Restore session
        const stored = localStorage.getItem(`chat_session_${slug}`);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                // Check expiry? For now assume valid or let backend reject
                setSession(parsed);
                setView('chat');
            } catch (e) {
                localStorage.removeItem(`chat_session_${slug}`);
            }
        }
    }, [slug]);

    const startChat = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // 1. Get Guest Token
            const authRes = await fetch(`${apiUrl}/guest/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email })
            });
            const authData = await authRes.json() as any;

            if (authData.error) throw new Error(authData.error);

            const token = authData.token;
            const user = authData.user;

            // 2. Create Support Room
            // Pass initial message in metadata or separately?
            // Let's create room first
            const roomRes = await fetch(`${apiUrl}/chat/rooms`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'X-Tenant-Slug': slug || '' // Identify target tenant
                },
                body: JSON.stringify({
                    type: 'support',
                    name: `Support: ${name}`,
                    customer_email: email,
                    metadata: { source: 'widget', initialMessage: message },
                    priority: 'normal',
                    routedRole: selectedRoutedRole || undefined
                })
            });

            const roomData = await roomRes.json() as any;
            if (roomData.error) throw new Error(roomData.error);

            const roomId = roomData.id;

            // 3. Send initial message
            if (message.trim()) {
                await fetch(`${apiUrl}/chat/rooms/${roomId}/messages`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                        'X-Tenant-Slug': slug || ''
                    },
                    body: JSON.stringify({ content: message })
                });
            }

            const newSession = { token, roomId, user };
            setSession(newSession);
            localStorage.setItem(`chat_session_${slug}`, JSON.stringify(newSession));
            setView('chat');

        } catch (e: any) {
            alert("Failed to start chat: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        // In iframe context, we might postMessage to parent to close/hide
        window.parent.postMessage({ type: 'studio-chat-close' }, '*');
    };

    if (view === 'welcome') {
        return (
            <div className="h-screen w-screen bg-white flex flex-col font-sans">
                <div className="bg-blue-600 p-4 text-white flex justify-between items-center shadow-md">
                    <div className="flex items-center gap-2">
                        <MessageCircle size={20} />
                        <h1 className="font-semibold">Support Chat</h1>
                    </div>
                </div>

                <div className="flex-1 p-6 flex flex-col justify-center">
                    <p className="text-zinc-600 mb-6 text-center">
                        {online
                            ? "Welcome! Please fill in your details to start a support chat with us."
                            : `We are currently offline. Please leave a message and we'll get back to you at ${tenant?.chatConfig?.offlineEmail || 'email'}.`}
                    </p>

                    <form onSubmit={startChat} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Name</label>
                            <input
                                required
                                className="w-full border border-zinc-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder="Your Name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Email</label>
                            <input
                                required
                                type="email"
                                className="w-full border border-zinc-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        {/* Routing Options - populated from chatConfig.options if available */}
                        {tenant?.settings?.chatConfig && Array.isArray(tenant.settings.chatConfig) && tenant.settings.chatConfig.length > 0 && (
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">Topic</label>
                                <select
                                    className="w-full border border-zinc-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    value={selectedRoutedRole || ''}
                                    onChange={(e) => setSelectedRoutedRole(e.target.value || null)}
                                >
                                    <option value="">Select a topic...</option>
                                    {(tenant.settings.chatConfig as any[]).map((opt: any) => (
                                        <option key={opt.id} value={opt.routeToRole || ''}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Message</label>
                            <textarea
                                required
                                rows={3}
                                className="w-full border border-zinc-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder="How can we help?"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full text-white font-semibold py-3 rounded-lg shadow-sm disabled:opacity-50 ${online ? 'bg-blue-600 hover:bg-blue-700' : 'bg-zinc-800 hover:bg-zinc-900'}`}
                        >
                            {loading ? 'Sending...' : (online ? 'Start Chat' : 'Send Message')}
                        </button>
                    </form>
                </div>

                <div className="p-4 text-center text-xs text-zinc-400 border-t border-zinc-100">
                    Powered by Studio Platform
                </div>
            </div>
        );
    }

    if (!session) return null; // Should not happen

    return (
        <div className="h-screen w-screen bg-white">
            {/* We render ChatWindow full screen, simplified */}
            <div className="h-full flex flex-col relative">
                {/* Overlay Header if ChatWindow doesn't have one we like or to handle close */}
                {/* Actually ChatWindow has a header with onClose. Use that. */}
                <div className="absolute top-0 right-0 z-50 p-2 hidden">
                    <button onClick={handleClose}><X /></button>
                </div>

                <ChatWindow
                    roomId={session.roomId}
                    token={session.token}
                    currentUser={session.user}
                    wsUrl={apiUrl} // Note: ChatWindow converts to ws://
                    onClose={handleClose}
                />
            </div>
        </div>
    );
}
