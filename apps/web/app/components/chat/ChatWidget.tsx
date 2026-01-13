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
    tenantId: string; // The tenant to connect to (e.g. 'platform' or specific studio slug)
    userId?: string;
    userName?: string;
    apiUrl?: string;
    enabled?: boolean; // Control visibility
}

export function ChatWidget({ roomId, tenantId, userId, userName, apiUrl = "", enabled = true }: ChatWidgetProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [connected, setConnected] = useState(false);
    const [users, setUsers] = useState<{ userId: string; userName: string }[]>([]);
    const wsRef = useRef<WebSocket | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [guestId] = useState(() => `guest_${Math.random().toString(36).substr(2, 9)}`);

    const effectiveUserId = userId || guestId;
    const effectiveUserName = userName || "Guest";

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Connect to WebSocket when opened
    useEffect(() => {
        if (!isOpen || connected) return;

        // Use window.location.origin if apiUrl is not provided
        const baseUrl = apiUrl || (typeof window !== 'undefined' ? window.location.origin : '');
        const wsProtocol = baseUrl.startsWith('https') ? 'wss://' : 'ws://';
        const wsHost = baseUrl.replace(/^http(s)?:\/\//, '');

        const wsUrl = `${wsProtocol}${wsHost}/api/chat/rooms/${roomId}/websocket?roomId=${roomId}&tenantId=${tenantId}&userId=${effectiveUserId}&userName=${encodeURIComponent(effectiveUserName)}`;

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
    }, [isOpen, roomId, tenantId, userId, userName, apiUrl]);

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

    const [showBadge, setShowBadge] = useState(true);

    const instantAnswers = [
        "Track my order",
        "What are your shipping details?",
        "What is your shipping time?",
        "What is your contact info?"
    ];

    const sendInstantAnswer = (answer: string) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        wsRef.current.send(JSON.stringify({
            type: "message",
            content: answer,
        }));
    };

    if (!enabled) return null;

    return (
        <>
            {/* Floating Button */}
            <button
                onClick={() => { setIsOpen(!isOpen); setShowBadge(false); }}
                className="fixed bottom-6 right-6 w-14 h-14 bg-[#2563EB] text-white rounded-full shadow-lg hover:opacity-90 transition flex items-center justify-center z-50"
            >
                {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
                {showBadge && !isOpen && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-white">
                        1
                    </span>
                )}
            </button>

            {/* Chat Panel */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 w-[380px] h-[600px] bg-white rounded-xl shadow-2xl border border-zinc-200 flex flex-col z-50 overflow-hidden font-sans">
                    {/* Header */}
                    <div className="bg-[#2563EB] text-white px-6 py-6 pb-12 relative overflow-hidden">
                        <div className="relative z-10">
                            <h2 className="text-xl font-bold mb-2">Chat with us</h2>
                            <p className="text-white/90 text-sm leading-relaxed">
                                👋 Hi, message us with any questions. We're happy to help!
                            </p>
                        </div>
                        {/* Decorative Circles */}
                        <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full" />
                        <div className="absolute top-8 right-12 w-16 h-16 bg-white/10 rounded-full" />
                    </div>

                    {/* Messages & Instant Answers */}
                    <div className="flex-1 overflow-y-auto bg-white flex flex-col">
                        {/* Wrapper to push content to bottom */}
                        <div className="mt-auto p-4 space-y-4">
                            {/* Chat History */}
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex ${msg.userId === userId ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.userId === userId
                                            ? 'bg-[#2563EB] text-white rounded-br-sm'
                                            : 'bg-gray-100 text-zinc-900 rounded-bl-sm'
                                            }`}
                                    >
                                        <p>{msg.content}</p>
                                    </div>
                                </div>
                            ))}

                            {/* Instant Answers (Only show if no messages or user wants them? Screenshot shows them present) */}
                            {messages.length === 0 && (
                                <div className="space-y-2 mt-4">
                                    <p className="text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wide">Instant answers</p>
                                    {instantAnswers.map((answer) => (
                                        <button
                                            key={answer}
                                            onClick={() => sendInstantAnswer(answer)}
                                            disabled={!connected}
                                            className="w-full text-left p-3 rounded-xl border border-zinc-200 text-sm text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 transition-colors bg-white shadow-sm"
                                        >
                                            {answer}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>

                    {/* Input Area */}
                    <div className="p-4 border-t border-zinc-100 bg-white">
                        <div className="relative flex items-center">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Write message"
                                className="w-full pl-4 pr-12 py-3 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:border-zinc-300 focus:ring-0 shadow-sm"
                                disabled={!connected}
                            />
                            <button
                                onClick={sendMessage}
                                disabled={!connected || !inputValue.trim()}
                                className="absolute right-2 p-2 text-zinc-400 hover:text-[#2563EB] transition-colors disabled:opacity-50"
                            >
                                <Send size={20} />
                            </button>
                        </div>
                        {!connected && (
                            <div className="text-center mt-2">
                                <span className="text-[10px] text-zinc-400">Connecting to support...</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

export default ChatWidget;
