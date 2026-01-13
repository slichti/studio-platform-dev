
import { DurableObject } from "cloudflare:workers";

interface MetricsState {
    activeUsers: Map<string, number>; // userId -> lastActiveTimestamp
}

export class Metrics extends DurableObject {
    private activeUsers: Map<string, number> = new Map();

    constructor(state: DurableObjectState, env: any) {
        super(state, env);
        // We don't persist active users state, it's ephemeral
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        if (request.method === 'POST' && url.pathname === '/ping') {
            const { userId } = await request.json() as any;
            if (userId) {
                this.activeUsers.set(userId, Date.now());
            }
            return new Response('OK');
        }

        if (request.method === 'GET' && url.pathname === '/stats') {
            this.cleanup();
            return new Response(JSON.stringify({
                activeUsers: this.activeUsers.size
            }));
        }

        return new Response('Not Found', { status: 404 });
    }

    async alarm() {
        this.cleanup();
    }

    private cleanup() {
        const now = Date.now();
        const expiry = now - (5 * 60 * 1000); // 5 minutes inactivity
        for (const [userId, lastActive] of this.activeUsers) {
            if (lastActive < expiry) {
                this.activeUsers.delete(userId);
            }
        }
    }
}
