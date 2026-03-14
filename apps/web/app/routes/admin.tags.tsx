import { useState } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import { getAuth } from "../utils/auth-wrapper.server";
import { apiRequest } from "../utils/api";
import { useAuth } from "@clerk/react-router";
import { toast } from "sonner";
import { Tag, ToggleLeft, ToggleRight, Building2, Search } from "lucide-react";

export async function loader(args: any) {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    if (!token) return { configs: [], tenants: [], total: 0, error: "Unauthorized" };

    try {
        const [configs, tenantsRes] = await Promise.all([
            apiRequest<any[]>("/admin/platform/config", token),
            apiRequest<{ tenants: any[]; total: number }>("/admin/tenants?limit=500", token),
        ]);
        return {
            configs: configs || [],
            tenants: tenantsRes?.tenants || [],
            total: tenantsRes?.total ?? 0,
            error: null,
        };
    } catch (e: any) {
        return { configs: [], tenants: [], total: 0, error: e.message };
    }
}

export default function AdminTagsPage() {
    const { configs, tenants, error } = useLoaderData<typeof loader>();
    const { getToken } = useAuth();
    const revalidator = useRevalidator();
    const [search, setSearch] = useState("");
    const [updating, setUpdating] = useState<string | null>(null);

    const featureTagsConfig = configs?.find((c: any) => c.key === "feature_tags");
    const platformEnabled = !!featureTagsConfig?.enabled;

    const filteredTenants = (tenants || []).filter(
        (t: any) =>
            t.name?.toLowerCase().includes(search.toLowerCase()) ||
            t.slug?.toLowerCase().includes(search.toLowerCase())
    );

    const togglePlatform = async () => {
        setUpdating("platform");
        try {
            const token = await getToken();
            await apiRequest("/admin/platform/config/feature_tags", token, {
                method: "PUT",
                body: JSON.stringify({
                    enabled: !platformEnabled,
                    description: "Member Tags: allow tenants to use tags, discounts, and tag-restricted classes.",
                }),
            });
            toast.success(`Member Tags feature ${!platformEnabled ? "enabled" : "disabled"} for the platform`);
            revalidator.revalidate();
        } catch (e) {
            toast.error("Failed to update platform setting");
        } finally {
            setUpdating(null);
        }
    };

    const toggleTenantTags = async (tenantId: string, current: boolean) => {
        if (!platformEnabled) {
            toast.error("Enable the platform Member Tags feature first.");
            return;
        }
        setUpdating(tenantId);
        try {
            const token = await getToken();
            await apiRequest(`/admin/tenants/${tenantId}/features`, token, {
                method: "POST",
                body: JSON.stringify({ featureKey: "tags", enabled: !current, source: "manual" }),
            });
            toast.success(`Tags ${!current ? "enabled" : "disabled"} for tenant`);
            revalidator.revalidate();
        } catch (e) {
            toast.error("Failed to update tenant");
        } finally {
            setUpdating(null);
        }
    };

    if (error) {
        return (
            <div className="p-8 text-red-600">
                Error loading: {error}
            </div>
        );
    }

    return (
        <div className="p-8 max-w-4xl">
            <div className="flex items-center gap-2 mb-6">
                <Tag className="w-8 h-8 text-indigo-600" />
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Member Tags</h1>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-8">
                Control the Member Tags feature for the platform and per tenant. When enabled, tenants can define tags
                (e.g. Senior, Silver Sneakers), apply discounts, and create tag-restricted classes.
            </p>

            {/* Platform toggle */}
            <section className="mb-10 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Platform feature</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                    Enable to allow tenants to use member tags, discounts, and tag-restricted classes.
                </p>
                <button
                    type="button"
                    onClick={togglePlatform}
                    disabled={updating === "platform"}
                    className="flex items-center gap-3 px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
                >
                    {platformEnabled ? (
                        <ToggleRight className="w-8 h-8 text-green-600" aria-hidden />
                    ) : (
                        <ToggleLeft className="w-8 h-8 text-zinc-400" aria-hidden />
                    )}
                    <span className="font-medium">
                        Member Tags feature is {platformEnabled ? "on" : "off"}
                    </span>
                </button>
            </section>

            {/* Tenant list */}
            <section>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Tenant enablement</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                    {platformEnabled
                        ? "Turn on Member Tags for each tenant that should see the Tags section in Studio."
                        : "Enable the platform feature above to manage tenant-level Member Tags."}
                </p>
                <div className="mb-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input
                            type="search"
                            placeholder="Search tenants..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm"
                        />
                    </div>
                </div>
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                            <tr>
                                <th className="text-left py-3 px-4 font-medium text-zinc-700 dark:text-zinc-300">Tenant</th>
                                <th className="text-left py-3 px-4 font-medium text-zinc-700 dark:text-zinc-300 w-32">Tags</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                            {filteredTenants.length === 0 ? (
                                <tr>
                                    <td colSpan={2} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                                        No tenants found.
                                    </td>
                                </tr>
                            ) : (
                                filteredTenants.map((t: any) => {
                                    const tagsEnabled = !!t.features?.tags?.enabled;
                                    const isUpdating = updating === t.id;
                                    return (
                                        <tr
                                            key={t.id}
                                            className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                                        >
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="w-4 h-4 text-zinc-400" />
                                                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{t.name}</span>
                                                    <span className="text-zinc-500 dark:text-zinc-400 font-mono text-xs">{t.slug}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleTenantTags(t.id, tagsEnabled)}
                                                    disabled={!platformEnabled || isUpdating}
                                                    className="flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title={!platformEnabled ? "Enable platform feature first" : tagsEnabled ? "Disable Tags" : "Enable Tags"}
                                                >
                                                    {tagsEnabled ? (
                                                        <ToggleRight className="w-6 h-6 text-green-600" aria-hidden />
                                                    ) : (
                                                        <ToggleLeft className="w-6 h-6 text-zinc-400" aria-hidden />
                                                    )}
                                                    <span>{tagsEnabled ? "On" : "Off"}</span>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
