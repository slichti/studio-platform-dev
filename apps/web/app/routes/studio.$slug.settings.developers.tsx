
import { useState, useEffect } from "react";
import { useParams, useOutletContext } from "react-router";
import { apiRequest } from "~/utils/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "~/components/ui/Card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Trash2, Terminal, Loader2, Key, Copy, Check, Plus, AlertCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { ConfirmationDialog } from "~/components/Dialogs";

export default function DevelopersPage() {
    const { slug } = useParams();
    const { tenant, features } = useOutletContext<any>() || {};

    const [endpoints, setEndpoints] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [createUrl, setCreateUrl] = useState("");
    const [createEvents, setCreateEvents] = useState("student.created, payment.succeeded");
    const [deleteWebhookId, setDeleteWebhookId] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const hasWebhookFeature = features.has('webhooks');

    useEffect(() => {
        if (hasWebhookFeature) {
            loadWebhooks();
        }
    }, [slug, hasWebhookFeature]);

    const loadWebhooks = async () => {
        setLoading(true);
        try {
            const token = (window as any).Clerk?.session?.getToken ? await (window as any).Clerk.session.getToken() : localStorage.getItem('token');
            const data: any = await apiRequest("/integrations/webhooks", token, { headers: { 'X-Tenant-Slug': slug || '' } });
            setEndpoints(data.endpoints || []);
        } catch (e: any) {
            console.error("Failed to load webhooks", e);
            if (e.message?.includes('403')) {
                // Feature might be disabled globally
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCreateWebhook = async () => {
        if (!createUrl) return;
        setIsCreating(true);
        try {
            const token = await (window as any).Clerk?.session?.getToken();
            await apiRequest("/integrations/webhooks", token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': slug || '' },
                body: JSON.stringify({
                    url: createUrl,
                    events: createEvents.split(',').map(s => s.trim()),
                    description: "Developer API Endpoint"
                })
            });
            setCreateUrl("");
            toast.success("Webhook created successfully");
            loadWebhooks();
        } catch (e: any) {
            toast.error("Failed to create: " + e.message);
        } finally {
            setIsCreating(false);
        }
    };

    const confirmDeleteWebhook = async () => {
        if (!deleteWebhookId) return;
        try {
            const token = await (window as any).Clerk?.session?.getToken();
            await apiRequest(`/integrations/webhooks/${deleteWebhookId}`, token, {
                method: 'DELETE',
                headers: { 'X-Tenant-Slug': slug || '' }
            });
            setEndpoints(endpoints.filter(e => e.id !== deleteWebhookId));
            toast.success("Webhook deleted");
        } catch (e: any) {
            toast.error("Failed to delete: " + e.message);
        } finally {
            setDeleteWebhookId(null);
        }
    };

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
        toast.success("Copied to clipboard");
    };

    if (!hasWebhookFeature) {
        return (
            <div className="max-w-4xl mx-auto py-12">
                <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-400">
                            <AlertCircle className="h-5 w-5" /> Webhooks Feature Disabled
                        </CardTitle>
                        <CardDescription className="text-amber-700 dark:text-amber-500">
                            Developer webhooks are not enabled for this studio.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-amber-700 dark:text-amber-500 mb-6">
                            Webhooks allow your developers to receive real-time notifications about events in your studio.
                            To use this feature, you must enable it in your studio features or upgrade your plan.
                        </p>
                        <Button
                            onClick={async () => {
                                try {
                                    const token = await (window as any).Clerk?.session?.getToken();
                                    await apiRequest("/tenant/features", token, {
                                        method: 'POST',
                                        headers: { 'X-Tenant-Slug': slug || '' },
                                        body: JSON.stringify({ featureKey: 'webhooks', enabled: true })
                                    });
                                    window.location.reload();
                                } catch (e: any) {
                                    toast.error(e.message || "Failed to enable feature");
                                }
                            }}
                        >
                            Enable Webhooks
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-5xl pb-10">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                    <Terminal className="h-6 w-6 text-blue-600" /> Developer Settings
                </h1>
                <p className="text-zinc-500 dark:text-zinc-400">Manage API access, outgoing webhooks, and developer tools.</p>
            </div>

            <div className="grid gap-6">
                {/* --- WEBHOOKS SECTION --- */}
                <Card>
                    <CardHeader>
                        <CardTitle>Outgoing Webhooks</CardTitle>
                        <CardDescription>
                            Subscription endpoints that receive JSON payloads when events occur.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {loading ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                            </div>
                        ) : (
                            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 font-medium">
                                        <tr>
                                            <th className="text-left py-3 px-4">Endpoint</th>
                                            <th className="text-left py-3 px-4">Events</th>
                                            <th className="text-right py-3 px-4">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                        {endpoints.length === 0 && (
                                            <tr>
                                                <td colSpan={3} className="py-8 text-center text-zinc-500">No webhooks configured.</td>
                                            </tr>
                                        )}
                                        {endpoints.map(ep => (
                                            <tr key={ep.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors">
                                                <td className="py-3 px-4">
                                                    <div className="font-mono text-blue-600 dark:text-blue-400">{ep.url}</div>
                                                    <div className="text-[10px] text-zinc-400 mt-1 flex items-center gap-1">
                                                        <Key className="h-3 w-3" /> Secret: {ep.secret}
                                                        <button
                                                            onClick={() => copyToClipboard(ep.secret, `sec-${ep.id}`)}
                                                            className="hover:text-zinc-700 dark:hover:text-zinc-200"
                                                        >
                                                            {copiedId === `sec-${ep.id}` ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex flex-wrap gap-1">
                                                        {(Array.isArray(ep.events) ? ep.events : (ep.events as string).split(',')).map((ev: string) => (
                                                            <span key={ev} className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
                                                                {ev}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <button
                                                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500 rounded transition-colors"
                                                        onClick={() => setDeleteWebhookId(ep.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                            <h4 className="text-sm font-semibold mb-3">Add Endpoint</h4>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label>Target URL</Label>
                                    <Input
                                        placeholder="https://api.myapp.com/webhooks"
                                        value={createUrl}
                                        onChange={e => setCreateUrl(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Events (comma separated)</Label>
                                    <Input
                                        value={createEvents}
                                        onChange={e => setCreateEvents(e.target.value)}
                                    />
                                    <p className="text-[10px] text-zinc-400">Available: student.created, payment.succeeded, *</p>
                                </div>
                            </div>
                            <div className="mt-4 flex justify-end">
                                <Button
                                    onClick={handleCreateWebhook}
                                    disabled={!createUrl || isCreating}
                                    className="gap-2"
                                >
                                    {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                    Register Webhook
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* --- API KEYS SECTION --- */}
                <Card>
                    <CardHeader>
                        <CardTitle>API Access</CardTitle>
                        <CardDescription>
                            Identify your requests and authenticate with the Studio API.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Studio ID</Label>
                            <div className="flex gap-2">
                                <Input readOnly value={tenant.id} className="font-mono bg-zinc-50 dark:bg-zinc-900" />
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => copyToClipboard(tenant.id, 'tenantId')}
                                >
                                    {copiedId === 'tenantId' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/50 rounded-lg p-4 flex gap-3">
                            <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0" />
                            <div className="text-xs text-blue-700 dark:text-blue-300">
                                <p className="font-semibold mb-1">Authenticated Requests</p>
                                <p>Requests from your own application must include your generated Webhook Secret or a valid Studio JWT in the <code>Authorization</code> or <code>X-Studio-Signature</code> header.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <ConfirmationDialog
                isOpen={!!deleteWebhookId}
                onClose={() => setDeleteWebhookId(null)}
                onConfirm={confirmDeleteWebhook}
                title="Delete Webhook Endpoint"
                message="Are you sure you want to stop sending events to this URL? This action cannot be undone."
                isDestructive={true}
                confirmText="Delete Endpoint"
            />
        </div>
    );
}
