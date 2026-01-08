import { json, type LoaderFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { ShieldCheck, Database, CheckCircle, XCircle, Activity, Server, Clock } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";

export const loader = async ({ context }: LoaderFunctionArgs) => {
    return json({
        env: context.env.ENVIRONMENT || 'production'
    });
};

export default function AdminDiagnostics() {
    const { env } = useLoaderData<typeof loader>();
    const fetcher = useFetcher();

    const runDiagnostics = () => {
        // Call the backend API
        fetcher.load("/api/diagnostics"); // We need to ensure we have a proxy or direct fetch to API
        // Actually, remix loaders usually proxy to backend.
        // Ideally we should make a POST action or use a resource route.
        // For simplicity, let's try a direct fetch if API is on same domain or proxied.
        // If we are on same domain (CF pages functions), use fetcher.load to a resource route.
        // BUT our API is separate worker.
        // We should probably just call the API directly from client side or via a Remix resource route.
        // Let's assume standard client-side fetch to API_URL
    };

    // Helper to standard fetch
    const handleRun = async () => {
        // Using fetcher.submit to trigger a resource route action would be cleaner if we had one.
        // For now, let's just use standard fetch client side for this "live" check dashboard
        // Or simpler: use fetcher.load which calls OUR loader, which calls API.
        fetcher.load("/admin/diagnostics/run");
    };

    const data = fetcher.data as any;
    const isLoading = fetcher.state === "loading";

    return (
        <div className="container mx-auto py-10 space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">System Diagnostics</h1>
                    <p className="text-muted-foreground mt-2">
                        Real-time health checks and integration status.
                    </p>
                </div>
                <Button onClick={handleRun} disabled={isLoading} size="lg">
                    {isLoading ? (
                        <Activity className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Activity className="mr-2 h-4 w-4" />
                    )}
                    Run Diagnostics
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Environment Card */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Environment</CardTitle>
                        <Server className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold capitalize">{env}</div>
                        <p className="text-xs text-muted-foreground">
                            Running on Cloudflare Workers
                        </p>
                    </CardContent>
                </Card>

                {/* Database Latency */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Database Latency</CardTitle>
                        <Database className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {data?.latency ? (
                            <>
                                <div className="text-2xl font-bold">{data.latency.database_ms}ms</div>
                                <p className="text-xs text-muted-foreground">
                                    Round-trip time to D1
                                </p>
                            </>
                        ) : (
                            <div className="text-2xl font-bold text-muted-foreground">-</div>
                        )}
                    </CardContent>
                </Card>

                {/* Status */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">System Status</CardTitle>
                        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {data ? (
                            <div className="flex items-center space-x-2">
                                {data.status === 'ok' ? (
                                    <Badge variant="default" className="bg-green-600 hover:bg-green-700">Operational</Badge>
                                ) : (
                                    <Badge variant="destructive">Degraded</Badge>
                                )}
                            </div>
                        ) : (
                            <div className="text-2xl font-bold text-muted-foreground">-</div>
                        )}

                    </CardContent>
                </Card>
            </div>

            {/* Integrations Grid */}
            {data?.integrations && (
                <Card>
                    <CardHeader>
                        <CardTitle>Integrations</CardTitle>
                        <CardDescription>Status of third-party connections</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {Object.entries(data.integrations).map(([key, connected]) => (
                                <div key={key} className="flex items-center justify-between p-4 border rounded-lg">
                                    <span className="capitalize font-medium">{key.replace('_', ' ')}</span>
                                    {connected ? (
                                        <CheckCircle className="h-5 w-5 text-green-500" />
                                    ) : (
                                        <XCircle className="h-5 w-5 text-red-500" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Raw JSON for Debugging (Hidden by default or toggleable) */}
            {/* <pre>{JSON.stringify(data, null, 2)}</pre> */}
        </div>
    );
}
