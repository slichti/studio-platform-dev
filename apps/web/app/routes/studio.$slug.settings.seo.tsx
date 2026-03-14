import { useState, useEffect } from "react";
import { useOutletContext, Link, useRevalidator, useParams } from "react-router";
import { apiRequest } from "~/utils/api";
import { useAuth } from "@clerk/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, MapPin, Save, Shield, Globe, Loader2, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function SettingsSEO() {
    const { tenant } = useOutletContext<any>();
    const { slug } = useParams();
    const { getToken } = useAuth();
    const revalidator = useRevalidator();
    const [loading, setLoading] = useState(false);
    const [seoDefaultTitle, setSeoDefaultTitle] = useState("");
    const [seoDefaultDescription, setSeoDefaultDescription] = useState("");
    const [seoLocation, setSeoLocation] = useState("");
    const [googleReviewLink, setGoogleReviewLink] = useState("");
    const [robotsDisallowText, setRobotsDisallowText] = useState("");
    const [initialized, setInitialized] = useState(false);
    const [syncingGbp, setSyncingGbp] = useState(false);
    const [requestingIndex, setRequestingIndex] = useState(false);
    const queryClient = useQueryClient();

    const { data: seoStats, isLoading: seoStatsLoading } = useQuery({
        queryKey: ["analytics", "seo", slug],
        queryFn: async () => {
            const token = await getToken();
            return apiRequest<{ stats: { gbpConnected: boolean; indexingEnabled: boolean } }>(`/analytics/seo`, token, {
                headers: { "X-Tenant-Slug": slug! }
            });
        },
        enabled: !!slug
    });

    useEffect(() => {
        const s = (tenant?.settings as any)?.seo || {};
        setSeoDefaultTitle(s.defaultTitle || "");
        setSeoDefaultDescription(s.defaultDescription || "");
        setSeoLocation(s.location || "");
        setGoogleReviewLink(s.googleReviewLink || "");
        const disallow = s.robotsDisallow;
        setRobotsDisallowText(Array.isArray(disallow) ? disallow.join("\n") : "");
        setInitialized(true);
    }, [tenant?.settings]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        // Safety rail: require at least one of title or description
        if (!seoDefaultTitle.trim() && !seoDefaultDescription.trim()) {
            toast.error("Add at least a search title or description before saving SEO settings.");
            return;
        }
        setLoading(true);
        try {
            const token = await getToken();
            const current = (tenant?.settings as any) || {};
            await apiRequest("/tenant/settings", token, {
                method: "PATCH",
                headers: { "X-Tenant-Slug": tenant.slug },
                body: JSON.stringify({
                    settings: {
                        ...current,
                        seo: {
                            defaultTitle: seoDefaultTitle || undefined,
                            defaultDescription: seoDefaultDescription || undefined,
                            location: seoLocation || undefined,
                            googleReviewLink: googleReviewLink.trim() || undefined,
                            robotsDisallow: robotsDisallowText
                                .split("\n")
                                .map((p) => p.trim())
                                .filter(Boolean)
                                .map((p) => (p.startsWith("/") ? p : `/${p}`)),
                        },
                    },
                }),
            });
            toast.success("SEO settings saved");
            revalidator.revalidate();
        } catch (err: any) {
            toast.error(err.message || "Failed to save");
        } finally {
            setLoading(false);
        }
    };

    if (!initialized) return null;

    const getCity = () => {
        if (tenant.primaryLocation?.address) {
            const parts = tenant.primaryLocation.address.split(',');
            if (parts.length >= 2) {
                // Return second to last part or second part depending on format
                // Usually "Street, City, State ZIP"
                return parts[parts.length - 2].trim();
            }
            return parts[parts.length - 1].trim();
        }
        return tenant.branding?.location?.split(',')[0] || "[City]";
    };

    const city = getCity();
    const businessType = tenant.branding?.businessType || "Yoga Studio";
    const titleTooLong = seoDefaultTitle.length > 60;
    const descriptionTooLong = seoDefaultDescription.length > 155;
    const isSaveDisabled = !seoDefaultTitle.trim() && !seoDefaultDescription.trim();

    return (
        <div className="max-w-2xl pb-10">
            <div className="mb-8">
                <Link to={`/studio/${tenant.slug}/settings`} className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 mb-2 inline-block">← Back to Settings</Link>
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            <Search className="text-blue-500" /> SEO & Discoverability
                        </h1>
                        <p className="text-zinc-600 dark:text-zinc-400 mt-1">Optimize how your studio appears in Google, Maps, and social media.</p>
                    </div>
                    <div className="px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-full">
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter">Locally Optimized</span>
                    </div>
                </div>
            </div>

            <div className="mb-6 p-4 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-800/30 rounded-xl flex gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg h-fit text-blue-600">
                    <Search size={18} />
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Why this matters?</h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 leading-relaxed">
                        97% of people learn more about a local company online than anywhere else. These settings ensure that when someone searches for <strong>"{businessType} in {city}"</strong>, your studio stands out with professional metadata.
                    </p>
                </div>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">Search Result Title</label>
                        <span className={`text-[10px] font-mono ${titleTooLong ? 'text-red-500' : 'text-zinc-400'}`}>
                            {seoDefaultTitle.length}/60
                        </span>
                    </div>
                    <input
                        type="text"
                        value={seoDefaultTitle}
                        onChange={(e) => setSeoDefaultTitle(e.target.value)}
                        placeholder={`${businessType} | Pilates & Fitness in ${city}`}
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-zinc-950"
                        maxLength={70}
                    />
                    <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                        This is the main headline in search results. <strong>Pro Tip:</strong> Place your most important keyword (e.g., {businessType}) first.
                    </p>
                    {titleTooLong && (
                        <p className="text-[11px] text-red-500 mt-1">
                            Titles over ~60 characters may be truncated in Google results. Consider shortening this slightly.
                        </p>
                    )}
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">Search Meta Description</label>
                        <span className={`text-[10px] font-mono ${descriptionTooLong ? 'text-red-500' : 'text-zinc-400'}`}>
                            {seoDefaultDescription.length}/155
                        </span>
                    </div>
                    <textarea
                        value={seoDefaultDescription}
                        onChange={(e) => setSeoDefaultDescription(e.target.value)}
                        placeholder={`Book ${businessType.toLowerCase()} classes in ${city}. High-performance training, memberships, and community insights available.`}
                        rows={3}
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-zinc-950 resize-none"
                        maxLength={160}
                    />
                    <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                        A short summary to entice searchers to click. Include a call-to-action like "Book Today" or "Join our Community."
                    </p>
                    {descriptionTooLong && (
                        <p className="text-[11px] text-red-500 mt-1">
                            Descriptions longer than ~155 characters may be truncated. Focus on the most important benefits first.
                        </p>
                    )}
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                    <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2 flex items-center gap-2">
                        <MapPin className="text-emerald-500" size={18} /> Local Service Area (City)
                    </label>
                    <input
                        type="text"
                        value={seoLocation}
                        onChange={(e) => setSeoLocation(e.target.value)}
                        placeholder={`e.g. ${city}, TX or Brooklyn, NY`}
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-zinc-950"
                    />
                    <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                        Critical for <strong>Google Maps</strong> and local search relevance. Ensure this matches your physical location for best performance.
                    </p>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                    <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2 flex items-center gap-2">
                        <Globe className="text-amber-500" size={18} /> Google Review Link
                    </label>
                    <input
                        type="url"
                        value={googleReviewLink}
                        onChange={(e) => setGoogleReviewLink(e.target.value)}
                        placeholder="https://g.page/your-studio/review or Google Maps review URL"
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-zinc-950"
                    />
                    <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                        Used when requesting reviews (email/SMS) and after class check-in. Get the link from your Google Business Profile → Share review form.
                    </p>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                    <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2 flex items-center gap-2">
                        <Shield className="text-zinc-500" size={18} /> Paths to hide from search engines
                    </label>
                    <textarea
                        value={robotsDisallowText}
                        onChange={(e) => setRobotsDisallowText(e.target.value)}
                        placeholder={"/draft\n/preview\n/private"}
                        rows={3}
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-zinc-950 resize-none font-mono text-sm"
                    />
                    <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                        One path per line (e.g. <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">/draft</code>, <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">/preview</code>). These are added under <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">/studios/{tenant.slug}</code> in the global robots.txt so crawlers do not index them. Leave empty to allow all your studio paths.
                    </p>
                </div>

                {/* Google Business Profile */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                    <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2 flex items-center gap-2">
                        <Globe className="text-blue-500" size={18} /> Google Business Profile
                    </label>
                    <p className="text-xs text-zinc-500 mb-4">Connect your Google Business Profile to sync Name, Address & Phone (NAP) and use review features.</p>
                    {seoStatsLoading ? (
                        <div className="flex items-center gap-2 text-zinc-500"><Loader2 size={16} className="animate-spin" /> Loading…</div>
                    ) : seoStats?.stats?.gbpConnected ? (
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400"><CheckCircle size={16} /> Connected</span>
                            <button
                                type="button"
                                onClick={async () => {
                                    setSyncingGbp(true);
                                    try {
                                        const token = await getToken();
                                        await apiRequest("/studios/gbp-sync", token, { method: "POST", headers: { "X-Tenant-Slug": tenant.slug } });
                                        toast.success("NAP sync requested");
                                    } catch (e: any) {
                                        toast.error(e?.message || "Sync failed");
                                    } finally {
                                        setSyncingGbp(false);
                                    }
                                }}
                                disabled={syncingGbp}
                                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 disabled:opacity-50"
                            >
                                {syncingGbp ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Sync NAP
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    if (!confirm("Disconnect Google Business Profile? You can reconnect later.")) return;
                                    try {
                                        const token = await getToken();
                                        await apiRequest("/tenant/seo", token, {
                                            method: "PATCH",
                                            headers: { "X-Tenant-Slug": tenant.slug },
                                            body: JSON.stringify({ gbpConnected: false })
                                        });
                                        toast.success("Disconnected");
                                        queryClient.invalidateQueries({ queryKey: ["analytics", "seo", slug] });
                                        revalidator.revalidate();
                                    } catch (e: any) {
                                        toast.error(e?.message || "Failed");
                                    }
                                }}
                                className="text-sm text-zinc-500 hover:text-red-500"
                            >
                                Disconnect
                            </button>
                        </div>
                    ) : (
                        <Link
                            to={`/studio/${slug}/settings/seo/connect-gbp`}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                            <Globe size={16} /> Connect Google Business Profile
                        </Link>
                    )}
                </div>

                {/* Google Indexing */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                    <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2 flex items-center gap-2">
                        <Search className="text-indigo-500" size={18} /> Google Indexing
                    </label>
                    <p className="text-xs text-zinc-500 mb-4">Notify Google when your site or key pages change so they can be recrawled faster.</p>
                    {seoStatsLoading ? (
                        <div className="flex items-center gap-2 text-zinc-500"><Loader2 size={16} className="animate-spin" /> Loading…</div>
                    ) : (
                        <div className="space-y-4">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={!!seoStats?.stats?.indexingEnabled}
                                    onChange={async (e) => {
                                        try {
                                            const token = await getToken();
                                            await apiRequest("/tenant/seo", token, {
                                                method: "PATCH",
                                                headers: { "X-Tenant-Slug": tenant.slug },
                                                body: JSON.stringify({ indexingEnabled: e.target.checked })
                                            });
                                            toast.success(e.target.checked ? "Indexing enabled" : "Indexing disabled");
                                            queryClient.invalidateQueries({ queryKey: ["analytics", "seo", slug] });
                                        } catch (err: any) {
                                            toast.error(err?.message || "Failed");
                                        }
                                    }}
                                    className="rounded border-zinc-300 dark:border-zinc-600"
                                />
                                <span className="text-sm">Notify Google when my site or pages change</span>
                            </label>
                            <button
                                type="button"
                                onClick={async () => {
                                    setRequestingIndex(true);
                                    try {
                                        const token = await getToken();
                                        await apiRequest("/tenant/seo/request-index", token, {
                                            method: "POST",
                                            headers: { "X-Tenant-Slug": tenant.slug },
                                            body: JSON.stringify({})
                                        });
                                        toast.success("Homepage queued for indexing");
                                    } catch (e: any) {
                                        toast.error(e?.message || "Request failed");
                                    } finally {
                                        setRequestingIndex(false);
                                    }
                                }}
                                disabled={requestingIndex}
                                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 disabled:opacity-50"
                            >
                                {requestingIndex ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Request index for my homepage
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="submit"
                        disabled={loading || isSaveDisabled}
                        className="flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-70"
                    >
                        <Save size={16} /> {loading ? "Saving…" : "Save SEO Settings"}
                    </button>
                    {isSaveDisabled && (
                        <span className="text-[11px] text-zinc-500">
                            Add a title or description to enable saving.
                        </span>
                    )}
                </div>
            </form>
        </div>
    );
}
