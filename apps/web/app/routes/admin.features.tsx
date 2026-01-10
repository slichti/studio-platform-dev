
import { useLoaderData, useNavigate } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { useState } from "react";
import { useAuth } from "@clerk/react-router";
import { Smartphone, Video, CreditCard, MessageSquare, Mail, Save } from "lucide-react";

export const loader = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    try {
        const configs = await apiRequest<any[]>("/admin/platform/config", token);
        return { configs, error: null };
    } catch (e: any) {
        return { configs: [], error: e.message };
    }
};

const KNOWN_FEATURES = [
    {
        key: 'feature_mobile_app',
        label: 'White-Label Mobile App',
        description: 'Enable Mobile App settings and promotion across all studios. Keep disabled until apps are approved.',
        icon: Smartphone
    },
    {
        key: 'feature_financials',
        label: 'Financials & Payouts',
        description: 'Global master switch for Financial reporting and Stripe payouts.',
        icon: CreditCard
    },
    {
        key: 'feature_vod',
        label: 'Video on Demand (VOD)',
        description: 'Global master switch for VOD functionality.',
        icon: Video
    },
    {
        key: 'feature_zoom',
        label: 'Zoom Integration',
        description: 'Enable Zoom meeting creation and sync.',
        icon: Video
    },
    {
        key: 'feature_pos',
        label: 'POS & Retail',
        description: 'Enable Point of Sale and Product management.',
        icon: CreditCard
    },
    {
        key: 'feature_sms',
        label: 'SMS Messaging',
        description: 'Enable Twilio SMS features and quotas.',
        icon: MessageSquare
    },
    {
        key: 'feature_marketing',
        label: 'Marketing & CRM',
        description: 'Enable Email Marketing and CRM tools.',
        icon: Mail
    },
    {
        key: 'feature_payroll',
        label: 'Payroll & Compensation',
        description: 'Enable Instructor Payroll and Commission tracking.',
        icon: Save
    }
];

export default function AdminFeatures() {
    const { configs: initialConfigs, error } = useLoaderData<any>();
    const [configs, setConfigs] = useState<any[]>(initialConfigs || []);
    const { getToken } = useAuth();
    const [loading, setLoading] = useState<string | null>(null);

    const getConfig = (key: string) => configs.find(c => c.key === key) || { enabled: false };

    const handleToggle = async (key: string, currentValue: boolean) => {
        setLoading(key);
        // Optimistic update
        setConfigs(prev => {
            const existing = prev.find(c => c.key === key);
            if (existing) {
                return prev.map(c => c.key === key ? { ...c, enabled: !currentValue } : c);
            } else {
                return [...prev, { key, enabled: !currentValue }];
            }
        });

        try {
            const token = await getToken();
            await apiRequest(`/admin/platform/config/${key}`, token, {
                method: 'PUT',
                body: JSON.stringify({
                    enabled: !currentValue,
                    description: KNOWN_FEATURES.find(k => k.key === key)?.description
                })
            });
        } catch (e) {
            console.error(e);
            alert("Failed to update feature flag");
            // Revert
            setConfigs(initialConfigs);
        } finally {
            setLoading(null);
        }
    };

    if (error) return <div className="p-8 text-red-600">Error loading config: {error}</div>;

    return (
        <div className="max-w-4xl mx-auto py-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-zinc-900">Platform Features</h1>
                <p className="text-zinc-500 mt-2">Manage global feature flags. Disabling a feature here hides it from all tenants.</p>
            </div>

            <div className="bg-white rounded-lg border border-zinc-200 divide-y divide-zinc-100 shadow-sm">
                {KNOWN_FEATURES.map(feature => {
                    const config = getConfig(feature.key);
                    const isEnabled = config.enabled;
                    const Icon = feature.icon;

                    return (
                        <div key={feature.key} className="p-4 flex items-center gap-3">
                            <div className={`p-2 rounded-md ${isEnabled ? 'bg-blue-50 text-blue-600' : 'bg-zinc-100 text-zinc-400'}`}>
                                <Icon size={18} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <h3 className="text-sm font-medium text-zinc-900">{feature.label}</h3>
                                        <p className="text-xs text-zinc-500 truncate">{feature.description}</p>
                                    </div>
                                    <button
                                        onClick={() => handleToggle(feature.key, isEnabled)}
                                        disabled={loading === feature.key}
                                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-1 ${isEnabled ? 'bg-blue-600' : 'bg-zinc-200'}`}
                                    >
                                        <span
                                            aria-hidden="true"
                                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isEnabled ? 'translate-x-4' : 'translate-x-0'}`}
                                        />
                                    </button>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${isEnabled ? 'bg-green-100 text-green-800' : 'bg-zinc-100 text-zinc-600'}`}>
                                        {isEnabled ? 'Enabled' : 'Disabled (Hidden)'}
                                    </span>
                                    {config.updatedAt && (
                                        <span className="text-[10px] text-zinc-400">Updated {new Date(config.updatedAt).toLocaleDateString()}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-8 bg-blue-50 border border-blue-100 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">How this works</h4>
                <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
                    <li><strong>Enabled:</strong> Feature is visible to tenants (subject to their subscription tier).</li>
                    <li><strong>Disabled:</strong> Feature is completely hidden from the entire platform. Useful for testing or incomplete features (e.g. Mobile App).</li>
                </ul>
            </div>
        </div>
    );
}
