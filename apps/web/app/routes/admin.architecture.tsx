
import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { useLoaderData, useRevalidator } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { RefreshCw, Server, Users, Database, Globe } from "lucide-react";

export const loader = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    try {
        const stats = await apiRequest("/admin/stats/architecture", token);
        return { stats, error: null };
    } catch (e: any) {
        return { stats: null, error: e.message };
    }
};

export default function AdminArchitecture() {
    const { stats, error } = useLoaderData<any>();
    const revalidator = useRevalidator();
    const mermaidRef = useRef<HTMLDivElement>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        mermaid.initialize({
            startOnLoad: true,
            theme: 'base',
            themeVariables: {
                primaryColor: '#e0e7ff', // indigo-100
                primaryTextColor: '#3730a3', // indigo-900
                primaryBorderColor: '#6366f1', // indigo-500
                lineColor: '#94a3b8', // zinc-400
                secondaryColor: '#f0fdf4', // emerald-50
                tertiaryColor: '#fff',
            },
            flowchart: {
                curve: 'basis'
            }
        });
    }, []);

    useEffect(() => {
        if (mermaidRef.current) {
            mermaid.contentLoaded();
        }
    }, [stats]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        revalidator.revalidate();
        setTimeout(() => setIsRefreshing(false), 1000);
    };

    const diagram = `
graph TD
    Client[Web Client]
    style Client fill:#fff,stroke:#333,stroke-width:2px
    
    Auth[Clerk Auth]
    style Auth fill:#f3e8ff,stroke:#9333ea
    
    subgraph "Cloudflare Edge Network"
        Pages[Cloudflare Pages]
        Worker[Worker API]
        
        subgraph "Persistence"
            D1[(D1 Database)]
            R2[(R2 Storage)]
            DO{{Durable Objects}}
        end
    end
    style Worker fill:#dbeafe,stroke:#2563eb,stroke-width:2px
    
    subgraph "External Services"
        Stripe[Stripe Connect]
        Resend[Resend Email]
        LiveKit[LiveKit Video]
    end

    Client <-->|HTTPS| Pages
    Client <-->|JWT| Auth
    
    Client -->|REST API| Worker
    Client <-->|WebSocket| DO
    
    Worker -->|SQL ${stats?.latency?.database_ms || '?'}ms| D1
    Worker -->|blobs| R2
    Worker -->|Coordination| DO
    
    Worker -->|Payments| Stripe
    Worker -->|Email| Resend
    Worker -->|Tokens| LiveKit
    
    linkStyle default stroke:#94a3b8,stroke-width:2px;
`;

    if (error) return <div className="p-8 text-red-600">Error: {error}</div>;

    return (
        <div className="max-w-6xl mx-auto py-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">System Architecture</h1>
                    <p className="text-zinc-500 mt-1">Real-time topology and service status.</p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
                >
                    <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
                    Refresh Stats
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Connected Users</CardTitle>
                        <Users className="h-4 w-4 text-indigo-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.connectedUsers || 0}</div>
                        <p className="text-xs text-muted-foreground">Active WebSocket Sessions</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Database Latency</CardTitle>
                        <Database className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.latency?.database_ms || 0}ms</div>
                        <p className="text-xs text-muted-foreground">Read Round-trip</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Edge Latency</CardTitle>
                        <Globe className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats?.latency?.edge_ms || 0}ms</div>
                        <p className="text-xs text-muted-foreground">Worker Execution</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">System Status</CardTitle>
                        <Server className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">Operational</div>
                        <p className="text-xs text-muted-foreground">All systems normal</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="overflow-hidden bg-white">
                <CardContent className="p-0">
                    <div className="bg-zinc-50 border-b border-zinc-100 p-4 flex justify-between items-center">
                        <div className="text-sm font-medium text-zinc-700">Live Topology Map</div>
                        <div className="flex gap-4 text-xs text-zinc-500">
                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> API</div>
                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-purple-500"></div> Auth</div>
                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-500"></div> Database</div>
                        </div>
                    </div>
                    <div className="p-8 flex justify-center bg-white min-h-[500px]">
                        <div className="mermaid" ref={mermaidRef}>
                            {diagram}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
