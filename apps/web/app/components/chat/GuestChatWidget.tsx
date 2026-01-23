import { useState } from 'react';
import { MessageSquare, X, Send, Loader2 } from 'lucide-react';
import { ChatWindow } from './ChatWindow';

interface GuestChatWidgetProps {
    tenantSlug: string;
    apiUrl: string;
    brandColor?: string;
}

export function GuestChatWidget({ tenantSlug, apiUrl, brandColor = '#3B82F6' }: GuestChatWidgetProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState<'form' | 'chat'>('form');
    const [loading, setLoading] = useState(false);

    // Form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');

    // Chat state
    const [roomId, setRoomId] = useState<string | null>(null);
    const [guestToken, setGuestToken] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !message) return;

        setLoading(true);
        try {
            const response = await fetch(`${apiUrl}/public/chat/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantSlug, name, email, message })
            });
            const data = await response.json() as {
                success?: boolean;
                roomId?: string;
                guestToken?: string;
                user?: { id: string; email: string; name?: string };
                error?: string;
            };

            if (data.success && data.roomId && data.guestToken && data.user) {
                setRoomId(data.roomId);
                setGuestToken(data.guestToken);
                setUserId(data.user.id);
                setStep('chat');
            } else {
                alert(data.error || 'Failed to start chat');
            }
        } catch (e) {
            console.error(e);
            alert('Connection error');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                style={{ backgroundColor: brandColor }}
                className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white hover:opacity-90 transition-opacity z-50"
            >
                <MessageSquare size={24} />
            </button>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 w-96 bg-white rounded-2xl shadow-2xl overflow-hidden z-50 border border-zinc-200">
            {/* Header */}
            <div style={{ backgroundColor: brandColor }} className="p-4 flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                    <MessageSquare size={20} />
                    <span className="font-semibold">Support Chat</span>
                </div>
                <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded">
                    <X size={20} />
                </button>
            </div>

            {step === 'form' ? (
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <p className="text-sm text-zinc-600">Hi! How can we help you today?</p>
                    <div>
                        <label className="block text-xs font-medium text-zinc-500 mb-1">Your Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm"
                            placeholder="John Doe"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-zinc-500 mb-1">Email *</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm"
                            placeholder="you@example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-zinc-500 mb-1">Message *</label>
                        <textarea
                            required
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm h-24 resize-none"
                            placeholder="How can we help?"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        style={{ backgroundColor: brandColor }}
                        className="w-full py-2.5 rounded-lg text-white font-medium flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        {loading ? 'Starting...' : 'Start Chat'}
                    </button>
                </form>
            ) : (
                <div className="h-[400px]">
                    {roomId && guestToken && userId && (
                        <ChatWindow
                            roomId={roomId}
                            token={guestToken}
                            currentUser={{ id: userId, name: name || 'Guest' }}
                            wsUrl={apiUrl}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
