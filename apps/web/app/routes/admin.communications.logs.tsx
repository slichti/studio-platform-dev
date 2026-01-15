import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/cloudflare";
import { useLoaderData, useFetcher, useSearchParams, Form } from "@remix-run/react";
import {
    Table, TableHead, TableHeader, TableRow, TableCell
} from "~/components/ui/Table";
import { Badge } from "~/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { RefreshCw, Search, Send, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { requireUser } from "~/auth.server";
import { toast } from "sonner";
import { useEffect } from "react";

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
    const user = await requireUser(context, request);
    if (user.role !== 'admin' && !user.isPlatformAdmin) {
        throw new Response("Unauthorized", { status: 403 });
    }

    const url = new URL(request.url);
    const api = context.env.API_URL;
    const token = await context.session.get('token');

    const params = new URLSearchParams(url.search);
    if (!params.get('page')) params.set('page', '1');
    if (!params.get('limit')) params.set('limit', '50');

    const response = await fetch(`${api}/admin/communications/logs?${params.toString()}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Cookie': request.headers.get('Cookie') || ''
        }
    });

    if (!response.ok) {
        throw new Error("Failed to fetch logs");
    }

    const data = await response.json();
    return json({
        logs: data.logs,
        pagination: data.pagination,
        params: Object.fromEntries(params)
    });
};

export const action = async ({ request, context }: ActionFunctionArgs) => {
    const user = await requireUser(context, request);
    if (user.role !== 'admin' && !user.isPlatformAdmin) throw new Response("Unauthorized", { status: 403 });

    const formData = await request.formData();
    const action = formData.get('_action');
    const api = context.env.API_URL;

    if (action === 'resend') {
        const id = formData.get('id');
        const response = await fetch(`${api}/admin/communications/resend/${id}`, {
            method: 'POST',
            headers: { 'Cookie': request.headers.get('Cookie') || '' }
        });

        if (!response.ok) {
            const err = await response.json();
            return json({ error: err.error || "Failed to resend" }, { status: 500 });
        }
        return json({ success: true, message: "Email resent successfully" });
    }

    return null;
};

export default function EmailLogs() {
    const { logs, pagination, params } = useLoaderData<typeof loader>();
    const [searchParams, setSearchParams] = useSearchParams();
    const resendFetcher = useFetcher();

    useEffect(() => {
        if (resendFetcher.data?.success) {
            toast.success(resendFetcher.data.message);
        } else if (resendFetcher.data?.error) {
            toast.error(resendFetcher.data.error);
        }
    }, [resendFetcher.data]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData(e.target as HTMLFormElement);
        const search = formData.get('search') as string;
        setSearchParams(prev => {
            prev.set('search', search);
            prev.set('page', '1');
            return prev;
        });
    };

    const handleFilterChange = (key: string, value: string) => {
        setSearchParams(prev => {
            if (value === 'all') prev.delete(key);
            else prev.set(key, value);
            prev.set('page', '1');
            return prev;
        });
    };

    const StatusBadge = ({ status, error }: { status: string, error?: string }) => {
        if (status === 'sent') return <Badge className="bg-green-100 text-green-800 hover:bg-green-200"><CheckCircle className="w-3 h-3 mr-1" /> Sent</Badge>;
        if (status === 'failed') return <Badge variant="destructive" title={error}><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
        return <Badge variant="outline">{status}</Badge>;
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Email Logs</h1>
                    <p className="text-muted-foreground">Monitor and manage platform communication logs.</p>
                </div>
                <button
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
                    onClick={() => window.location.reload()}
                >
                    <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                </button>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row gap-4 justify-between">
                        <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-auto">
                            <input
                                name="search"
                                placeholder="Search subject or recipient..."
                                defaultValue={params.search}
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:w-[300px]"
                            />
                            <button type="submit" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 h-9 px-4 py-2">
                                <Search className="w-4 h-4" />
                            </button>
                        </form>
                        <div className="flex gap-2">
                            <select
                                onChange={(e) => handleFilterChange('status', e.target.value)}
                                defaultValue={params.status || 'all'}
                                className="flex h-9 w-[140px] items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option value="all">All Status</option>
                                <option value="sent">Sent</option>
                                <option value="failed">Failed</option>
                            </select>

                            <select
                                onChange={(e) => handleFilterChange('type', e.target.value)}
                                defaultValue={params.type || 'all'}
                                className="flex h-9 w-[140px] items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option value="all">All Types</option>
                                <option value="transactional">Transactional</option>
                                <option value="campaign">Marketing</option>
                            </select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Sent At</TableHead>
                                    <TableHead>Recipient</TableHead>
                                    <TableHead>Subject</TableHead>
                                    <TableHead>Template / Type</TableHead>
                                    <TableHead>Tenant</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <tbody>
                                {logs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                                            No logs found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    logs.map((log: any) => (
                                        <TableRow key={log.id}>
                                            <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                                                {format(new Date(log.sentAt), "MMM d, HH:mm:ss")}
                                            </TableCell>
                                            <TableCell>{log.recipient}</TableCell>
                                            <TableCell className="max-w-[300px] truncate" title={log.subject}>
                                                {log.subject}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="font-mono text-xs">
                                                    {log.templateId || (log.campaignId ? 'Campaign' : 'Generic')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{log.tenantName || '-'}</TableCell>
                                            <TableCell>
                                                <StatusBadge status={log.status} error={log.error} />
                                                {log.error && <div className="text-xs text-red-500 mt-1 truncate max-w-[200px]" title={log.error}>{log.error}</div>}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <resendFetcher.Form method="post">
                                                    <input type="hidden" name="id" value={log.id} />
                                                    <button
                                                        className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8"
                                                        name="_action"
                                                        value="resend"
                                                        disabled={resendFetcher.state !== 'idle'}
                                                    >
                                                        <Send className="w-3 h-3" />
                                                    </button>
                                                </resendFetcher.Form>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </tbody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-end space-x-2 py-4">
                        <button
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-3"
                            onClick={() => setSearchParams(prev => { prev.set('page', (pagination.page - 1).toString()); return prev; })}
                            disabled={pagination.page <= 1}
                        >
                            Previous
                        </button>
                        <div className="text-sm text-muted-foreground">
                            Page {pagination.page} of {pagination.pages || 1}
                        </div>
                        <button
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-3"
                            onClick={() => setSearchParams(prev => { prev.set('page', (pagination.page + 1).toString()); return prev; })}
                            disabled={pagination.page >= pagination.pages}
                        >
                            Next
                        </button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
