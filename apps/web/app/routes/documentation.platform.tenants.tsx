
import { useOutletContext, Navigate } from "react-router";
import { Users, CreditCard, ToggleLeft, Activity, ShieldAlert, Smartphone } from "lucide-react";
import { ClientOnly } from "~/components/ClientOnly";
import { MermaidDiagram } from "~/components/MermaidDiagram.client";

const LIFECYCLE_CHART = `flowchart LR
A[Active] -->|pause| P[Paused]
P -->|resume| A
P -->|suspend| S[Suspended]
S -->|resolve| A
A -->|archive| X[Archived]`;

export default function PlatformTenants() {
    const { isPlatformAdmin } = useOutletContext<{ isPlatformAdmin: boolean }>();

    if (!isPlatformAdmin) {
        return <Navigate to="/documentation" replace />;
    }

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 mb-4 font-serif">Tenant Management Guide</h1>
                <p className="text-xl text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-3xl">
                    Detailed instructions for managing studios, billing tiers, and feature flags across the platform.
                </p>
            </div>

            <div className="grid gap-8">
                {/* Onboarding */}
                <section className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-3">
                        <Users className="text-blue-500" /> Tenant Provisioning
                    </h2>
                    <div className="prose dark:prose-invert max-w-none text-zinc-600 dark:text-zinc-400">
                        <p>
                            New tenants are typically created via the self-service signup flow at <code>/create-studio</code>. However, admins can manually provision or modify tenants via the <strong>Tenants</strong> dashboard.
                        </p>
                        <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 mt-4 mb-2">Key Properties</h4>
                        <ul className="grid md:grid-cols-2 gap-4 list-none pl-0">
                            <li className="flex items-start gap-2">
                                <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-sm">slug</span>
                                <span>Unique subdomain identifier (e.g. <code>yoga-studio</code>)</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-sm">ownerId</span>
                                <span>Clerk ID of the primary owner</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-sm">tier</span>
                                <span>Billing tier (Basic, Growth, Scale)</span>
                            </li>
                        </ul>
                    </div>
                </section>

                {/* Feature Flags */}
                <section className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-3">
                        <ToggleLeft className="text-purple-500" /> Feature Gating
                    </h2>
                    <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                        Features can be gated globally (Platform Config) or per-tenant (Tenant Features).
                    </p>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-zinc-50 dark:bg-zinc-800/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700">
                            <h3 className="font-bold text-lg mb-2">Global Flags</h3>
                            <p className="text-sm text-zinc-500 mb-4">Controlled via <code>platformConfig</code>. Affects ALL tenants.</p>
                            <ul className="space-y-1 text-sm font-mono text-zinc-700 dark:text-zinc-300">
                                <li>feature_webhooks</li>
                                <li>feature_beta_ui</li>
                                <li>mobile_maintenance_mode</li>
                                <li>mobile_min_version</li>
                            </ul>
                        </div>
                        <div className="bg-zinc-50 dark:bg-zinc-800/50 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700">
                            <h3 className="font-bold text-lg mb-2">Tenant Flags</h3>
                            <p className="text-sm text-zinc-500 mb-4">Controlled via <code>tenantFeatures</code>.</p>
                            <ul className="space-y-1 text-sm font-mono text-zinc-700 dark:text-zinc-300">
                                <li>financials</li>
                                <li>website_builder</li>
                                <li>mobile_app</li>
                                <li>mobile_access</li>
                                <li>vod_streaming</li>
                            </ul>
                        </div>
                    </div>
                </section>

                {/* Mobile Admin */}
                <section className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-3">
                        <Smartphone className="text-indigo-500" /> Mobile Administration
                    </h2>
                    <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                        The <strong>Admin {" > "} Mobile App</strong> dashboard provides centralized control over the universal platform app.
                    </p>
                    <ul className="space-y-4">
                        <li className="flex gap-4">
                            <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center shrink-0">
                                <ShieldAlert size={18} className="text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div>
                                <h4 className="font-bold text-zinc-900 dark:text-zinc-100">Global Maintenance Mode</h4>
                                <p className="text-sm text-zinc-500">Toggling this instantly blocks all mobile app traffic across every tenant. Use for emergency downtime only.</p>
                            </div>
                        </li>
                        <li className="flex gap-4">
                            <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center shrink-0">
                                <Activity size={18} className="text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div>
                                <h4 className="font-bold text-zinc-900 dark:text-zinc-100">Minimum Version Enforcement</h4>
                                <p className="text-sm text-zinc-500">Forcing a version update will prevent users with older app builds from connecting to the API.</p>
                            </div>
                        </li>
                    </ul>
                </section>

                {/* Billing & Status */}
                <section className="grid md:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-3">
                            <CreditCard className="text-green-500" /> Billing Tiers
                        </h2>
                        <ul className="space-y-4">
                            {[
                                { name: "Basic", desc: "Essential features, limited seats" },
                                { name: "Growth", desc: "Advanced reporting, more seats" },
                                { name: "Scale", desc: "Unlimited seats, dedicated support" }
                            ].map((tier, i) => (
                                <li key={i} className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-2 last:border-0 last:pb-0">
                                    <span className="font-bold truncate">{tier.name}</span>
                                    <span className="text-sm text-zinc-500">{tier.desc}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-3">
                            <Activity className="text-orange-500" /> Lifecycle Status
                        </h2>
                        <ClientOnly fallback={<div className="h-24 flex items-center justify-center text-zinc-500 text-sm">Loading diagram…</div>}>
                            <MermaidDiagram chart={LIFECYCLE_CHART} title="Tenant Lifecycle" />
                        </ClientOnly>
                        <ul className="space-y-3 text-sm mt-4">
                            <li className="flex items-center gap-3">
                                <span className="w-2 h-2 rounded-full bg-green-500" />
                                <strong>Active:</strong> Fully operational.
                            </li>
                            <li className="flex items-center gap-3">
                                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                                <strong>Paused:</strong> Access restricted, data preserved.
                            </li>
                            <li className="flex items-center gap-3">
                                <span className="w-2 h-2 rounded-full bg-red-500" />
                                <strong>Suspended:</strong> Access blocked (billing failure/TOS).
                            </li>
                            <li className="flex items-center gap-3">
                                <span className="w-2 h-2 rounded-full bg-zinc-500" />
                                <strong>Archived:</strong> Scheduled for deletion.
                            </li>
                            <li className="flex items-start gap-3">
                                <span className="w-2 h-2 rounded-full bg-red-600" />
                                <div>
                                    <strong>Panic Switch:</strong> The <code>studentAccessDisabled</code> flag blocks public schedules and guest
                                    flows for the tenant while still allowing authenticated owners/admins (and platform admins) to access
                                    dashboards and billing tools.
                                </div>
                            </li>
                        </ul>
                    </div>
                </section>
            </div>
        </div>
    );
}
