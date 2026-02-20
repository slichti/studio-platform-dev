import { useState, useEffect } from "react";
import { useOutletContext, useLoaderData, Link } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { apiRequest } from "../utils/api";
import { getAuth } from "@clerk/react-router/server";
import { Globe, ShieldCheck, AlertTriangle, RefreshCw, Trash2, CheckCircle, ExternalLink, HelpCircle, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { ConfirmationDialog } from "~/components/Dialogs";

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
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [copied, setCopied] = useState(false);

    const CNAME_TARGET = "cname.studio-platform.com";

    // If tenant is not on Scale plan, show upgrade wall
    if (tenant.tier !== 'scale' && !tenant.billingExempt) {
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
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        setLoading(true);
        try {
            const token = await (window as any).Clerk?.session?.getToken();
            await apiRequest(`/tenant/domain`, token, {
                method: "DELETE",
                headers: { 'X-Tenant-Slug': tenant.slug }
            });
            window.location.reload();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setLoading(false);
            setShowDeleteConfirm(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(CNAME_TARGET);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success("CNAME target copied to clipboard");
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
                            <div className="space-y-6">
                                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-lg p-4">
                                    <h3 className="font-semibold text-blue-900 dark:text-blue-300 text-sm mb-3 flex items-center gap-2">
                                        <HelpCircle className="w-4 h-4" /> DNS Configuration Required
                                    </h3>
                                    <p className="text-sm text-blue-800 dark:text-blue-400 mb-4 font-medium">
                                        Point your domain to our platform by adding a CNAME record:
                                    </p>

                                    <div className="bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-900 rounded p-3 text-sm font-mono flex justify-between items-center gap-4">
                                        <div className="flex-1">
                                            <div className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Type</div>
                                            <div className="font-bold text-zinc-800 dark:text-zinc-200">CNAME</div>
                                        </div>
                                        <div className="flex-[2] border-l border-zinc-100 dark:border-zinc-800 pl-4">
                                            <div className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Host/Name</div>
                                            <div className="font-bold text-zinc-800 dark:text-zinc-200 break-all">{domainInfo.domain.split('.')[0]}</div>
                                        </div>
                                        <div className="flex-[3] border-l border-zinc-100 dark:border-zinc-800 pl-4 relative group">
                                            <div className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Value/Target</div>
                                            <div className="font-bold text-blue-600 dark:text-blue-400 break-all pr-8">
                                                {CNAME_TARGET}
                                                <button
                                                    onClick={handleCopy}
                                                    className="absolute right-0 bottom-0 p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                                                >
                                                    {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-4">
                                    {/* GoDaddy Instructions */}
                                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                                        <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
                                            <Globe className="w-4 h-4 text-zinc-400" /> GoDaddy Instructions
                                        </h4>
                                        <ol className="text-xs text-zinc-600 dark:text-zinc-400 space-y-2 list-decimal ml-4">
                                            <li>Login to your GoDaddy DNS Management.</li>
                                            <li>Click <strong>Add</strong> to create a new record.</li>
                                            <li>Select <strong>CNAME</strong> as the Type.</li>
                                            <li>Set Name to <strong>{domainInfo.domain.split('.')[0]}</strong>.</li>
                                            <li>Set Value to <strong>{CNAME_TARGET}</strong>.</li>
                                            <li>Set TTL to 1 hour and click Save.</li>
                                        </ol>
                                    </div>

                                    {/* Cloudflare Instructions */}
                                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                                        <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
                                            <ShieldCheck className="w-4 h-4 text-orange-500" /> Cloudflare Instructions
                                        </h4>
                                        <ol className="text-xs text-zinc-600 dark:text-zinc-400 space-y-2 list-decimal ml-4">
                                            <li>Open your DNS tab in Cloudflare.</li>
                                            <li>Add a <strong>CNAME</strong> record for "{domainInfo.domain.split('.')[0]}".</li>
                                            <li>Target: <strong>{CNAME_TARGET}</strong>.</li>
                                            <li><span className="text-orange-600 font-semibold italic">Critical:</span> Set Proxy Status to <strong>DNS Only</strong> (Grey Cloud) during initial verification.</li>
                                            <li>Once active, you can switch to Proxied (Orange Cloud).</li>
                                        </ol>
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-col items-center gap-2">
                                    <button
                                        onClick={() => window.location.reload()}
                                        className="bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 px-6 py-2 rounded-full font-medium text-sm hover:opacity-90 flex items-center gap-2 shadow-lg transition-transform hover:scale-105 active:scale-95"
                                    >
                                        <RefreshCw className="w-4 h-4" /> Check Verification Status
                                    </button>
                                    <p className="text-[10px] text-zinc-400 italic">DNS changes can take up to 24 hours to propagate.</p>
                                </div>
                            </div>
                        )}

                        {domainInfo.status === 'active' && (
                            <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 p-6 rounded-lg border border-green-100 dark:border-green-900/30">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-xl">
                                        <ShieldCheck className="w-6 h-6 shrink-0" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-lg">Your Domain is Secured</h4>
                                        <p className="text-sm mt-1 opacity-90 leading-relaxed">
                                            SSL/TLS is active and your domain is correctly routing to our platform.
                                        </p>
                                        <div className="flex gap-4 mt-6">
                                            <a
                                                href={`https://${domainInfo.domain}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-md transition-all"
                                            >
                                                <ExternalLink className="w-4 h-4" /> Visit Studio
                                            </a>
                                            <button
                                                onClick={() => toast.info("Your SSL certificate is managed and auto-renewed.")}
                                                className="text-green-700 dark:text-green-300 text-sm font-medium hover:underline"
                                            >
                                                Certificate Settings
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <ConfirmationDialog
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={confirmDelete}
                title="Disconnect Domain"
                message="Are you sure? This will disconnect your custom domain immediately. Your studio will revert to the default subdomain."
                confirmText="Disconnect"
                isDestructive
            />
        </div>
    );
}

