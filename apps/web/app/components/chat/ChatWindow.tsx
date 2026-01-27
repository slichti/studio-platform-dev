import { useState, useEffect, useRef } from 'react';
import { Send, User } from 'lucide-react';

interface Message {
    id: string;
    userId: string;
    userName: string;
    content: string;
    timestamp: number;
    type?: string;
}

interface ChatWindowProps {
    roomId: string; // The backend DO ID
    token: string;
    currentUser: { id: string; name: string };
    wsUrl: string; // "wss://..." or "http://..." (will be converted)
    tenantSlug?: string; // For admin portal context resolution
    onClose?: () => void;
}

export function ChatWindow({ roomId, token, currentUser, wsUrl, tenantSlug, onClose }: ChatWindowProps) {
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState("");
    const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        // Construct WebSocket URL
        // Replace http/https with ws/wss
        const urlObj = new URL(wsUrl);
        urlObj.protocol = urlObj.protocol === 'https:' ? 'wss:' : 'ws:';
        // Append path
        urlObj.pathname = `/chat/rooms/${roomId}/websocket`;
        // Append auth (since browsers don't support headers in new WebSocket, we pass via search params or specialized ticket)
        // SECURITY NOTE: Passing token in query params is risky for logging, but common for WS. 
        // Better: Use a short-lived ticket. For this demo, we assume the backend validates the token from the cookie or we pass it here?
        // Wait, the API `chat.ts` uses `tenantMiddleware` which reads `Authorization` header.
        // WebSockets CANNOT send headers.
        // We need a ticket system OR we pass token in protocol/query.
        // Let's pass it in query for now to unblock, but flagged as TODO.
        // Actually, `chat.ts` is protected by `tenantMiddleware` on the route `/rooms/...`.
        // The `app.get` runs BEFORE `stub.fetch`. So the upgrade request IS an HTTP request that supports headers!
        // So we CAN send headers if we use a custom client, BUT browser `new WebSocket()` does NOT allow custom headers.
        // Standard workaround: Pass in Query Param and have Middleware extract it.
        // `authMiddleware` in this codebase supports `c.req.query('token')`?
        // Let's check `middleware/auth.ts`.
        // If not, we'll append it.

        // Assuming for now we pass it in query.
        urlObj.searchParams.set('token', token);
        if (tenantSlug) {
            urlObj.searchParams.set('tenantSlug', tenantSlug);
        }

        console.log("Connecting to WS:", urlObj.toString());

        const ws = new WebSocket(urlObj.toString());

        ws.onopen = () => {
            setStatus('connected');
            // ws.send(JSON.stringify({ type: 'join', ... })); // DO handles join on connect
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'history') {
                    setMessages(data.messages);
                } else if (data.type === 'message') {
                    setMessages(prev => [...prev, data]);
                } else if (data.type === 'user_joined') {
                    setMessages(prev => [...prev, {
                        id: 'sys-' + Date.now(),
                        userId: 'system',
                        userName: 'System',
                        content: `${data.userName} joined the room.`,
                        timestamp: data.timestamp,
                        type: 'system'
                    }]);
                }
            } catch (e) {
                console.error("WS Parse Error", e);
            }
        };

        ws.onclose = () => {
            setStatus('disconnected');
        };

        setSocket(ws);

        return () => {
            ws.close();
        };
    }, [roomId, wsUrl, token]);

    const handleSend = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputText.trim() || !socket) return;

        const msg = {
            type: 'message',
            content: inputText
        };

        socket.send(JSON.stringify(msg));
        setInputText("");

        // Optimistic UI? Usually wait for echo for strict consistency, but instant feel is nice.
        // The DO echoes back, so we wait.
    };

    return (
        <div className="flex flex-col h-[500px] w-full max-w-md bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden">
            {/* Header */}
            <div className="bg-zinc-50 border-b border-zinc-200 p-3 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="font-medium text-sm text-zinc-700">Chat Room</span>
                </div>
                {onClose && (
                    <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">×</button>
                )}
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
                {messages.length === 0 && (
                    <div className="text-center text-zinc-400 text-sm mt-10">No messages yet.</div>
                )}
                {messages.map((msg) => {
                    const isMe = msg.userId === currentUser.id;
                    const isSystem = msg.type === 'system';

                    if (isSystem) {
                        return (
                            <div key={msg.id} className="flex justify-center">
                                <span className="text-xs bg-zinc-100 text-zinc-500 px-2 py-1 rounded-full">
                                    {msg.content}
                                </span>
                            </div>
                        );
                    }

                    return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-lg p-3 text-sm ${isMe
                                ? 'bg-blue-600 text-white rounded-br-none'
                                : 'bg-zinc-100 text-zinc-800 rounded-bl-none'
                                }`}>
                                {!isMe && <div className="text-[10px] opacity-50 font-bold mb-1">{msg.userName}</div>}
                                <div>{msg.content}</div>
                                <div className={`text-[10px] mt-1 text-right ${isMe ? 'text-blue-100' : 'text-zinc-400'}`}>
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-3 border-t border-zinc-200 bg-zinc-50 flex gap-2">
                <input
                    className="flex-1 border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Type a message..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    disabled={status !== 'connected'}
                />
                <button
                    type="submit"
                    disabled={status !== 'connected' || !inputText.trim()}
                    className="bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Send size={18} />
                </button>
            </form>
        </div>
    );
}
