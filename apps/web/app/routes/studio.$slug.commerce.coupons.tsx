// @ts-ignore
import { useLoaderData, useOutletContext } from "react-router";
// @ts-ignore
import type { LoaderFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { useState, useEffect } from "react";
import { Ticket, Plus, Trash2, Tag, AlertCircle, Link as LinkIcon, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { ConfirmationDialog } from "~/components/Dialogs";

export const loader = async (args: LoaderFunctionArgs) => {
    const { params, request } = args;
    const { getToken, userId } = await getAuth(args);
    if (!userId) return { error: "Unauthorized", coupons: [], isStudent: false };

    const token = await getToken();

    // Check if viewing as student (from cookie/session)
    const url = new URL(request.url);
    const isStudentViewHint = url.searchParams.get('view') === 'student';

    try {
        const res: any = await apiRequest("/commerce/coupons", token, {
            headers: { 'X-Tenant-Slug': params.slug! }
        });
        return { coupons: res.coupons || [], error: null, isStudent: false };
    } catch (e: any) {
        // 403 = student trying to access (expected after security fix)
        if (e.message?.includes('403') || e.message?.includes('Access Denied')) {
            return { coupons: [], error: null, isStudent: true };
        }
        return { coupons: [], error: "Failed to load coupons", isStudent: false };
    }
};

export default function CouponsPage() {
    const { coupons: initialCoupons, error, isStudent: apiIsStudent } = useLoaderData<typeof loader>();
    const { tenant, isStudentView } = useOutletContext<any>() || {};

    // Use either API detection or context's isStudentView
    const effectiveStudentView = isStudentView || apiIsStudent;

    if (effectiveStudentView) {
        return <StudentCouponsView tenant={tenant} />;
    }

    return <AdminCouponsView initialCoupons={initialCoupons} tenant={tenant} />;
}

import { useAuth } from "@clerk/react-router";

// Student view: Show saved coupons and allow entering new codes
function StudentCouponsView({ tenant }: any) {
    const [savedCoupons, setSavedCoupons] = useState<any[]>([]);
    const [couponCode, setCouponCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [validationResult, setValidationResult] = useState<any>(null);
    const { getToken } = useAuth();

    // Load saved coupons from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem(`coupons_${tenant?.slug}`);
        if (saved) {
            try {
                setSavedCoupons(JSON.parse(saved));
            } catch { }
        }
        // Also check for pending coupon from URL
        const pending = sessionStorage.getItem('pending_coupon');
        if (pending) {
            setCouponCode(pending);
            handleValidate(pending);
            sessionStorage.removeItem('pending_coupon');
        }
    }, [tenant?.slug]);

    const handleValidate = async (code?: string) => {
        const codeToValidate = code || couponCode;
        if (!codeToValidate.trim()) return;

        setLoading(true);
        setValidationResult(null);

        try {
            const token = await getToken();
            const res: any = await apiRequest(`/commerce/coupons/validate`, token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': tenant.slug },
                body: JSON.stringify({ code: codeToValidate.toUpperCase() })
            });

            if (res.valid) {
                setValidationResult({ valid: true, coupon: res.coupon });
            } else {
                setValidationResult({ valid: false, error: res.error || 'Invalid coupon code' });
            }
        } catch (e: any) {
            setValidationResult({ valid: false, error: e.message || 'Failed to validate coupon' });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveCoupon = () => {
        if (!validationResult?.valid || !validationResult?.coupon) return;

        const coupon = validationResult.coupon;
        const existing = savedCoupons.find(c => c.code === coupon.code);
        if (existing) {
            toast.info('This coupon is already saved');
            return;
        }

        const updated = [...savedCoupons, coupon];
        setSavedCoupons(updated);
        localStorage.setItem(`coupons_${tenant?.slug}`, JSON.stringify(updated));
        setCouponCode('');
        setValidationResult(null);
        toast.success('Coupon saved! It will be applied at checkout.');
    };

    const handleRemoveCoupon = (code: string) => {
        const updated = savedCoupons.filter(c => c.code !== code);
        setSavedCoupons(updated);
        localStorage.setItem(`coupons_${tenant?.slug}`, JSON.stringify(updated));
        toast.success('Coupon removed');
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <div className="mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900/30 rounded-xl flex items-center justify-center">
                        <Tag className="text-pink-600 dark:text-pink-400" size={24} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">My Coupons</h1>
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm">Enter and save discount codes for checkout.</p>
                    </div>
                </div>
            </div>

            {/* Enter Coupon Code Section */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 mb-6 shadow-sm">
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-4">Enter Coupon Code</h3>
                <div className="flex gap-3">
                    <input
                        type="text"
                        className="flex-1 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg px-4 py-3 text-sm font-mono uppercase placeholder:normal-case placeholder:font-sans"
                        placeholder="Enter your coupon code"
                        value={couponCode}
                        onChange={e => {
                            setCouponCode(e.target.value.toUpperCase());
                            setValidationResult(null);
                        }}
                        onKeyDown={e => e.key === 'Enter' && handleValidate()}
                    />
                    <button
                        onClick={() => handleValidate()}
                        disabled={loading || !couponCode.trim()}
                        className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-3 rounded-lg text-sm font-bold hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                    >
                        {loading ? 'Checking...' : 'Apply'}
                    </button>
                </div>

                {/* Validation Result */}
                {validationResult && (
                    <div className={`mt-4 p-4 rounded-lg flex items-center gap-3 ${validationResult.valid
                        ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                        : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                        }`}>
                        {validationResult.valid ? (
                            <>
                                <CheckCircle className="text-green-600 dark:text-green-400" size={20} />
                                <div className="flex-1">
                                    <span className="font-bold text-green-700 dark:text-green-300">Valid coupon!</span>
                                    <span className="ml-2 text-green-600 dark:text-green-400">
                                        {validationResult.coupon.type === 'percent'
                                            ? `${validationResult.coupon.value}% off`
                                            : `$${(validationResult.coupon.value / 100).toFixed(2)} off`}
                                    </span>
                                </div>
                                <button
                                    onClick={handleSaveCoupon}
                                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700"
                                >
                                    Save for Checkout
                                </button>
                            </>
                        ) : (
                            <>
                                <XCircle className="text-red-600 dark:text-red-400" size={20} />
                                <span className="text-red-700 dark:text-red-300">{validationResult.error}</span>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Saved Coupons */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100">Saved Coupons</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">These will be automatically applied at checkout.</p>
                </div>

                {savedCoupons.length === 0 ? (
                    <div className="p-12 text-center text-zinc-400">
                        <Ticket className="mx-auto h-12 w-12 mb-4 opacity-20" />
                        <h3 className="text-zinc-900 dark:text-zinc-100 font-bold mb-1">No Saved Coupons</h3>
                        <p className="text-sm">Enter a coupon code above to save it for checkout.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {savedCoupons.map((coupon: any) => (
                            <div key={coupon.code} className="px-6 py-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded">
                                        {coupon.code}
                                    </span>
                                    {coupon.type === 'percent' ? (
                                        <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded text-xs font-bold">
                                            {coupon.value}% OFF
                                        </span>
                                    ) : (
                                        <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded text-xs font-bold">
                                            ${(coupon.value / 100).toFixed(2)} OFF
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleRemoveCoupon(coupon.code)}
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                    title="Remove"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// Admin view: Full coupon management
function AdminCouponsView({ initialCoupons, tenant }: any) {
    const [coupons, setCoupons] = useState(initialCoupons || []);
    const [loading, setLoading] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [form, setForm] = useState({ code: '', type: 'percent', value: '', usageLimit: '' });
    const [confirmDeactivateId, setConfirmDeactivateId] = useState<string | null>(null);
    const { getToken } = useAuth();

    const fetchCoupons = async () => {
        const token = await getToken();
        const res: any = await apiRequest("/commerce/coupons", token, {
            headers: { 'X-Tenant-Slug': tenant.slug }
        });
        setCoupons(res.coupons || []);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const token = await getToken();
            const res: any = await apiRequest("/commerce/coupons", token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': tenant.slug },
                body: JSON.stringify(form)
            });

            if (res.error) throw new Error(res.error);

            setIsCreateOpen(false);
            setForm({ code: '', type: 'percent', value: '', usageLimit: '' });
            await fetchCoupons();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeactivate = (id: string) => {
        setConfirmDeactivateId(id);
    };

    const confirmDeactivateAction = async () => {
        if (!confirmDeactivateId) return;
        setLoading(true);
        try {
            const token = await getToken();
            await apiRequest(`/commerce/coupons/${confirmDeactivateId}`, token, {
                method: 'DELETE',
                headers: { 'X-Tenant-Slug': tenant.slug }
            });
            await fetchCoupons();
            toast.success("Coupon deactivated");
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setLoading(false);
            setConfirmDeactivateId(null);
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="mb-8 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900/30 rounded-xl flex items-center justify-center">
                        <Tag className="text-pink-600 dark:text-pink-400" size={24} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Coupons</h1>
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm">Manage discounts and promotional codes.</p>
                    </div>
                </div>
                <button
                    onClick={() => setIsCreateOpen(true)}
                    className="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2 rounded-lg text-sm font-bold hover:bg-zinc-800 transition-colors shadow-lg shadow-zinc-500/10 flex items-center gap-2"
                >
                    <Plus size={16} /> New Coupon
                </button>
            </div>

            {/* Create Modal */}
            {isCreateOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl max-w-md w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800">
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">Create Coupon</h3>
                        <form onSubmit={handleCreate}>
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Coupon Code</label>
                                <input
                                    type="text"
                                    className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg px-3 py-2 text-sm font-mono uppercase"
                                    placeholder="e.g. SUMMER25"
                                    value={form.code}
                                    onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Type</label>
                                    <select
                                        className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg px-3 py-2 text-sm"
                                        value={form.type}
                                        onChange={e => setForm({ ...form, type: e.target.value })}
                                    >
                                        <option value="percent">Percentage (%)</option>
                                        <option value="amount">Fixed Amount ($)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Value</label>
                                    <input
                                        type="number"
                                        className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg px-3 py-2 text-sm"
                                        placeholder={form.type === 'percent' ? "e.g. 10" : "e.g. 1000 (cents)"}
                                        value={form.value}
                                        onChange={e => setForm({ ...form, value: e.target.value })}
                                        required
                                        min="1"
                                    />
                                    <p className="text-[10px] text-zinc-400 mt-1">
                                        {form.type === 'amount' ? 'In cents (e.g. 1000 = $10.00)' : 'Percentage value (1-100)'}
                                    </p>
                                </div>
                            </div>
                            <div className="mb-6">
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Usage Limit (Optional)</label>
                                <input
                                    type="number"
                                    className="w-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg px-3 py-2 text-sm"
                                    placeholder="Unlimited"
                                    value={form.usageLimit}
                                    onChange={e => setForm({ ...form, usageLimit: e.target.value })}
                                    min="1"
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-lg text-sm font-bold hover:bg-zinc-800 disabled:opacity-50"
                                >
                                    {loading ? 'Creating...' : 'Create Coupon'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                {coupons.length === 0 ? (
                    <div className="p-12 text-center text-zinc-400">
                        <Tag className="mx-auto h-12 w-12 mb-4 opacity-20" />
                        <h3 className="text-zinc-900 dark:text-zinc-100 font-bold mb-1">No Coupons Yet</h3>
                        <p className="text-sm">Create your first discount code to get started.</p>
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                            <tr>
                                <th className="px-6 py-4 font-bold text-zinc-900 dark:text-zinc-100">Code</th>
                                <th className="px-6 py-4 font-bold text-zinc-900 dark:text-zinc-100">Discount</th>
                                <th className="px-6 py-4 font-bold text-zinc-900 dark:text-zinc-100">Usage Limit</th>
                                <th className="px-6 py-4 font-bold text-zinc-900 dark:text-zinc-100">Status</th>
                                <th className="px-6 py-4 font-bold text-zinc-900 dark:text-zinc-100 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {coupons.map((coupon: any) => (
                                <tr key={coupon.id} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                    <td className="px-6 py-4 font-mono font-bold text-zinc-800 dark:text-zinc-200">
                                        {coupon.code}
                                    </td>
                                    <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">
                                        {coupon.type === 'percent' ? (
                                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">
                                                {coupon.value}% OFF
                                            </span>
                                        ) : (
                                            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs font-bold">
                                                ${(coupon.value / 100).toFixed(2)} OFF
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-zinc-500">
                                        {coupon.usageCount || 0} / {coupon.usageLimit ? coupon.usageLimit : '∞'}
                                    </td>
                                    <td className="px-6 py-4">
                                        {coupon.active ? (
                                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Active
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold bg-zinc-100 text-zinc-500">
                                                Inactive
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {coupon.active && (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        const link = `${window.location.origin}/studio/${tenant.slug}?coupon=${coupon.code}`;
                                                        navigator.clipboard.writeText(link);
                                                        toast.success("Coupon link copied to clipboard!");
                                                    }}
                                                    className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 p-2 rounded-lg transition-colors mr-1"
                                                    title="Copy Coupon Link"
                                                >
                                                    <LinkIcon size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeactivate(coupon.id)}
                                                    disabled={loading}
                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                                    title="Deactivate Coupon"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <ConfirmationDialog
                isOpen={!!confirmDeactivateId}
                onClose={() => setConfirmDeactivateId(null)}
                onConfirm={confirmDeactivateAction}
                title="Deactivate Coupon"
                message="Are you sure you want to deactivate this coupon? This action cannot be undone."
                confirmText="Deactivate"
                isDestructive
            />
        </div>
    );
}

