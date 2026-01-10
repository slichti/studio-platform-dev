import { useState } from "react";
import { useOutletContext } from "react-router";
import { BarChart3, CreditCard, ShoppingBag, Download } from "lucide-react";
import { API_URL } from "../utils/api";

export default function DataExport() {
    const { tenant } = useOutletContext<any>();
    const [exportLoading, setExportLoading] = useState<string | null>(null);

    const handleExport = async (type: 'subscribers' | 'financials' | 'products') => {
        setExportLoading(type);
        try {
            const token = await (window as any).Clerk?.session?.getToken();
            // Note: Route endpoint is `/tenant/settings/export`?
            // The route in `index.ts` was `studioApp.get('/settings/export', ...)`
            // We should keep using that for now unless we rename the API route too.
            // The route path in `index.ts` is `/settings/export` relative to studioApp.
            // Calls are likely to `/api/v1/tenant/settings/export` or similar.

            const response = await fetch(`${API_URL}/tenant/settings/export?type=${type}`, {
                headers: { 'Authorization': `Bearer ${token}`, 'X-Tenant-Slug': tenant.slug }
            });

            if (!response.ok) throw new Error("Export failed");

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `export_${type}_${tenant.slug}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (e) {
            alert("Export failed. Please try again.");
        } finally {
            setExportLoading(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                <div className="mb-6">
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <Download size={20} className="text-blue-500" />
                        Export Data
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Download your studio data in CSV format for analysis or backup.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                        onClick={() => handleExport('subscribers')}
                        disabled={!!exportLoading}
                        className="group flex flex-col items-center justify-center p-6 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:border-blue-200 dark:hover:border-blue-800 transition-all text-center"
                    >
                        <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <BarChart3 size={24} />
                        </div>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">Subscribers</span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                            {exportLoading === 'subscribers' ? 'Generating CSV...' : 'Active members & history'}
                        </span>
                    </button>

                    <button
                        onClick={() => handleExport('financials')}
                        disabled={!!exportLoading}
                        className="group flex flex-col items-center justify-center p-6 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:border-emerald-200 dark:hover:border-emerald-800 transition-all text-center"
                    >
                        <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <CreditCard size={24} />
                        </div>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">Financials</span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                            {exportLoading === 'financials' ? 'Generating CSV...' : 'Invoices & Transactions'}
                        </span>
                    </button>

                    <button
                        onClick={() => handleExport('products')}
                        disabled={!!exportLoading}
                        className="group flex flex-col items-center justify-center p-6 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:border-purple-200 dark:hover:border-purple-800 transition-all text-center"
                    >
                        <div className="w-12 h-12 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <ShoppingBag size={24} />
                        </div>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">Products</span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                            {exportLoading === 'products' ? 'Generating CSV...' : 'Memberships & Items'}
                        </span>
                    </button>
                </div>
            </div>

            <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg p-4 text-xs text-zinc-500 dark:text-zinc-400">
                <strong>Note:</strong> Exports include sensitive data. Please handle these files securely.
            </div>
        </div>
    );
}
