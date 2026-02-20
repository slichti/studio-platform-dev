
import { useLoaderData, useNavigate } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { useState } from "react";
import { useAuth } from "@clerk/react-router";
import { toast } from "sonner";
import { Smartphone, Video, CreditCard, MessageSquare, Mail, Save, Globe, MessagesSquare, BookOpen } from "lucide-react";

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
        key: 'feature_website_builder',
        label: 'Website Builder',
        description: 'Enable drag-and-drop website creation for tenants using Puck editor.',
        icon: Globe
    },
    {
        key: 'feature_chat',
        label: 'Chat System',
        description: 'Enable real-time chat for support and community using Durable Objects.',
        icon: MessagesSquare
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
    },
    {
        key: 'feature_course_management',
        label: 'Course Management',
        description: 'Enable standalone Course Management — hybrid curriculum, VOD + live sessions, enrollment, and progress tracking for tenants.',
        icon: BookOpen
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
            console.error(e);
            toast.error("Failed to update feature flag");
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
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Platform Features</h1>
                <p className="text-zinc-500 dark:text-zinc-400 mt-2">Manage global feature flags. Disabling a feature here hides it from all tenants.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {KNOWN_FEATURES.map(feature => {
                    const config = getConfig(feature.key);
                    const isEnabled = config.enabled;
                    const Icon = feature.icon;

                    return (
                        <div key={feature.key} className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 shadow-sm">
                            <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-md flex-shrink-0 ${isEnabled ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500'}`}>
                                    <Icon size={18} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-tight">{feature.label}</h3>
                                        <button
                                            onClick={() => handleToggle(feature.key, isEnabled)}
                                            disabled={loading === feature.key}
                                            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-1 dark:focus:ring-offset-zinc-900 ${isEnabled ? 'bg-blue-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                                        >
                                            <span
                                                aria-hidden="true"
                                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isEnabled ? 'translate-x-4' : 'translate-x-0'}`}
                                            />
                                        </button>
                                    </div>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2">{feature.description}</p>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${isEnabled ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}>
                                            {isEnabled ? 'Enabled' : 'Disabled (Hidden)'}
                                        </span>
                                        {config.updatedAt && (
                                            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Updated {new Date(config.updatedAt).toLocaleDateString()}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">How this works</h4>
                <ul className="list-disc list-inside text-sm text-blue-800 dark:text-blue-300 space-y-1">
                    <li><strong>Enabled:</strong> Feature is visible to tenants (subject to their subscription tier).</li>
                    <li><strong>Disabled:</strong> Feature is completely hidden from the entire platform. Useful for testing or incomplete features (e.g. Mobile App).</li>
                </ul>
            </div>
        </div>
    );
}
