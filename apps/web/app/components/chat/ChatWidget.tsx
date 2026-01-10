// Chat Widget Component - Floating chat bubble with panel

import { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, X, Send, Users } from "lucide-react";

interface ChatMessage {
    id: string;
    userId: string;
    userName: string;
    content: string;
    timestamp: number;
}

interface ChatWidgetProps {
    roomId: string;
    tenantSlug: string;
    userId: string;
    userName: string;
    apiUrl?: string;
}

export function ChatWidget({ roomId, tenantSlug, userId, userName, apiUrl = "" }: ChatWidgetProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [connected, setConnected] = useState(false);
    const [users, setUsers] = useState<{ userId: string; userName: string }[]>([]);
    const wsRef = useRef<WebSocket | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Connect to WebSocket when opened
    useEffect(() => {
        if (!isOpen || connected) return;

        const wsUrl = `${apiUrl.replace('https://', 'wss://').replace('http://', 'ws://')}/chat/rooms/${roomId}/websocket?roomId=${roomId}&tenantId=${tenantSlug}&userId=${userId}&userName=${encodeURIComponent(userName)}`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            setConnected(true);
            console.log("[Chat] Connected");
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                switch (data.type) {
                    case "history":
                        setMessages(data.messages || []);
                        break;
                    case "message":
                        setMessages(prev => [...prev, data]);
                        break;
                    case "user_list":
                        setUsers(data.users || []);
                        break;
                    case "user_joined":
                        setUsers(prev => [...prev, { userId: data.userId, userName: data.userName }]);
                        break;
                    case "user_left":
                        setUsers(prev => prev.filter(u => u.userId !== data.userId));
                        break;
                }
            } catch (e) {
                console.error("[Chat] Parse error:", e);
            }
        };

        ws.onclose = () => {
            setConnected(false);
            console.log("[Chat] Disconnected");
        };

        ws.onerror = (e) => {
            console.error("[Chat] Error:", e);
        };

        return () => {
            ws.close();
            wsRef.current = null;
        };
    }, [isOpen, roomId, tenantSlug, userId, userName, apiUrl]);

    const sendMessage = () => {
        if (!inputValue.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        wsRef.current.send(JSON.stringify({
            type: "message",
            content: inputValue.trim(),
        }));

        setInputValue("");
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <>
            {/* Floating Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition flex items-center justify-center z-50"
            >
                {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
            </button>

            {/* Chat Panel */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 w-96 h-[500px] bg-white rounded-xl shadow-2xl border border-zinc-200 flex flex-col z-50 overflow-hidden">
                    {/* Header */}
                    <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <MessageCircle size={20} />
                            <span className="font-medium">Chat</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <Users size={16} />
                            <span>{users.length} online</span>
                            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50">
                        {messages.length === 0 && (
                            <div className="text-center text-zinc-400 py-8">
                                <MessageCircle size={32} className="mx-auto mb-2 opacity-50" />
                                <p>No messages yet</p>
                                <p className="text-sm">Start the conversation!</p>
                            </div>
                        )}
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.userId === userId ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] p-3 rounded-xl ${msg.userId === userId
                                            ? 'bg-blue-600 text-white rounded-br-sm'
                                            : 'bg-white text-zinc-900 border border-zinc-200 rounded-bl-sm'
                                        }`}
                                >
                                    {msg.userId !== userId && (
                                        <p className="text-xs font-medium text-blue-600 mb-1">{msg.userName}</p>
                                    )}
                                    <p className="text-sm">{msg.content}</p>
                                    <p className={`text-[10px] mt-1 ${msg.userId === userId ? 'text-blue-200' : 'text-zinc-400'}`}>
                                        {new Date(msg.timestamp).toLocaleTimeString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-3 border-t border-zinc-200 bg-white">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Type a message..."
                                className="flex-1 px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={!connected}
                            />
                            <button
                                onClick={sendMessage}
                                disabled={!connected || !inputValue.trim()}
                                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Send size={18} />
                            </button>
                        </div>
                        {!connected && (
                            <p className="text-xs text-red-500 mt-1">Connecting...</p>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

export default ChatWidget;
