import { useState, useEffect } from "react";
import { useOutletContext, Link, useRevalidator } from "react-router";
import { apiRequest } from "~/utils/api";
import { useAuth } from "@clerk/react-router";
import { Search, MapPin, Save, Shield } from "lucide-react";
import { toast } from "sonner";

export default function SettingsSEO() {
    const { tenant } = useOutletContext<any>();
    const { getToken } = useAuth();
    const revalidator = useRevalidator();
    const [loading, setLoading] = useState(false);
    const [seoDefaultTitle, setSeoDefaultTitle] = useState("");
    const [seoDefaultDescription, setSeoDefaultDescription] = useState("");
    const [seoLocation, setSeoLocation] = useState("");
    const [robotsDisallowText, setRobotsDisallowText] = useState("");
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        const s = (tenant?.settings as any)?.seo || {};
        setSeoDefaultTitle(s.defaultTitle || "");
        setSeoDefaultDescription(s.defaultDescription || "");
        setSeoLocation(s.location || "");
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
