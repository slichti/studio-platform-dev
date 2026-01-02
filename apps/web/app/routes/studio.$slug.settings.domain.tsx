import { useState, useEffect } from "react";
// @ts-ignore
import { useOutletContext, useLoaderData, Form, useNavigation, Link } from "react-router";
// @ts-ignore
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { apiRequest } from "../utils/api";
import { getAuth } from "@clerk/react-router/server";
import { Globe, ShieldCheck, AlertTriangle, RefreshCw, Trash2, CheckCircle, ExternalLink } from "lucide-react";

export const loader = async (args: LoaderFunctionArgs) => {
    const { params } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();

    try {
        const res = await apiRequest(`/tenant/domain`, token, {
            headers: { 'X-Tenant-Slug': params.slug! }
        });
        return { domainInfo: res };
    } catch (e) {
        return { domainInfo: { domain: null } };
    }
};

export default function DomainSettings() {
    const { tenant } = useOutletContext<any>();
    const { domainInfo } = useLoaderData<{ domainInfo: any }>();
    const [loading, setLoading] = useState(false);
    const [domainInput, setDomainInput] = useState("");
    const [error, setError] = useState<string | null>(null);

    // If tenant is not on Scale plan, show upgrade wall
    if (tenant.tier !== 'scale') {
        return (
            <div className="max-w-4xl mx-auto py-10">
                <div className="mb-8">
                    <Link to={`/studio/${tenant.slug}/settings`} className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 mb-2 inline-block">&larr; Back to Settings</Link>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Custom Domain</h1>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/10 dark:to-zinc-900 border border-purple-100 dark:border-purple-800/30 rounded-xl p-8 text-center max-w-2xl mx-auto shadow-sm">
                    <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Globe className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">Connect Your Own Domain</h2>
                    <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                        Use a custom domain (e.g., <span className="font-mono text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-1 rounded">www.mystudio.com</span>)
                        instead of <span className="font-mono">studio-platform.com</span>. This feature is exclusive to the <strong>Scale</strong> plan.
                    </p>
                    <div className="flex justify-center gap-4">
                        <Link
                            to={`/studio/${tenant.slug}/settings/billing`}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
                        >
                            Upgrade to Scale
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const handleAddDomain = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const token = await (window as any).Clerk?.session?.getToken();
            await apiRequest(`/tenant/domain`, token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': tenant.slug },
                body: JSON.stringify({ domain: domainInput })
            });
            window.location.reload();
        } catch (e: any) {
            setError(e.message || "Failed to add domain.");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteDomain = async () => {
        if (!confirm("Are you sure? This will disconnect your custom domain immediately.")) return;
        setLoading(true);
        try {
            const token = await (window as any).Clerk?.session?.getToken();
            await apiRequest(`/tenant/domain`, token, {
                method: "DELETE",
                headers: { 'X-Tenant-Slug': tenant.slug }
            });
            window.location.reload();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    };

    const hasDomain = !!domainInfo?.domain;

    return (
        <div className="max-w-4xl pb-10">
            <div className="mb-8">
                <Link to={`/studio/${tenant.slug}/settings`} className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 mb-2 inline-block">&larr; Back to Settings</Link>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Custom Domain</h1>
                <p className="text-zinc-500 dark:text-zinc-400 mt-1">Connect your own web address to your studio portal.</p>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 text-sm flex items-start gap-2 border border-red-100">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    {error}
                </div>
            )}

            {!hasDomain ? (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Add a Custom Domain</h2>
                    <form onSubmit={handleAddDomain} className="max-w-md">
                        <div className="mb-4">
                            <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                                Domain Name
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={domainInput}
                                    onChange={(e) => setDomainInput(e.target.value)}
                                    className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="studio.example.com"
                                    disabled={loading}
                                />
                                <button
                                    type="submit"
                                    disabled={loading || !domainInput}
                                    className="bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 px-4 py-2 rounded-md font-medium text-sm hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50"
                                >
                                    {loading ? 'Adding...' : 'Add Domain'}
                                </button>
                            </div>
                            <p className="text-xs text-zinc-500 mt-2">
                                We recommend using a subdomain like <span className="font-mono">app.yourdomain.com</span> or <span className="font-mono">studio.yourdomain.com</span>.
                            </p>
                        </div>
                    </form>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Status Card */}
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm">
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${domainInfo.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
                                    {domainInfo.status === 'active' ? <CheckCircle className="w-6 h-6" /> : <RefreshCw className={`w-6 h-6 ${domainInfo.status !== 'active' ? 'animate-spin-slow' : ''}`} />}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{domainInfo.domain}</h2>
                                    <p className={`text-sm font-medium ${domainInfo.status === 'active' ? 'text-green-600' : 'text-yellow-600'}`}>
                                        {domainInfo.status === 'active' ? 'Active & Secured' : 'Verification Pending'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleDeleteDomain}
                                disabled={loading}
                                className="text-zinc-400 hover:text-red-600 p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                title="Remove Domain"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>

                        {domainInfo.status !== 'active' && (
                            <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 mb-4">
                                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm mb-3">DNS Configuration Required</h3>
                                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                                    To verify ownership and route traffic, please add the following DNS records to your domain provider (e.g. GoDaddy, Namecheap).
                                </p>

                                <div className="space-y-3">
                                    {/* CNAME Record */}
                                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded p-3 text-sm font-mono flex justify-between items-center group">
                                        <div className="flex-1">
                                            <div className="text-xs text-zinc-400 uppercase tracking-wide mb-1">Type</div>
                                            <div className="font-semibold text-zinc-800 dark:text-zinc-200">CNAME</div>
                                        </div>
                                        <div className="flex-[2] border-l border-zinc-100 dark:border-zinc-800 pl-4">
                                            <div className="text-xs text-zinc-400 uppercase tracking-wide mb-1">Name (Host)</div>
                                            <div className="font-semibold text-zinc-800 dark:text-zinc-200">{domainInfo.domain}</div>
                                        </div>
                                        <div className="flex-[3] border-l border-zinc-100 dark:border-zinc-800 pl-4">
                                            <div className="text-xs text-zinc-400 uppercase tracking-wide mb-1">Content (Target)</div>
                                            <div className="font-semibold text-zinc-800 dark:text-zinc-200 break-all">studio-platform-web.pages.dev</div>
                                        </div>
                                    </div>

                                    {/* Cloudflare Validation TXT (if present) */}
                                    {domainInfo.dns_records?.length > 0 && domainInfo.dns_records.map((rec: any, i: number) => (
                                        <div key={i} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded p-3 text-sm font-mono flex justify-between items-center group">
                                            <div className="flex-1">
                                                <div className="text-xs text-zinc-400 uppercase tracking-wide mb-1">Type</div>
                                                <div className="font-semibold text-zinc-800 dark:text-zinc-200">TXT</div>
                                            </div>
                                            <div className="flex-[2] border-l border-zinc-100 dark:border-zinc-800 pl-4">
                                                <div className="text-xs text-zinc-400 uppercase tracking-wide mb-1">Name</div>
                                                <div className="font-semibold text-zinc-800 dark:text-zinc-200">{rec.txt_name || '_cf-custom-hostname'}</div>
                                            </div>
                                            <div className="flex-[3] border-l border-zinc-100 dark:border-zinc-800 pl-4">
                                                <div className="text-xs text-zinc-400 uppercase tracking-wide mb-1">Content</div>
                                                <div className="font-semibold text-zinc-800 dark:text-zinc-200 break-all">{rec.txt_value}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-4 flex justify-end">
                                    <button
                                        onClick={() => window.location.reload()}
                                        className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                    >
                                        <RefreshCw className="w-3 h-3" /> Check Verification Status
                                    </button>
                                </div>
                            </div>
                        )}

                        {domainInfo.status === 'active' && (
                            <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 p-4 rounded-lg flex items-start gap-3">
                                <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-semibold text-sm">SSL Certificate Active</h4>
                                    <p className="text-sm mt-1 opacity-90">Your custom domain is secured with a managed SSL certificate. It may take up to 24 hours for DNS to propagate globally.</p>
                                    <a href={`https://${domainInfo.domain}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-3 text-sm font-medium hover:underline">
                                        Visit {domainInfo.domain} <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

