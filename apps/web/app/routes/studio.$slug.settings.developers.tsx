import { useState } from "react";
import { useParams, useOutletContext } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "~/components/ui/Card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/Badge";
import { Trash2, Terminal, Loader2, Key, Copy, Check, Plus, AlertCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { ConfirmationDialog } from "~/components/Dialogs";
import { ComponentErrorBoundary } from "~/components/ErrorBoundary";

import { useAuth } from "@clerk/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "~/utils/api";
import { useWebhooks } from "~/hooks/useWebhooks";
import { cn } from "~/lib/utils";

export default function DevelopersPage() {
    const { slug } = useParams();
    const { tenant, features } = useOutletContext<any>() || {};
    const { getToken } = useAuth();
    const queryClient = useQueryClient();

    const hasWebhookFeature = features?.has?.('webhooks');

    // Data
    const { data: endpoints = [], isLoading } = useWebhooks(slug!, hasWebhookFeature);

    // State
    const [isCreating, setIsCreating] = useState(false);
    const [createUrl, setCreateUrl] = useState("");
    const [createEvents, setCreateEvents] = useState("student.created, payment.succeeded");
    const [deleteWebhookId, setDeleteWebhookId] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Handlers
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['webhooks', slug] });

    const handleCreateWebhook = async () => {
        if (!createUrl) return;
        setIsCreating(true);
        try {
            const token = await getToken();
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
            refresh();
        } catch (e: any) {
            toast.error("Failed to create: " + e.message);
        } finally {
            setIsCreating(false);
        }
    };

    const confirmDeleteWebhook = async () => {
        if (!deleteWebhookId) return;
        try {
            const token = await getToken();
            await apiRequest(`/integrations/webhooks/${deleteWebhookId}`, token, {
                method: 'DELETE',
                headers: { 'X-Tenant-Slug': slug || '' }
            });
            toast.success("Webhook deleted");
            refresh();
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

    const handleEnableWebhooks = async () => {
        try {
            const token = await getToken();
            await apiRequest("/tenant/features", token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': slug || '' },
                body: JSON.stringify({ featureKey: 'webhooks', enabled: true })
            });
            window.location.reload(); // Simple reload to refresh context
        } catch (e: any) {
            toast.error(e.message || "Failed to enable feature");
        }
    };

    if (features && !hasWebhookFeature) {
        return (
            <div className="max-w-4xl mx-auto py-12 p-6">
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
                        <Button onClick={handleEnableWebhooks} className="bg-amber-600 hover:bg-amber-700 text-white border-none">
                            Enable Webhooks
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-5xl h-full flex flex-col bg-zinc-50 dark:bg-zinc-950">
            {/* Header */}
            <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            <Terminal className="h-5 w-5 text-blue-600" /> Developer Settings
                        </h1>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">Manage API access, outgoing webhooks, and developer tools.</p>
                    </div>
                </div>
            </header>

            <ComponentErrorBoundary>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* --- WEBHOOKS SECTION --- */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Outgoing Webhooks</CardTitle>
                            <CardDescription>
                                Subscription endpoints that receive JSON payloads when events occur.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {isLoading ? (
                                <div className="space-y-3">
                                    {[1, 2].map(i => <div key={i} className="h-16 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-lg" />)}
                                </div>
                            ) : (
                                <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-zinc-50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 font-medium border-b border-zinc-100 dark:border-zinc-800">
                                            <tr>
                                                <th className="text-left py-3 px-4">Endpoint</th>
                                                <th className="text-left py-3 px-4">Events</th>
                                                <th className="text-right py-3 px-4">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                            {endpoints.length === 0 && (
                                                <tr>
                                                    <td colSpan={3} className="py-8 text-center text-zinc-500">No webhooks configured.</td>
                                                </tr>
                                            )}
                                            {endpoints.map(ep => (
                                                <tr key={ep.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors">
                                                    <td className="py-3 px-4">
                                                        <div className="font-mono text-blue-600 dark:text-blue-400 break-all">{ep.url}</div>
                                                        <div className="text-[10px] text-zinc-400 mt-1 flex items-center gap-1">
                                                            <Key className="h-3 w-3" /> Secret: <span className="blur-xs hover:blur-none transition-all cursor-text">{ep.secret.substring(0, 10)}...</span>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-5 w-5 ml-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                                                                onClick={() => copyToClipboard(ep.secret, `sec-${ep.id}`)}
                                                            >
                                                                {copiedId === `sec-${ep.id}` ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                                                            </Button>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="flex flex-wrap gap-1">
                                                            {(Array.isArray(ep.events) ? ep.events : (ep.events as string).split(',')).map((ev: string) => (
                                                                <Badge key={ev} variant="secondary" className="text-[10px] font-mono font-medium">
                                                                    {ev}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 h-8 w-8"
                                                            onClick={() => setDeleteWebhookId(ep.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800">
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
                                    <Input readOnly value={tenant?.id || ''} className="font-mono bg-zinc-50 dark:bg-zinc-900 max-w-md" />
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => copyToClipboard(tenant?.id || '', 'tenantId')}
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
            </ComponentErrorBoundary>

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
