
import { useSubmit, Link, Form, useOutletContext } from "react-router";
import { useState, useEffect } from "react";
import { Settings, Save, MapPin, Plus, Trash2, CreditCard, ShoppingBag, Globe } from "lucide-react";
import { toast } from "sonner";
import { ConfirmationDialog } from "~/components/Dialogs";
import { apiRequest } from "~/utils/api";

const API_URL = typeof window !== 'undefined' ? (window as any).ENV?.API_URL : '';

export default function SettingsIndexComponent({ locations }: { locations: any[] }) {
    const { tenant: initialTenant } = useOutletContext<any>();
    const [tenant, setTenant] = useState(initialTenant);
    const [name, setName] = useState(tenant.name);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Location state
    const [isAddingLocation, setIsAddingLocation] = useState(false);
    const submit = useSubmit();

    const [confirmDeleteLocationId, setConfirmDeleteLocationId] = useState<string | null>(null);

    // BBPOS
    const [showOrderReader, setShowOrderReader] = useState(false);

    const handleOrderReader = async () => {
        // Mock order logic
        toast.success("Your request for a Stripe Terminal Reader (WisePOS E) has been received. Our team will contact you shortly to confirm shipping details.");
        setShowOrderReader(false);
    };

    const handleDeleteLocation = (id: string) => {
        setConfirmDeleteLocationId(id);
    };

    const confirmDeleteLocation = () => {
        if (confirmDeleteLocationId) {
            submit({ intent: "delete_location", id: confirmDeleteLocationId }, { method: "post" });
            setConfirmDeleteLocationId(null);
        }
    };

    return (
        <div className="max-w-4xl pb-10">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Studio Settings</h1>
            </div>

            {/* General Settings */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm mb-8">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">General Information</h2>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="bg-green-50 text-green-600 p-3 rounded mb-4 text-sm">
                        {success}
                    </div>
                )}

                <form
                    onSubmit={async (e) => {
                        e.preventDefault();
                        setLoading(true);
                        setError(null);
                        setSuccess(null);

                        try {
                            const token = await (window as any).Clerk?.session?.getToken();
                            await apiRequest(`/tenant/settings`, token, {
                                method: "PATCH",
                                headers: { 'X-Tenant-Slug': tenant.slug },
                                body: JSON.stringify({ name })
                            });
                            setSuccess("Settings saved successfully");
                        } catch (err: any) {
                            setError(err.message || "Failed to save settings");
                            toast.error(err.message || "Failed to save settings");
                        } finally {
                            setLoading(false);
                        }
                    }}
                >
                    <div className="mb-4">
                        <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                            Studio Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border border-zinc-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Enter studio name"
                        />
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-zinc-900 text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-zinc-800 disabled:opacity-70"
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>

                {/* Logo Upload Section */}
                <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                    <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                        Studio Logo
                    </label>
                    <p className="text-xs text-zinc-400 mb-3">Upload a logo that will appear in the sidebar header. Recommended: 200x200px or larger.</p>
                    <div className="flex items-start gap-4">
                        {/* Current Logo Preview */}
                        <div className="w-20 h-20 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                            {(tenant.branding as any)?.logoUrl ? (
                                <img src={(tenant.branding as any).logoUrl} alt="Studio logo" className="w-full h-full object-contain" />
                            ) : (
                                <span className="text-zinc-400 text-xs text-center px-2">No logo</span>
                            )}
                        </div>
                        {/* Upload Button */}
                        <div className="flex-1">
                            <input
                                type="file"
                                id="logo-upload"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    try {
                                        setLoading(true);
                                        const token = await (window as any).Clerk?.session?.getToken();
                                        const formData = new FormData();
                                        formData.append('file', file);
                                        const response = await fetch(`${API_URL}/uploads/logo`, {
                                            method: 'POST',
                                            headers: {
                                                'Authorization': `Bearer ${token}`,
                                                'X-Tenant-Slug': tenant.slug
                                            },
                                            body: formData
                                        });
                                        const result = await response.json() as any;
                                        if (result.error) throw new Error(result.error);
                                        setSuccess('Logo uploaded successfully');
                                        window.location.reload();
                                    } catch (err: any) {
                                        setError(err.message || 'Failed to upload logo');
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                            />
                            <label
                                htmlFor="logo-upload"
                                className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                            >
                                {loading ? 'Uploading...' : 'Upload Logo'}
                            </label>
                            <p className="text-xs text-zinc-400 mt-1">PNG, JPG or WebP. Max 5MB.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Marketplace Visibility */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm mb-8">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            <Globe className="h-5 w-5 text-blue-500" />
                            Marketplace Discovery
                        </h2>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Allow new students to find your studio in the global app.</p>
                    </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
                    <div>
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">Public Marketplace Listing</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            {tenant.isPublic
                                ? "Your studio is visible in search results."
                                : "Your studio is hidden from search."}
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={tenant.isPublic || false}
                            onChange={async (e) => {
                                const checked = e.target.checked;
                                try {
                                    const token = await (window as any).Clerk?.session?.getToken();
                                    await apiRequest(`/tenant/settings`, token, {
                                        method: "PATCH",
                                        headers: { 'X-Tenant-Slug': tenant.slug },
                                        body: JSON.stringify({ isPublic: checked })
                                    });
                                    window.location.reload();
                                } catch (err) {
                                    toast.error("Failed to update marketplace setting");
                                }
                            }}
                        />
                        <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>
            </div>

            {/* Kiosk Mode Settings */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm mb-8">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            <CreditCard className="h-5 w-5 text-purple-500" />
                            Kiosk Mode
                        </h2>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Enable self-service check-in for your front desk.</p>
                    </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700 mb-4">
                    <div>
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">Enable Kiosk App</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            {tenant.features?.includes('kiosk')
                                ? "Kiosk is active. Access it at /kiosk/your-slug."
                                : "Kiosk is currently disabled."}
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={tenant.features?.includes('kiosk') || false}
                            onChange={async (e) => {
                                const checked = e.target.checked;
                                try {
                                    const token = await (window as any).Clerk?.session?.getToken();
                                    await apiRequest(`/studios/${tenant.id}/features`, token, {
                                        method: "POST",
                                        body: JSON.stringify({ featureKey: 'kiosk', enabled: checked })
                                    });
                                    window.location.reload();
                                } catch (err) {
                                    toast.error("Failed to toggle Kiosk mode");
                                }
                            }}
                        />
                        <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                </div>

                {tenant.features?.includes('kiosk') && (
                    <div className="ml-1 p-4 border border-zinc-100 dark:border-zinc-700 rounded-lg">
                        <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                            Kiosk PIN
                        </label>
                        <div className="flex gap-4 items-center">
                            <input
                                type="text"
                                maxLength={6}
                                defaultValue={tenant.settings?.kioskPin || ''}
                                placeholder="123456"
                                className="w-40 bg-zinc-50 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 rounded text-sm px-3 py-2 text-center tracking-widest font-mono"
                                onBlur={async (e) => {
                                    const val = e.target.value;
                                    if (val.length < 4) return;
                                    try {
                                        const token = await (window as any).Clerk?.session?.getToken();
                                        await apiRequest(`/tenant/settings`, token, {
                                            method: "PATCH",
                                            headers: { 'X-Tenant-Slug': tenant.slug },
                                            body: JSON.stringify({ kioskPin: val })
                                        });
                                        toast.success("Kiosk PIN updated");
                                    } catch (err) {
                                        toast.error("Failed to save PIN");
                                    }
                                }}
                            />
                            <a
                                href={`/kiosk/${tenant.slug}/login`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                            >
                                Open Kiosk App &rarr;
                            </a>
                        </div>
                        <p className="text-xs text-zinc-400 mt-2">
                            This PIN is required to unlock the Kiosk on your tablet. Keep it secret from students.
                        </p>
                    </div>
                )}
            </div>

            {/* Registration Controls */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm mb-8">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Registration</h2>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Control how new students sign up for your studio.</p>
                    </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
                    <div>
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">Public Student Registration</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            {tenant.settings?.enableStudentRegistration
                                ? "Students can create accounts on your public site."
                                : "Only you can add students manually."}
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={tenant.settings?.enableStudentRegistration || false}
                            onChange={async (e) => {
                                const checked = e.target.checked;
                                try {
                                    const token = await (window as any).Clerk?.session?.getToken();
                                    await apiRequest(`/tenant/settings`, token, {
                                        method: "PATCH",
                                        headers: { 'X-Tenant-Slug': tenant.slug },
                                        body: JSON.stringify({ settings: { enableStudentRegistration: checked } })
                                    });
                                    window.location.reload();
                                } catch (err) {
                                    toast.error("Failed to update setting");
                                }
                            }}
                        />
                        <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>
            </div>

            {/* Notification & Automation Preferences */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm mb-8">
                <div className="mb-4">
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Notifications & Automation</h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Manage email alerts and studio automation settings.</p>
                </div>
                <div className="space-y-6">
                    {/* Admin Email Configuration */}
                    <div>
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Admin Notification Email</label>
                        <input
                            type="email"
                            className="w-full border-zinc-300 dark:border-zinc-700 rounded text-sm px-3 py-2 bg-white dark:bg-zinc-800"
                            placeholder="admin@studio.com"
                            defaultValue={tenant.settings?.notifications?.adminEmail || ''}
                            onBlur={async (e) => {
                                const val = e.target.value;
                                const token = await (window as any).Clerk?.session?.getToken();
                                await apiRequest(`/tenant/settings`, token, {
                                    method: "PATCH",
                                    headers: { 'X-Tenant-Slug': tenant.slug },
                                    body: JSON.stringify({ settings: { notifications: { ...tenant.settings?.notifications, adminEmail: val } } })
                                });
                            }}
                        />
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Where should we send system alerts?</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded border border-zinc-200 dark:border-zinc-700">
                            <div>
                                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">New Student Alerts</span>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">Email on registration.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={tenant.settings?.notifications?.newStudentAlert || false}
                                    onChange={async (e) => {
                                        const checked = e.target.checked;
                                        const token = await (window as any).Clerk?.session?.getToken();
                                        await apiRequest(`/tenant/settings`, token, {
                                            method: "PATCH",
                                            headers: { 'X-Tenant-Slug': tenant.slug },
                                            body: JSON.stringify({ settings: { notifications: { ...tenant.settings?.notifications, newStudentAlert: checked } } })
                                        });
                                        window.location.reload();
                                    }}
                                />
                                <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded border border-zinc-200 dark:border-zinc-700">
                            <div>
                                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">BCC on User Emails</span>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">Copy of booking emails.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={tenant.settings?.notifications?.enableBcc || false}
                                    onChange={async (e) => {
                                        const checked = e.target.checked;
                                        const token = await (window as any).Clerk?.session?.getToken();
                                        await apiRequest(`/tenant/settings`, token, {
                                            method: "PATCH",
                                            headers: { 'X-Tenant-Slug': tenant.slug },
                                            body: JSON.stringify({ settings: { notifications: { ...tenant.settings?.notifications, enableBcc: checked } } })
                                        });
                                        window.location.reload();
                                    }}
                                />
                                <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Enable No-Show Fee Automation</span>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">Automatically charge fees for missed classes.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={tenant.settings?.noShowFeeEnabled || false}
                                    onChange={async (e) => {
                                        const checked = e.target.checked;
                                        try {
                                            const token = await (window as any).Clerk?.session?.getToken();
                                            await apiRequest(`/tenant/settings`, token, {
                                                method: "PATCH",
                                                headers: { 'X-Tenant-Slug': tenant.slug },
                                                body: JSON.stringify({ settings: { noShowFeeEnabled: checked } })
                                            });
                                            window.location.reload();
                                        } catch (err) { toast.error("Failed to save"); }
                                    }}
                                />
                                <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>

                        {tenant.settings?.noShowFeeEnabled && (
                            <>
                                <div className="mb-4">
                                    <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Fee Amount ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full border-zinc-300 dark:border-zinc-700 rounded text-sm px-3 py-2 bg-white dark:bg-zinc-800"
                                        placeholder="10.00"
                                        defaultValue={tenant.settings?.noShowFeeAmount ? (tenant.settings.noShowFeeAmount / 100).toFixed(2) : '10.00'}
                                        onBlur={async (e) => {
                                            const val = parseFloat(e.target.value);
                                            if (val > 0) {
                                                const cents = Math.round(val * 100);
                                                const token = await (window as any).Clerk?.session?.getToken();
                                                await apiRequest(`/tenant/settings`, token, {
                                                    method: "PATCH",
                                                    headers: { 'X-Tenant-Slug': tenant.slug },
                                                    body: JSON.stringify({ settings: { noShowFeeAmount: cents } })
                                                });
                                            }
                                        }}
                                    />
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Fee will be charged automatically when marking "No Show".</p>
                                </div>

                                <div className="mb-4 ml-1">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                                            checked={tenant.settings?.notificationSettings?.noShowSms !== false}
                                            onChange={async (e) => {
                                                const checked = e.target.checked;
                                                const token = await (window as any).Clerk?.session?.getToken();
                                                await apiRequest(`/tenant/settings`, token, {
                                                    method: "PATCH",
                                                    headers: { 'X-Tenant-Slug': tenant.slug },
                                                    body: JSON.stringify({ settings: { notificationSettings: { ...tenant.settings?.notificationSettings, noShowSms: checked } } })
                                                });
                                                window.location.reload();
                                            }}
                                        />
                                        <span className="text-sm text-zinc-700 dark:text-zinc-300">Send SMS Alert</span>
                                    </label>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 ml-6 mt-1">Notify student via SMS when charged/marked.</p>
                                </div>
                            </>
                        )}

                        <div className="flex items-center justify-between pb-4">
                            <div>
                                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Auto-Mark No Shows</span>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">Automatically mark expected students as No Show.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={tenant.settings?.noShowAutoMarkEnabled || false}
                                    onChange={async (e) => {
                                        const checked = e.target.checked;
                                        try {
                                            const token = await (window as any).Clerk?.session?.getToken();
                                            await apiRequest(`/tenant/settings`, token, {
                                                method: "PATCH",
                                                headers: { 'X-Tenant-Slug': tenant.slug },
                                                body: JSON.stringify({ settings: { noShowAutoMarkEnabled: checked } })
                                            });
                                            window.location.reload();
                                        } catch (err) { toast.error("Failed to save"); }
                                    }}
                                />
                                <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>

                        {tenant.settings?.noShowAutoMarkEnabled && (
                            <div>
                                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">When to Mark?</label>
                                <select
                                    className="w-full border-zinc-300 dark:border-zinc-700 rounded text-sm px-3 py-2 bg-white dark:bg-zinc-800"
                                    defaultValue={tenant.settings?.noShowAutoMarkTime || 'end_of_class'}
                                    onChange={async (e) => {
                                        const val = e.target.value;
                                        const token = await (window as any).Clerk?.session?.getToken();
                                        await apiRequest(`/tenant/settings`, token, {
                                            method: "PATCH",
                                            headers: { 'X-Tenant-Slug': tenant.slug },
                                            body: JSON.stringify({ settings: { noShowAutoMarkTime: val } })
                                        });
                                    }}
                                >
                                    <option value="start_of_class">Start of Class</option>
                                    <option value="15_mins_after_start">15 Minutes After Start</option>
                                    <option value="end_of_class">End of Class</option>
                                </select>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Class Management Settings */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm mb-8">
                <div className="mb-4">
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Class Management</h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Configure booking windows and cancellation policies.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">Attendance Switch Cutoff</label>
                        <NumberStepper
                            value={tenant.settings?.classSettings?.attendanceSwitchCutoffMinutes || 15}
                            min={0}
                            step={5}
                            suffix="min"
                            onChange={async (val) => {
                                const token = await (window as any).Clerk?.session?.getToken();
                                await apiRequest(`/tenant/settings`, token, {
                                    method: "PATCH",
                                    headers: { 'X-Tenant-Slug': tenant.slug },
                                    body: JSON.stringify({ settings: { classSettings: { ...tenant.settings?.classSettings, attendanceSwitchCutoffMinutes: val } } })
                                });
                            }}
                        />
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">When students can last switch between In-Person and Zoom.</p>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">Cancellation Cutoff</label>
                        <NumberStepper
                            value={tenant.settings?.classSettings?.cancellationCutoffMinutes || 60}
                            min={0}
                            step={15}
                            suffix="min"
                            onChange={async (val) => {
                                const token = await (window as any).Clerk?.session?.getToken();
                                await apiRequest(`/tenant/settings`, token, {
                                    method: "PATCH",
                                    headers: { 'X-Tenant-Slug': tenant.slug },
                                    body: JSON.stringify({ settings: { classSettings: { ...tenant.settings?.classSettings, cancellationCutoffMinutes: val } } })
                                });
                            }}
                        />
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">Latest time a student can cancel without penalty.</p>
                    </div>

                    <div className="md:col-span-2 border-t border-zinc-100 dark:border-zinc-800 pt-4 mt-2">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Auto-Cancel Low Enrollment</span>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">Automatically cancel classes that don't meet minimum enrollment.</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                                        checked={tenant.settings?.classSettings?.defaultAutoCancelEnabled !== false}
                                        onChange={async (e) => {
                                            const checked = e.target.checked;
                                            const token = await (window as any).Clerk?.session?.getToken();
                                            await apiRequest(`/tenant/settings`, token, {
                                                method: "PATCH",
                                                headers: { 'X-Tenant-Slug': tenant.slug },
                                                body: JSON.stringify({ settings: { classSettings: { ...tenant.settings?.classSettings, defaultAutoCancelEnabled: checked } } })
                                            });
                                            window.location.reload();
                                        }}
                                    />
                                    <span className="text-sm text-zinc-700 dark:text-zinc-300">Enable by Default</span>
                                </label>

                                {tenant.settings?.classSettings?.defaultAutoCancelEnabled !== false && (
                                    <div className="flex items-center gap-2">
                                        <NumberStepper
                                            value={tenant.settings?.classSettings?.defaultAutoCancelThresholdHours || 2}
                                            min={1}
                                            step={1}
                                            suffix="hours pre-class"
                                            onChange={async (val) => {
                                                const token = await (window as any).Clerk?.session?.getToken();
                                                await apiRequest(`/tenant/settings`, token, {
                                                    method: "PATCH",
                                                    headers: { 'X-Tenant-Slug': tenant.slug },
                                                    body: JSON.stringify({ settings: { classSettings: { ...tenant.settings?.classSettings, defaultAutoCancelThresholdHours: val } } })
                                                });
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-2 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-4">
                            <div>
                                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Booking Confirmations</span>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">Notify students when they book a class.</p>
                            </div>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                                        checked={tenant.settings?.notificationSettings?.bookingEmail !== false}
                                        onChange={async (e) => {
                                            const checked = e.target.checked;
                                            const token = await (window as any).Clerk?.session?.getToken();
                                            await apiRequest(`/tenant/settings`, token, {
                                                method: "PATCH",
                                                headers: { 'X-Tenant-Slug': tenant.slug },
                                                body: JSON.stringify({ settings: { notificationSettings: { ...tenant.settings?.notificationSettings, bookingEmail: checked } } })
                                            });
                                            window.location.reload();
                                        }}
                                    />
                                    <span className="text-sm text-zinc-700 dark:text-zinc-300">Email</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                                        checked={tenant.settings?.notificationSettings?.bookingSms !== false}
                                        onChange={async (e) => {
                                            const checked = e.target.checked;
                                            const token = await (window as any).Clerk?.session?.getToken();
                                            await apiRequest(`/tenant/settings`, token, {
                                                method: "PATCH",
                                                headers: { 'X-Tenant-Slug': tenant.slug },
                                                body: JSON.stringify({ settings: { notificationSettings: { ...tenant.settings?.notificationSettings, bookingSms: checked } } })
                                            });
                                            window.location.reload();
                                        }}
                                    />
                                    <span className="text-sm text-zinc-700 dark:text-zinc-300">SMS</span>
                                </label>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-4">
                            <div>
                                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Waitlist Promotions</span>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">Notify students when they come off the waitlist.</p>
                            </div>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                                        checked={tenant.settings?.notificationSettings?.waitlistEmail !== false}
                                        onChange={async (e) => {
                                            const checked = e.target.checked;
                                            const token = await (window as any).Clerk?.session?.getToken();
                                            await apiRequest(`/tenant/settings`, token, {
                                                method: "PATCH",
                                                headers: { 'X-Tenant-Slug': tenant.slug },
                                                body: JSON.stringify({ settings: { notificationSettings: { ...tenant.settings?.notificationSettings, waitlistEmail: checked } } })
                                            });
                                            window.location.reload();
                                        }}
                                    />
                                    <span className="text-sm text-zinc-700 dark:text-zinc-300">Email</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                                        checked={tenant.settings?.notificationSettings?.waitlistSms !== false}
                                        onChange={async (e) => {
                                            const checked = e.target.checked;
                                            const token = await (window as any).Clerk?.session?.getToken();
                                            await apiRequest(`/tenant/settings`, token, {
                                                method: "PATCH",
                                                headers: { 'X-Tenant-Slug': tenant.slug },
                                                body: JSON.stringify({ settings: { notificationSettings: { ...tenant.settings?.notificationSettings, waitlistSms: checked } } })
                                            });
                                            window.location.reload();
                                        }}
                                    />
                                    <span className="text-sm text-zinc-700 dark:text-zinc-300">SMS</span>
                                </label>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Cancellation Notifications</span>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">Notify students when you cancel a class.</p>
                            </div>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                                        checked={tenant.settings?.notificationSettings?.cancellationEmail !== false} // Default true
                                        onChange={async (e) => {
                                            const checked = e.target.checked;
                                            const token = await (window as any).Clerk?.session?.getToken();
                                            await apiRequest(`/tenant/settings`, token, {
                                                method: "PATCH",
                                                headers: { 'X-Tenant-Slug': tenant.slug },
                                                body: JSON.stringify({ settings: { notificationSettings: { ...tenant.settings?.notificationSettings, cancellationEmail: checked } } })
                                            });
                                            window.location.reload();
                                        }}
                                    />
                                    <span className="text-sm text-zinc-700 dark:text-zinc-300">Email</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                                        checked={tenant.settings?.notificationSettings?.cancellationSms || false}
                                        onChange={async (e) => {
                                            const checked = e.target.checked;
                                            const token = await (window as any).Clerk?.session?.getToken();
                                            await apiRequest(`/tenant/settings`, token, {
                                                method: "PATCH",
                                                headers: { 'X-Tenant-Slug': tenant.slug },
                                                body: JSON.stringify({ settings: { notificationSettings: { ...tenant.settings?.notificationSettings, cancellationSms: checked } } })
                                            });
                                            window.location.reload();
                                        }}
                                    />
                                    <span className="text-sm text-zinc-700 dark:text-zinc-300">SMS</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>



            {/* Billing & Subscription */}
            <Link to={`/studio/${tenant.slug}/settings/billing`} className="block bg-white border border-zinc-200 rounded-lg p-6 shadow-sm mb-8 hover:border-blue-300 transition-colors group">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-semibold group-hover:text-blue-600 transition-colors">Billing & Subscription</h2>
                        <p className="text-sm text-zinc-500">Manage your plan, payment methods, and view usage.</p>
                    </div>
                    <div className="bg-zinc-100 p-2 rounded-full group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                        <CreditCard className="h-5 w-5" />
                    </div>
                </div>
            </Link>

            {/* Locations */}
            <div className="bg-white border border-zinc-200 rounded-lg p-6 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-semibold">Locations</h2>
                    <button
                        onClick={() => setIsAddingLocation(true)}
                        className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                        <Plus className="h-4 w-4" />
                        Add Location
                    </button>
                </div>

                {
                    isAddingLocation && (
                        <div className="bg-zinc-50 border border-zinc-200 rounded p-4 mb-6">
                            <h3 className="text-sm font-semibold mb-3">New Location</h3>
                            <Form method="post" onSubmit={() => setIsAddingLocation(false)}>
                                <input type="hidden" name="intent" value="create_location" />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-xs text-zinc-500 mb-1">Name</label>
                                        <input name="name" required placeholder="e.g. Main Studio" className="w-full text-sm border-zinc-300 rounded px-3 py-2" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-zinc-500 mb-1">Address (Optional)</label>
                                        <input name="address" placeholder="123 Yoga St" className="w-full text-sm border-zinc-300 rounded px-3 py-2" />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsAddingLocation(false)}
                                        className="px-3 py-1.5 text-xs border border-zinc-300 rounded hover:bg-zinc-100"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                    >
                                        Save Location
                                    </button>
                                </div>
                            </Form>
                        </div>
                    )
                }

                <div className="space-y-3">
                    {locations.length === 0 ? (
                        <div className="text-center py-8 text-zinc-500 text-sm italic">
                            No locations added yet.
                        </div>
                    ) : (
                        locations.map((loc: any) => (
                            <div key={loc.id} className="flex items-center justify-between p-4 border border-zinc-100 rounded hover:bg-zinc-50 transition-colors">
                                <div className="flex items-start gap-3">
                                    <div className="mt-1 p-2 bg-blue-50 text-blue-600 rounded">
                                        <MapPin className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className="font-medium text-zinc-900">{loc.name}</div>
                                        {loc.address && <div className="text-sm text-zinc-500">{loc.address}</div>}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDeleteLocation(loc.id)}
                                    className="text-zinc-400 hover:text-red-600 p-2 rounded hover:bg-zinc-100"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                <ConfirmationDialog
                    isOpen={!!confirmDeleteLocationId}
                    onClose={() => setConfirmDeleteLocationId(null)}
                    onConfirm={confirmDeleteLocation}
                    title="Delete Location"
                    message="Are you sure you want to delete this location? This action cannot be undone."
                    confirmText="Delete"
                    isDestructive
                />

                <Link to={`/studio/${tenant.slug}/settings/domain`} className="block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm mb-8 hover:border-purple-300 transition-colors group">
                    <div className="flex justify-between items-center">
                        <div>
                            <h2 className="text-lg font-semibold dark:text-zinc-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">Custom Domain</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Connect your own website domain (e.g. studio.com). <span className="inline-block bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[10px] px-1.5 py-0.5 rounded ml-2 uppercase font-bold tracking-wider">Scale</span></p>
                        </div>
                        <div className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded-full group-hover:bg-purple-50 dark:group-hover:bg-purple-900/30 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                            <Globe className="h-5 w-5" />
                        </div>
                    </div>
                </Link>

                {showOrderReader && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white w-full max-w-md rounded-2xl p-8 shadow-2xl">
                            <h2 className="text-xl font-bold mb-2">Order BBPOS WisePOS E</h2>
                            <p className="text-sm text-zinc-500 mb-6">Connect your Stripe account to the physical world with a pre-certified card reader. $249/unit.</p>

                            <div className="bg-zinc-50 p-4 rounded-xl mb-6 flex justify-center">
                                <CreditCard size={48} className="text-zinc-300" />
                            </div>

                            <div className="flex gap-4">
                                <button onClick={() => setShowOrderReader(false)} className="flex-1 py-3 font-bold text-zinc-500 hover:bg-zinc-100 rounded-xl">Cancel</button>
                                <button onClick={handleOrderReader} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 flex items-center justify-center gap-2">
                                    <ShoppingBag size={16} /> Place Order
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

interface NumberStepperProps {
    value: number;
    onChange: (val: number) => void;
    min?: number;
    max?: number;
    step?: number;
    suffix?: string;
}

function NumberStepper({
    value,
    onChange,
    min = 0,
    max = 1000,
    step = 1,
    suffix = ''
}: NumberStepperProps) {
    const [localValue, setLocalValue] = useState(value);

    // Sync external changes
    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const handleChange = (val: number) => {
        const clampped = Math.max(min, Math.min(max, val));
        setLocalValue(clampped);
        onChange(clampped);
    };

    return (
        <div className="flex items-center gap-3">
            <button
                type="button"
                onClick={() => handleChange(localValue - step)}
                className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors border border-blue-200"
            >
                <span className="text-lg font-bold leading-none mb-0.5">−</span>
            </button>
            <div className="min-w-[80px] text-center font-mono font-medium text-lg text-zinc-700 dark:text-zinc-200">
                {localValue} <span className="text-xs text-zinc-400 font-sans">{suffix}</span>
            </div>
            <button
                type="button"
                onClick={() => handleChange(localValue + step)}
                className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors border border-blue-200"
            >
                <span className="text-lg font-bold leading-none mb-0.5">+</span>
            </button>
        </div>
    );
}
