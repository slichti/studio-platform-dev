import { useState, useEffect } from "react";
import { useOutletContext, Link, useRevalidator } from "react-router";
import { apiRequest } from "~/utils/api";
import { useAuth } from "@clerk/react-router";
import { Search, MapPin, Save } from "lucide-react";
import { toast } from "sonner";

export default function SettingsSEO() {
    const { tenant } = useOutletContext<any>();
    const { getToken } = useAuth();
    const revalidator = useRevalidator();
    const [loading, setLoading] = useState(false);
    const [seoDefaultTitle, setSeoDefaultTitle] = useState("");
    const [seoDefaultDescription, setSeoDefaultDescription] = useState("");
    const [seoLocation, setSeoLocation] = useState("");
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        const s = (tenant?.settings as any)?.seo || {};
        setSeoDefaultTitle(s.defaultTitle || "");
        setSeoDefaultDescription(s.defaultDescription || "");
        setSeoLocation(s.location || "");
        setInitialized(true);
    }, [tenant?.settings]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
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

    return (
        <div className="max-w-2xl pb-10">
            <div className="mb-8">
                <Link to={`/studio/${tenant.slug}/settings`} className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 mb-2 inline-block">← Back to Settings</Link>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Search className="text-blue-500" /> SEO & Discoverability
                </h1>
                <p className="text-zinc-600 dark:text-zinc-400 mt-1">Help search engines and local searchers find your studio. These defaults apply when individual pages don't have their own meta.</p>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                    <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Default Meta Title</label>
                    <input
                        type="text"
                        value={seoDefaultTitle}
                        onChange={(e) => setSeoDefaultTitle(e.target.value)}
                        placeholder="e.g. Yoga Studio | Pilates & Fitness in Ann Arbor"
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-zinc-950"
                        maxLength={70}
                    />
                    <p className="text-xs text-zinc-500 mt-1">Recommended: under 60 characters. Include your studio name and location.</p>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                    <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Default Meta Description</label>
                    <textarea
                        value={seoDefaultDescription}
                        onChange={(e) => setSeoDefaultDescription(e.target.value)}
                        placeholder="e.g. Book yoga and pilates classes in Ann Arbor. Drop-in, memberships, and class packs available."
                        rows={3}
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-zinc-950 resize-none"
                        maxLength={160}
                    />
                    <p className="text-xs text-zinc-500 mt-1">Recommended: under 160 characters. Describe your studio and offerings.</p>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                    <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2 flex items-center gap-2">
                        <MapPin className="text-emerald-500" /> Location (City / Region)
                    </label>
                    <input
                        type="text"
                        value={seoLocation}
                        onChange={(e) => setSeoLocation(e.target.value)}
                        placeholder="e.g. Ann Arbor, MI or Brooklyn, NY"
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-zinc-950"
                    />
                    <p className="text-xs text-zinc-500 mt-1">Used for local search. Include when people search &quot;yoga studio [city]&quot;.</p>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 rounded-lg font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-70"
                >
                    <Save size={16} /> {loading ? "Saving…" : "Save SEO Settings"}
                </button>
            </form>
        </div>
    );
}
