import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Download, FileText, AlertCircle } from "lucide-react";
import { apiRequest } from "~/utils/api";

type Invoice = {
    id: string;
    date: number;
    amount: number;
    currency: string;
    status: string;
    pdfUrl: string | null;
    number: string;
    description: string;
};

export function BillingHistory({ token, tenantSlug }: { token: string; tenantSlug: string }) {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        // Include X-Tenant-Slug header for context if needed, though /invoices relies on user auth primarily
        // But multi-tenant usually implies we filter by tenant if Stripe Accounts are separate.
        // commerce.ts uses `c.get('tenant')` to get stripeAccountId, so headers are crucial.
        apiRequest("/commerce/invoices", token, { headers: { 'X-Tenant-Slug': tenantSlug } })
            .then((data) => {
                if (data.invoices) {
                    setInvoices(data.invoices);
                } else {
                    setInvoices([]);
                }
            })
            .catch((err) => {
                console.error("Failed to fetch invoices", err);
                setError("Could not load billing history.");
            })
            .finally(() => setLoading(false));
    }, [token, tenantSlug]);

    if (loading) {
        return (
            <div className="bg-white rounded-lg border border-zinc-200 p-6 animate-pulse">
                <div className="h-6 w-1/3 bg-zinc-100 rounded mb-4"></div>
                <div className="space-y-3">
                    <div className="h-4 w-full bg-zinc-100 rounded"></div>
                    <div className="h-4 w-full bg-zinc-100 rounded"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-lg border border-dashed border-zinc-300 p-8 text-center text-zinc-500">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-400" />
                <p>{error}</p>
            </div>
        );
    }

    if (invoices.length === 0) {
        return (
            <div className="bg-white rounded-lg border border-zinc-200 p-6 text-center text-zinc-500">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No invoices found.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50">
                <h3 className="text-lg font-semibold text-zinc-900">Billing History</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-zinc-500 uppercase bg-zinc-50 border-b border-zinc-100">
                        <tr>
                            <th className="px-6 py-3 font-medium">Date</th>
                            <th className="px-6 py-3 font-medium">Description</th>
                            <th className="px-6 py-3 font-medium">Amount</th>
                            <th className="px-6 py-3 font-medium">Status</th>
                            <th className="px-6 py-3 font-medium text-right">Invoice</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                        {invoices.map((invoice) => (
                            <tr key={invoice.id} className="hover:bg-zinc-50/50 transition-colors">
                                <td className="px-6 py-4 text-zinc-600 space-y-0.5">
                                    <div className="font-medium text-zinc-900">
                                        {format(new Date(invoice.date), "MMM d, yyyy")}
                                    </div>
                                    <div className="text-xs text-zinc-400 font-mono">
                                        {invoice.number}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-zinc-600">
                                    {invoice.description}
                                </td>
                                <td className="px-6 py-4 font-medium text-zinc-900">
                                    {(invoice.amount / 100).toLocaleString("en-US", {
                                        style: "currency",
                                        currency: invoice.currency.toUpperCase(),
                                    })}
                                </td>
                                <td className="px-6 py-4">
                                    <StatusBadge status={invoice.status} />
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {invoice.pdfUrl ? (
                                        <a
                                            href={invoice.pdfUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                            Download
                                        </a>
                                    ) : (
                                        <span className="text-zinc-400 text-xs italic">Not available</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    if (status === 'paid') {
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20">Paid</span>;
    }
    if (status === 'open') {
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-50 text-yellow-800 ring-1 ring-inset ring-yellow-600/20">Due</span>;
    }
    if (status === 'void') {
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-zinc-50 text-zinc-600 ring-1 ring-inset ring-zinc-500/10">Void</span>;
    }
    if (status === 'uncollectible') {
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10">Failed</span>;
    }
    return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">{status}</span>;
}
