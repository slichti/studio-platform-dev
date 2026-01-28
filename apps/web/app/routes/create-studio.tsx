import { useState, useEffect } from "react";
// @ts-ignore
import { Form, useNavigation, useNavigate, Link, useSearchParams } from "react-router";
import { apiRequest } from "../utils/api";
import { useUser, SignedIn, SignedOut, RedirectToSignIn } from "@clerk/react-router";
import { useDebounce } from "~/hooks/useDebounce";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function CreateStudio() {
    const { user, isLoaded } = useUser();
    const navigate = useNavigate();
    const navigation = useNavigation();
    const [searchParams] = useSearchParams();
    const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [tier, setTier] = useState("launch");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Slug Validation State
    const debouncedSlug = useDebounce(slug, 500);
    const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
    const [slugMessage, setSlugMessage] = useState("");

    const [plans, setPlans] = useState<any[]>([]);

    // Fetch Plans
    useEffect(() => {
        async function loadPlans() {
            try {
                // Determine base URL if needed, or rely on apiRequest autodetect (works client side)
                const data = await apiRequest('/public/plans', null);
                if (Array.isArray(data)) {
                    setPlans(data.sort((a, b) => (a.prices.monthly || 0) - (b.prices.monthly || 0)));
                }
            } catch (e) { console.error("Plan load error", e); }
        }
        loadPlans();
    }, []);

    // Initialize tier/interval from URL
    // Initialize tier/interval from URL
    useEffect(() => {
        const tierParam = searchParams.get("tier");
        if (tierParam) {
            setTier(tierParam);
        }
        const intervalParam = searchParams.get("interval");
        if (intervalParam && ['monthly', 'annual'].includes(intervalParam)) {
            setBillingInterval(intervalParam as 'monthly' | 'annual');
        }
    }, [searchParams]);

    // Auto-generate slug from name (only if slug hasn't been manually touched significantly)
    // To keep it simple: only if slug is empty or matches previous auto-gen
    const [manualSlug, setManualSlug] = useState(false);
    useEffect(() => {
        if (!name || manualSlug) return;
        const generated = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
        setSlug(generated);
    }, [name, manualSlug]);

    // Validate Slug Effect
    useEffect(() => {
        if (!debouncedSlug) {
            setSlugStatus('idle');
            setSlugMessage("");
            return;
        }

        async function checkSlug() {
            setSlugStatus('checking');
            try {
                // Check format client-side first
                if (!/^[a-z0-9-]{3,}$/.test(debouncedSlug)) {
                    setSlugStatus('invalid');
                    setSlugMessage("Min 3 chars, letters, numbers, dashes only.");
                    return;
                }

                const token = await (window as any).Clerk?.session?.getToken();
                const res: any = await apiRequest(`/check-slug?slug=${encodeURIComponent(debouncedSlug)}`, token);

                if (res.valid) {
                    setSlugStatus('valid');
                    setSlugMessage("");
                } else {
                    setSlugStatus('invalid');
                    setSlugMessage(res.reason || "Slug is unavailable");
                }
            } catch (e) {
                console.error(e);
                setSlugStatus('idle'); // fail silently or show generic error
            }
        }

        checkSlug();
    }, [debouncedSlug]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (slugStatus === 'invalid' || slugStatus === 'checking') return;

        setLoading(true);
        setError(null);

        try {
            const token = await (window as any).Clerk?.session?.getToken();
            const res: any = await apiRequest('/onboarding/studio', token, {
                method: 'POST',
                body: JSON.stringify({ name, slug, tier, interval: billingInterval })
            });

            if (res.tenant) {
                navigate(`/studio/${res.tenant.slug}/onboarding`);
            } else if (res.error) {
                setError(res.error);
            }
        } catch (err: any) {
            setError(err.message || "Failed to create studio.");
        } finally {
            setLoading(false);
        }
    };



    if (!isLoaded) return <div className="p-10 text-center">Loading...</div>;

    // Check if user is verified
    const isVerified = user?.primaryEmailAddress?.verification?.status === 'verified';

    const billingText = billingInterval === 'annual' ? 'Billed annually' : 'Billed monthly';

    return (
        <main className="min-h-screen bg-zinc-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <SignedOut>
                <RedirectToSignIn />
            </SignedOut>
            <SignedIn>
                <div className="sm:mx-auto sm:w-full sm:max-w-md">
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-zinc-900">
                        Create your Studio
                    </h2>
                    <p className="mt-2 text-center text-sm text-zinc-600">
                        Start managing your classes and students today.
                    </p>
                </div>

                <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                    <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                        {!isVerified && (
                            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        {/* Icon */}
                                        <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm text-yellow-700">
                                            Please verify your email address to create a studio. Check your inbox.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">
                                {error}
                            </div>
                        )}

                        <form className="space-y-6" onSubmit={handleSubmit}>
                            {/* ... inputs ... */}
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-zinc-700">
                                    Studio Name
                                </label>
                                <div className="mt-1">
                                    <input
                                        id="name"
                                        name="name"
                                        type="text"
                                        required
                                        className="appearance-none block w-full px-3 py-2 border border-zinc-300 rounded-md shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                        value={name}
                                        onChange={(e) => {
                                            setName(e.target.value);
                                            setError(null);
                                        }}
                                        placeholder="e.g. Zen Yoga"
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="slug" className="block text-sm font-medium text-zinc-700">
                                    Studio URL (Slug)
                                </label>
                                <div className="mt-1 flex rounded-md shadow-sm relative">
                                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-zinc-300 bg-zinc-50 text-zinc-500 sm:text-sm">
                                        studio.platform.com/
                                    </span>
                                    <input
                                        id="slug"
                                        name="slug"
                                        type="text"
                                        required
                                        className={`flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md border focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${slugStatus === 'invalid' ? 'border-red-300' : 'border-zinc-300'}`}
                                        value={slug}
                                        onChange={(e) => {
                                            setSlug(e.target.value);
                                            setManualSlug(true);
                                            setError(null);
                                        }}
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        {slugStatus === 'checking' && <Loader2 className="animate-spin text-zinc-400" size={16} />}
                                        {slugStatus === 'valid' && <CheckCircle className="text-green-500" size={16} />}
                                        {slugStatus === 'invalid' && <XCircle className="text-red-500" size={16} />}
                                    </div>
                                </div>
                                {slugStatus === 'invalid' && slugMessage && (
                                    <p className="mt-1 text-xs text-red-500">{slugMessage}</p>
                                )}
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-3">
                                    <label className="block text-sm font-medium text-zinc-700">Select Plan</label>
                                    <button
                                        type="button"
                                        onClick={() => setBillingInterval(prev => prev === 'monthly' ? 'annual' : 'monthly')}
                                        className="text-xs text-blue-600 hover:text-blue-500 font-medium"
                                    >
                                        Switch to {billingInterval === 'monthly' ? 'Annual' : 'Monthly'}
                                    </button>
                                </div>

                                {plans.length > 0 ? (
                                    <div className="grid grid-cols-1 gap-4">
                                        {plans.map((plan) => {
                                            const priceCents = billingInterval === 'monthly' ? plan.prices.monthly : plan.prices.annual;
                                            const priceDisplay = priceCents ? `$${priceCents / 100}/${billingInterval === 'monthly' ? 'mo' : 'yr'}` : 'Free';

                                            // Calculate savings safely
                                            let savings = null;
                                            if (billingInterval === 'annual' && plan.prices.monthly && plan.prices.annual) {
                                                const monthlyAnnualized = plan.prices.monthly * 12;
                                                const diff = monthlyAnnualized - plan.prices.annual;
                                                if (diff > 0) savings = `$${diff / 100}`;
                                            }

                                            return (
                                                <div
                                                    key={plan.id}
                                                    onClick={() => setTier(plan.slug)}
                                                    className={`cursor-pointer border rounded-lg p-4 flex items-center justify-between transition-all ${tier === plan.slug ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50' : 'border-zinc-200 hover:border-blue-300'}`}
                                                >
                                                    <div>
                                                        <div className="font-medium text-zinc-900">{plan.name} ({priceDisplay})</div>
                                                        <div className="text-sm text-zinc-500">
                                                            {plan.trialDays > 0 ? `${plan.trialDays}-day free trial.` : 'No trial.'} {billingInterval === 'annual' ? 'Billed annually.' : 'Billed monthly.'}
                                                        </div>
                                                        {savings && (
                                                            <div className="text-xs text-emerald-600 font-medium mt-1">
                                                                Save {savings}/year.
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="h-4 w-4 rounded-full border border-zinc-300 flex items-center justify-center">
                                                        {tier === plan.slug && <div className="h-2 w-2 bg-blue-600 rounded-full" />}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <div className="p-4 border border-dashed border-zinc-300 rounded-lg text-center text-sm text-zinc-500">
                                        Loading plans...
                                    </div>
                                )}
                            </div>

                            <div>
                                <button
                                    type="submit"
                                    disabled={loading || !isVerified || slugStatus === 'invalid' || slugStatus === 'checking'}
                                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-500 disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Creating...' : 'Create Studio'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </SignedIn>
        </main>
    );
}
