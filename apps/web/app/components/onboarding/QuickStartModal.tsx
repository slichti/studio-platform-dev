import { useState, useEffect } from "react";
import { Modal } from "../Modal"; // Adjust path as needed
import { apiRequest } from "../../utils/api";
import { useRevalidator, useParams, Link } from "react-router";
import { CheckCircle2, ChevronRight, Palette, Calendar, Globe, MapPin, DollarSign, Clock, ArrowRight } from "lucide-react";

interface QuickStartModalProps {
    isOpen: boolean;
    onClose: () => void;
    tenant: any;
    token: string;
}

export function QuickStartModal({ isOpen, onClose, tenant, token }: QuickStartModalProps) {
    const [step, setStep] = useState(1);
    const { slug } = useParams();
    const revalidator = useRevalidator();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: tenant.name,
        timezone: tenant.locations?.[0]?.timezone || 'UTC', // Default to stable value
        currency: tenant.currency || 'usd',
        branding: {
            primaryColor: tenant.branding?.primaryColor || '#2563EB',
        },
        firstClass: {
            title: 'Morning Flow',
            date: '', // Set in useEffect
            time: '09:00',
            duration: 60
        }
    });

    // Hydration Fix: Set client-side defaults
    useEffect(() => {
        const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

        setFormData(prev => ({
            ...prev,
            timezone: tenant.locations?.[0]?.timezone || userTz,
            firstClass: {
                ...prev.firstClass,
                date: today
            }
        }));
    }, []);

    // Top 30 Common Timezones (Better UX than full list)
    const commonTimezones = [
        "UTC", "America/New_York", "America/Los_Angeles", "America/Chicago", "America/Denver",
        "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Tokyo", "Asia/Singapore",
        "Australia/Sydney", "Pacific/Auckland"
    ];
    // Supplement with User's if not in list
    const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timezones = Array.from(new Set([userTz, ...commonTimezones, ...Intl.supportedValuesOf('timeZone')])).sort();

    const currencies = [
        { code: 'usd', label: 'USD ($)' },
        { code: 'eur', label: 'EUR (€)' },
        { code: 'gbp', label: 'GBP (£)' },
        { code: 'aud', label: 'AUD ($)' },
        { code: 'cad', label: 'CAD ($)' },
    ];

    const handleNext = () => setStep(step + 1);

    const handleSubmit = async () => {
        setLoading(true);
        setError(null);
        try {
            // Construct payload
            const startTime = new Date(`${formData.firstClass.date}T${formData.firstClass.time}`);

            const payload = {
                tenantId: tenant.id,
                name: formData.name,
                timezone: formData.timezone,
                currency: formData.currency,
                branding: formData.branding,
                firstClass: {
                    title: formData.firstClass.title,
                    startTime: startTime.toISOString(),
                    duration: Number(formData.firstClass.duration)
                }
            };

            const res = await apiRequest('/onboarding/quick-start', token, {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            if (res.error) throw new Error(res.error);

            // Success
            setStep(3);
            revalidator.revalidate(); // Refresh data in background

        } catch (e: any) {
            setError(e.message || "Something went wrong.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    // Step 3: Success View
    if (step === 3) {
        const publicUrl = `https://${slug}.studio.place`; // Example or use env var
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="Setup Complete!" maxWidth="max-w-lg">
                <div className="text-center py-6 space-y-6">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 size={32} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-zinc-900 mb-2">You're ready to go!</h3>
                        <p className="text-zinc-500">
                            Your studio is set up and your first class is scheduled.
                        </p>
                    </div>

                    <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 text-left">
                        <div className="text-xs font-medium text-zinc-500 uppercase mb-1">Your Public Page</div>
                        <a href={`/portal/${slug}/classes`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline break-all font-mono text-sm">
                            {window.location.origin}/portal/{slug}/classes
                        </a>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-zinc-900 text-white rounded-lg font-medium hover:bg-zinc-800 transition"
                    >
                        Go to Dashboard
                    </button>
                </div>
            </Modal>
        );
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => { /* Prevent closing by backdrop click to encourage completion, or allow it */ }}
            title={step === 1 ? "Studio Basics" : "Schedule First Class"}
            maxWidth="max-w-2xl"
        >
            <div className="space-y-6">
                {/* Progress Indicators */}
                <div className="flex items-center gap-2 mb-6">
                    <div className={`h-2 flex-1 rounded-full ${step >= 1 ? 'bg-blue-600' : 'bg-zinc-100'}`} />
                    <div className={`h-2 flex-1 rounded-full ${step >= 2 ? 'bg-blue-600' : 'bg-zinc-100'}`} />
                    <div className={`h-2 flex-1 rounded-full ${step >= 3 ? 'bg-blue-600' : 'bg-zinc-100'}`} />
                </div>

                {error && (
                    <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">
                        {error}
                    </div>
                )}

                {step === 1 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">Studio Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">Timezone</label>
                                <div className="relative">
                                    <Globe className="absolute left-3 top-2.5 text-zinc-400" size={16} />
                                    <select
                                        value={formData.timezone}
                                        onChange={e => setFormData({ ...formData, timezone: e.target.value })}
                                        className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                    >
                                        {timezones.map(tz => (
                                            <option key={tz} value={tz}>{tz}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">Currency</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-2.5 text-zinc-400" size={16} />
                                    <select
                                        value={formData.currency}
                                        onChange={e => setFormData({ ...formData, currency: e.target.value })}
                                        className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                    >
                                        {currencies.map(c => (
                                            <option key={c.code} value={c.code}>{c.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-zinc-700">Brand Color</label>
                            <div className="p-4 border rounded-lg flex flex-col gap-4 items-center justify-center bg-zinc-50">
                                <div
                                    className="w-24 h-24 rounded-2xl shadow-lg flex items-center justify-center text-white font-bold text-2xl transition-colors"
                                    style={{ backgroundColor: formData.branding.primaryColor }}
                                >
                                    {formData.name.charAt(0)}
                                </div>
                                <input
                                    type="color"
                                    value={formData.branding.primaryColor}
                                    onChange={e => setFormData({ ...formData, branding: { ...formData.branding, primaryColor: e.target.value } })}
                                    className="w-full h-10 cursor-pointer"
                                />
                                <span className="text-xs text-zinc-500 font-mono">{formData.branding.primaryColor}</span>
                            </div>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-6">
                        <div className="bg-blue-50 text-blue-700 p-4 rounded-lg text-sm flex gap-3">
                            <Calendar className="shrink-0" size={20} />
                            <div>
                                <p className="font-semibold">Let's schedule your first class!</p>
                                <p>This will create a class type and add it to your schedule.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-zinc-700 mb-1">Class Title</label>
                                <input
                                    type="text"
                                    value={formData.firstClass.title}
                                    onChange={e => setFormData({ ...formData, firstClass: { ...formData.firstClass, title: e.target.value } })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="e.g. Morning Vinyasa Flow"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">Date</label>
                                <input
                                    type="date"
                                    value={formData.firstClass.date}
                                    onChange={e => setFormData({ ...formData, firstClass: { ...formData.firstClass, date: e.target.value } })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-1">Time</label>
                                <input
                                    type="time"
                                    value={formData.firstClass.time}
                                    onChange={e => setFormData({ ...formData, firstClass: { ...formData.firstClass, time: e.target.value } })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-zinc-700 mb-1">Duration (minutes)</label>
                                <div className="flex items-center gap-4">
                                    {[30, 45, 50, 60, 90, 120].map(mins => (
                                        <button
                                            key={mins}
                                            onClick={() => setFormData({ ...formData, firstClass: { ...formData.firstClass, duration: mins } })}
                                            className={`px-4 py-2 rounded-lg border text-sm font-medium transition ${formData.firstClass.duration === mins
                                                ? 'bg-blue-600 text-white border-blue-600'
                                                : 'bg-white text-zinc-600 hover:bg-zinc-50'
                                                }`}
                                        >
                                            {mins} min
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex justify-between pt-4 border-t mt-6">
                    {step === 2 ? (
                        <button onClick={() => setStep(1)} className="px-4 py-2 text-zinc-600 text-sm font-medium hover:text-zinc-900">
                            Back
                        </button>
                    ) : (
                        <div /> // Spacer
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={async () => {
                                try {
                                    await apiRequest('/onboarding/quick-start/skip', token, {
                                        method: 'POST',
                                        body: JSON.stringify({ tenantId: tenant.id })
                                    });
                                    revalidator.revalidate();
                                    onClose();
                                } catch (e) {
                                    console.error("Failed to skip setup", e);
                                    // Close anyway to not block user
                                    onClose();
                                }
                            }}
                            className="px-4 py-2 text-zinc-500 text-sm hover:text-zinc-700"
                        >
                            Skip Setup
                        </button>
                        <button
                            onClick={step === 1 ? handleNext : handleSubmit}
                            disabled={loading}
                            className="px-6 py-2 bg-zinc-900 text-white rounded-lg font-medium hover:bg-zinc-800 transition flex items-center gap-2 disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : (step === 1 ? 'Next Step' : 'Launch Studio')}
                            {!loading && <ArrowRight size={16} />}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
