/**
 * ChatRoom Durable Object
 * 
 * Manages real-time WebSocket connections for a single chat room.
 * Each room is a unique Durable Object instance identified by room ID.
 * 
 * Features:
 * - WebSocket connection management
 * - In-memory message buffer for real-time broadcast
 * - Persistence to D1 on disconnect/interval
 * - User presence tracking
 */

import { DurableObject } from "cloudflare:workers";

interface ChatMessage {
    id: string;
    userId: string;
    userName: string;
    content: string;
    timestamp: number;
}

interface ConnectedUser {
    userId: string;
    userName: string;
    joinedAt: number;
}

export class ChatRoom {
    private users: Map<WebSocket, ConnectedUser> = new Map();
    private messageBuffer: ChatMessage[] = [];
    private roomId: string | null = null;
    private tenantId: string | null = null;
    private state: DurableObjectState;
    private env: any;

    constructor(state: DurableObjectState, env: any) {
        this.state = state;
        this.env = env;
        try {
            console.log('[ChatRoom] Constructor initiated');

            // Restore any hibernated connections
            this.state.getWebSockets().forEach((ws: WebSocket) => {
                try {
                    const meta = ws.deserializeAttachment() as ConnectedUser | null;
                    if (meta) {
                        this.users.set(ws, meta);
                    }
                } catch (e) {
                    console.error('[ChatRoom] Failed to deserialize attachment', e);
                }
            });
            console.log(`[ChatRoom] Restored ${this.users.size} connections`);
        } catch (e: any) {
            console.error('[ChatRoom] Constructor Fatal Error:', e);
        }
    }

    /**
     * HTTP request handler - upgrades to WebSocket
     */
    async fetch(request: Request): Promise<Response> {
        console.log('[ChatRoom] Fetch received:', request.url);
        const url = new URL(request.url);

        // Handle internal broadcast API (from REST API)
        if (request.method === 'POST' && url.pathname === '/broadcast') {
            try {
                const message = await request.json();
                this.broadcast(message);
                return new Response(JSON.stringify({ success: true }), { status: 200 });
            } catch (e: any) {
                return new Response(e.message, { status: 500 });
            }
        }

        const roomId = url.searchParams.get("roomId");
        const tenantId = url.searchParams.get("tenantId");
        const tenantSlug = url.searchParams.get("tenantSlug");
        const userId = url.searchParams.get("userId");
        const userName = url.searchParams.get("userName") || "Anonymous";

        if (!roomId || (!tenantId && !tenantSlug) || !userId) {
            return new Response("Missing required parameters: roomId, (tenantId or tenantSlug), and userId are required.", { status: 400 });
        }

        this.roomId = roomId;
        this.tenantId = tenantId || tenantSlug;

        // Create WebSocket pair
        const pair = new WebSocketPair();
        const [client, server] = [pair[0], pair[1]];

        // Set up the connection
        const connectedUser: ConnectedUser = {
            userId,
            userName,
            joinedAt: Date.now(),
        };

        // Store in hibernation-safe way
        this.state.acceptWebSocket(server);
        server.serializeAttachment(connectedUser);
        this.users.set(server, connectedUser);

        // Broadcast user joined
        this.broadcast({
            type: "user_joined",
            userId,
            userName,
            timestamp: Date.now(),
        });

        // Send recent messages to new user
        const recentMessages = this.messageBuffer.slice(-50);
        server.send(JSON.stringify({
            type: "history",
            messages: recentMessages,
        }));

        // Send current user list
        const userList = Array.from(this.users.values()).map(u => ({
            userId: u.userId,
            userName: u.userName,
        }));
        server.send(JSON.stringify({
            type: "user_list",
            users: userList,
        }));

        return new Response(null, {
            status: 101,
            webSocket: client,
        });
    }

    /**
     * WebSocket message handler (hibernation-compatible)
     */
    async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
        const user = this.users.get(ws);
        if (!user) return;

        try {
            const data = JSON.parse(message as string);

            switch (data.type) {
                case "message":
                    const chatMessage: ChatMessage = {
                        id: crypto.randomUUID(),
                        userId: user.userId,
                        userName: user.userName,
                        content: data.content,
                        timestamp: Date.now(),
                    };

                    // Add to buffer
                    this.messageBuffer.push(chatMessage);
                    if (this.messageBuffer.length > 100) {
                        this.messageBuffer.shift();
                    }

                    // Broadcast to all
                    this.broadcast({
                        type: "message",
                        ...chatMessage,
                    });

                    // Persist asynchronously
                    this.persistMessage(chatMessage);
                    break;

                case "typing":
                    // Broadcast typing indicator
                    this.broadcast({
                        type: "typing",
                        userId: user.userId,
                        userName: user.userName,
                    }, ws);
                    break;

                case "ping":
                    ws.send(JSON.stringify({ type: "pong" }));
                    break;
            }
        } catch (e) {
            console.error("WebSocket message error:", e);
        }
    }

    /**
     * WebSocket close handler
     */
    async webSocketClose(ws: WebSocket, code: number, reason: string) {
        const user = this.users.get(ws);
        if (user) {
            this.broadcast({
                type: "user_left",
                userId: user.userId,
                userName: user.userName,
                timestamp: Date.now(),
            });
            this.users.delete(ws);
        }
    }

    /**
     * WebSocket error handler
     */
    async webSocketError(ws: WebSocket, error: unknown) {
        console.error("WebSocket error:", error);
        this.users.delete(ws);
    }

    /**
     * Broadcast message to all connected users (optionally excluding sender)
     */
    private broadcast(data: any, except?: WebSocket) {
        const message = JSON.stringify(data);
        for (const [ws, user] of this.users) {
            if (ws !== except && ws.readyState === WebSocket.OPEN) {
                try {
                    ws.send(message);
                } catch (e) {
                    console.error("Broadcast error:", e);
                }
            }
        }
    }

    /**
     * Persist message to D1 (called asynchronously)
     */
    private async persistMessage(message: ChatMessage) {
        try {
            // Note: In production, you'd inject DB binding here
            // For now, we store in alarm-based batch persistence
            await this.state.storage.put(`msg:${message.id}`, message);
        } catch (e) {
            console.error("Persist error:", e);
        }
    }

    /**
     * Alarm handler for batch persistence
     */
    async alarm() {
        // Flush messageBuffer to D1
        // This would be called periodically
        console.log(`[ChatRoom] Alarm: Room ${this.roomId}, ${this.messageBuffer.length} messages buffered`);
    }
}

export default ChatRoom;
