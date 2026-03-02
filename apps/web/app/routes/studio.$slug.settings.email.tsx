import { useState, useEffect } from "react";
import { useOutletContext, useLoaderData, Link } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { apiRequest } from "../utils/api";
import { getAuth } from "@clerk/react-router/server";
import { Mail, ShieldCheck, AlertTriangle, RefreshCw, Trash2, CheckCircle, ExternalLink, HelpCircle, Copy, Check, Send, Users, Edit3 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmationDialog } from "~/components/Dialogs";
import { ClientOnly } from "~/components/ClientOnly";

export const loader = async (args: LoaderFunctionArgs) => {
    const { params } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();

    try {
        const res = await apiRequest(`/tenant/email-marketing/domain`, token, {
            headers: { 'X-Tenant-Slug': params.slug! }
        });
        return { domainInfo: res };
    } catch (e) {
        return { domainInfo: { domainId: null } };
    }
};

export default function EmailMarketingSettings() {
    const { tenant } = useOutletContext<any>();
    const { domainInfo } = useLoaderData<{ domainInfo: any }>();
    const [loading, setLoading] = useState(false);
    const [domainInput, setDomainInput] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'domain' | 'broadcasts'>('domain');

    // Broadcast state
    const [subject, setSubject] = useState("");
    const [htmlContent, setHtmlContent] = useState("");
    const [fromEmail, setFromEmail] = useState("");

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
        toast.success("Copied to clipboard");
    };

    const handleAddDomain = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const token = await (window as any).Clerk?.session?.getToken();
            await apiRequest(`/tenant/email-marketing/domain`, token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': tenant.slug },
                body: JSON.stringify({ domain: domainInput })
            });
            window.location.reload();
        } catch (e: any) {
            setError(e.message || "Failed to add email domain. Ensure it is a valid root domain.");
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
            await apiRequest(`/tenant/email-marketing/domain`, token, {
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

    const handleVerifyDomain = async () => {
        setLoading(true);
        try {
            const token = await (window as any).Clerk?.session?.getToken();
            await apiRequest(`/tenant/email-marketing/domain/verify`, token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': tenant.slug }
            });
            toast.success("Verification check initiated.");
            setTimeout(() => window.location.reload(), 1500);
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSendBroadcast = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const token = await (window as any).Clerk?.session?.getToken();
            await apiRequest(`/tenant/email-marketing/broadcast`, token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': tenant.slug },
                body: JSON.stringify({ subject, htmlContent, fromEmail })
            });
            toast.success("Broadcast sent successfully!");
            setSubject("");
            setHtmlContent("");
            setFromEmail("");
        } catch (e: any) {
            setError(e.message || "Failed to send broadcast.");
        } finally {
            setLoading(false);
        }
    };

    const hasDomain = !!domainInfo?.domainId;

    return (
        <div className="max-w-5xl mx-auto pb-10 mt-6 px-6">
            <div className="mb-8">
                <Link to={`/studio/${tenant.slug}/settings`} className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 mb-2 inline-block">&larr; Back to Settings</Link>
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <Mail size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Email Marketing</h1>
                        <p className="text-zinc-500 dark:text-zinc-400 mt-1">Manage your custom sender domain and send targeted broadcasts.</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-zinc-200 dark:border-zinc-800 mb-6">
                <button
                    onClick={() => setActiveTab('domain')}
                    className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'domain'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
                        }`}
                >
                    Sender Domain Setup
                </button>
                <button
                    onClick={() => setActiveTab('broadcasts')}
                    className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'broadcasts'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
                        }`}
                >
                    Broadcasts & Audience
                </button>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 text-sm flex items-start gap-2 border border-red-100">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    {error}
                </div>
            )}

            {/* DOMAIN SETUP TAB */}
            {activeTab === 'domain' && (
                <div className="space-y-6">
                    {!hasDomain ? (
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm">
                            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Set up a Sender Domain</h2>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
                                To send email broadcasts, you need to verify ownership of your domain (e.g., <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 rounded">mystudio.com</span>). This improves deliverability and ensures your emails reach your students' inboxes.
                            </p>
                            <form onSubmit={handleAddDomain} className="max-w-md">
                                <div className="mb-4">
                                    <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                                        Root Domain
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={domainInput}
                                            onChange={(e) => setDomainInput(e.target.value)}
                                            className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="example.com"
                                            disabled={loading}
                                        />
                                        <button
                                            type="submit"
                                            disabled={loading || !domainInput}
                                            className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            {loading ? 'Adding...' : 'Add Domain'}
                                        </button>
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-2">
                                        Enter your root domain (do not include www or https://).
                                    </p>
                                </div>
                            </form>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm">
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-full ${domainInfo.status === 'verified' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
                                        {domainInfo.status === 'verified' ? <CheckCircle className="w-6 h-6" /> : <RefreshCw className={`w-6 h-6 ${domainInfo.status !== 'verified' ? 'animate-spin-slow' : ''}`} />}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Sender Domain Active</h2>
                                        <p className={`text-sm font-medium ${domainInfo.status === 'verified' ? 'text-green-600' : 'text-yellow-600'}`}>
                                            {domainInfo.status === 'verified' ? 'Verified & Ready' : 'Verification Pending'}
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

                            {domainInfo.status !== 'verified' && domainInfo.records && (
                                <div className="space-y-6">
                                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-lg p-4">
                                        <h3 className="font-semibold text-blue-900 dark:text-blue-300 text-sm mb-3 flex items-center gap-2">
                                            <HelpCircle className="w-4 h-4" /> DNS Configuration Required
                                        </h3>
                                        <p className="text-sm text-blue-800 dark:text-blue-400 mb-4 font-medium">
                                            Add the following records to your DNS provider to verify ownership and improve deliverability.
                                        </p>

                                        <div className="space-y-3">
                                            {domainInfo.records.map((record: any, idx: number) => (
                                                <div key={idx} className="bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-900 rounded p-3 text-sm font-mono flex flex-col sm:flex-row sm:items-center gap-4">
                                                    <div className="sm:w-20 shrink-0">
                                                        <div className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Type</div>
                                                        <div className="font-bold text-zinc-800 dark:text-zinc-200">{record.type}</div>
                                                    </div>
                                                    <div className="flex-1 min-w-0 border-t sm:border-t-0 sm:border-l border-zinc-100 dark:border-zinc-800 pt-2 sm:pt-0 sm:pl-4 relative group">
                                                        <div className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Name / Host</div>
                                                        <div className="font-bold text-zinc-800 dark:text-zinc-200 truncate pr-8">
                                                            {record.name}
                                                            <button
                                                                onClick={() => handleCopy(record.name, `name-${idx}`)}
                                                                className="absolute right-0 bottom-0 p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                                                            >
                                                                {copied === `name-${idx}` ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="flex-[2] min-w-0 border-t sm:border-t-0 sm:border-l border-zinc-100 dark:border-zinc-800 pt-2 sm:pt-0 sm:pl-4 relative group">
                                                        <div className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Value / Target</div>
                                                        <div className="font-bold text-blue-600 dark:text-blue-400 break-all pr-8">
                                                            {record.value || record.record}
                                                            <button
                                                                onClick={() => handleCopy(record.value || record.record, `value-${idx}`)}
                                                                className="absolute right-0 bottom-0 p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                                                            >
                                                                {copied === `value-${idx}` ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-4 flex flex-col items-center gap-3">
                                        <button
                                            onClick={handleVerifyDomain}
                                            disabled={loading}
                                            className="bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 px-6 py-2.5 rounded-lg font-medium text-sm hover:opacity-90 flex items-center gap-2 shadow-sm transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                                        >
                                            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                                            Verify DNS Records
                                        </button>
                                        <p className="text-[11px] text-zinc-500 text-center max-w-sm">
                                            DNS changes can take up to 24-48 hours to propagate globally. Our system will also automatically check periodically.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {domainInfo.status === 'verified' && (
                                <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 p-6 rounded-lg border border-green-100 dark:border-green-900/30">
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-xl shrink-0">
                                            <ShieldCheck className="w-6 h-6" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-lg">DKIM & SPF Verified</h4>
                                            <p className="text-sm mt-1 opacity-90 leading-relaxed max-w-2xl">
                                                Your domain is fully configured for sending marketing emails. You can now use the Broadcasts tab to send messages to your audiences. You are protected from spoofing and have maximum deliverability.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* BROADCASTS TAB */}
            {activeTab === 'broadcasts' && (
                <div className="space-y-6">
                    {domainInfo?.status !== 'verified' ? (
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-10 text-center flex flex-col items-center justify-center">
                            <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400 mb-4">
                                <Mail size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Sender Domain Required</h3>
                            <p className="text-zinc-500 max-w-md mx-auto mb-6">
                                You must add and verify a custom sender domain before you can send marketing broadcasts. This ensures your emails are delivered reliably.
                            </p>
                            <button
                                onClick={() => setActiveTab('domain')}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
                            >
                                Setup Domain
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* Draft Region */}
                            <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm">
                                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                                    <Edit3 className="w-5 h-5" /> Draft New Broadcast
                                </h2>

                                <form onSubmit={handleSendBroadcast} className="space-y-5">
                                    <div>
                                        <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                                            Sender Email (From)
                                        </label>
                                        <input
                                            type="email"
                                            required
                                            value={fromEmail}
                                            onChange={(e) => setFromEmail(e.target.value)}
                                            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder={`hello@yourdomain.com`}
                                        />
                                        <p className="text-[11px] text-zinc-500 mt-1">Must be an email address on your verified domain.</p>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                                            Subject Line
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={subject}
                                            onChange={(e) => setSubject(e.target.value)}
                                            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="Exciting news from our studio!"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                                            Email Content (HTML)
                                        </label>
                                        <textarea
                                            required
                                            value={htmlContent}
                                            onChange={(e) => setHtmlContent(e.target.value)}
                                            className="w-full h-48 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm resize-y"
                                            placeholder="<h1>Hello!</h1><p>We are thrilled to announce...</p>"
                                        />
                                        <p className="text-[11px] text-zinc-500 mt-1">HTML formatting is supported. A visual builder is arriving soon.</p>
                                    </div>

                                    <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
                                        <button
                                            type="submit"
                                            disabled={loading || !subject || !htmlContent || !fromEmail}
                                            className="bg-blue-600 text-white flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-sm"
                                        >
                                            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                            {loading ? 'Sending...' : 'Send to Newsletter Segment'}
                                        </button>
                                    </div>
                                </form>
                            </div>

                            {/* Stats Region */}
                            <div className="space-y-6">
                                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm">
                                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2 uppercase tracking-wide">
                                        <Users className="w-4 h-4 text-zinc-400" /> Audience Overview
                                    </h3>
                                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                                        When you send a broadcast, it reaches all contacts inside your Resend <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 rounded">Newsletter</span> Segment.
                                    </p>
                                    <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-4 rounded-lg text-sm mb-4 border border-blue-100 dark:border-blue-800/30">
                                        Contacts that unsubscribe or hard-bounce will automatically be suppressed from future broadcasts.
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <ConfirmationDialog
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={confirmDelete}
                title="Disconnect Sender Domain"
                message="Are you sure? This will instantly revoke your API keys and you will no longer be able to send emails from this domain."
                confirmText="Disconnect"
                isDestructive
            />
        </div>
    );
}
