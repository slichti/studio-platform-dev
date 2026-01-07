
// @ts-ignore
import { useLoaderData, useOutletContext } from "react-router";
// @ts-ignore
import type { LoaderFunctionArgs } from "react-router";
import { Check, CreditCard, Sparkles, Tag, AlertCircle } from "lucide-react";

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
    const { slug } = params;
    const API_URL = (import.meta as any).env.VITE_API_URL || "http://localhost:8787";

    try {
        const [packsRes, membershipsRes] = await Promise.all([
            fetch(`${API_URL}/commerce/packs`, { headers: { 'X-Tenant-Slug': slug as string } }),
            fetch(`${API_URL}/contracts/definitions`, { headers: { 'X-Tenant-Slug': slug as string } })
        ]);

        const packsData = packsRes.ok ? await packsRes.json() : { packs: [] };
        const membershipsData = membershipsRes.ok ? await membershipsRes.json() : { definitions: [] };

        return {
            packs: packsData.packs || [],
            memberships: membershipsData.definitions || [],
            error: null
        };
    } catch (e) {
        console.error("Failed to load pricing", e);
        return { packs: [], memberships: [], error: "Could not load pricing." };
    }
};

export default function EmbedPricing() {
    const { packs, memberships, error } = useLoaderData<typeof loader>();
    const { tenant } = useOutletContext<any>() as any;

    const hasData = packs.length > 0 || memberships.length > 0;

    // Default "Example" data if no pricing configured
    const displayPacks = hasData ? packs : [
        { id: 'demo-1', name: 'Drop-in Class', credits: 1, price: 2200, expirationDays: 30 },
        { id: 'demo-2', name: '5-Class Pack', credits: 5, price: 9500, expirationDays: 90 },
        { id: 'demo-3', name: '10-Class Pack', credits: 10, price: 18000, expirationDays: 180 },
    ];

    const displayMemberships = hasData ? memberships : [
        {
            id: 'demo-m1',
            name: 'Monthly Unlimited',
            price: 13500,
            interval: 'month',
            description: 'Unlimited access to all classes. Auto-renews monthly.',
            billingCycles: null
        }
    ];

    const handleBuy = (itemId: string, type: 'pack' | 'membership') => {
        if (!hasData) {
            alert("This is a demo preview. Please configure pricing in your Studio Dashboard.");
            return;
        }
        // Redirect to main studio checkout
        const url = `${window.location.origin}/studio/${tenant.slug}/checkout?${type === 'pack' ? 'packId' : 'membershipId'}=${itemId}`;
        window.open(url, '_blank');
    };

    if (error) {
        return <div className="p-4 text-red-500 text-sm text-center">{error}</div>;
    }

    return (
        <div className="bg-white min-h-[400px] p-4 font-sans text-zinc-900">
            {!hasData && (
                <div className="mb-6 bg-blue-50 text-blue-800 p-3 rounded-lg text-sm flex items-center gap-2 border border-blue-100">
                    <AlertCircle className="w-4 h-4" />
                    <span>No pricing configured yet. Showing example yoga studio pricing based on market averages.</span>
                </div>
            )}

            <div className="space-y-8">
                {/* Memberships Section */}
                <div>
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-amber-500" />
                        Memberships
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {displayMemberships.map((m: any) => (
                            <div key={m.id} className="border border-zinc-200 rounded-xl p-6 hover:shadow-lg transition-shadow bg-white flex flex-col">
                                <div className="mb-4">
                                    <h4 className="font-bold text-xl">{m.name}</h4>
                                    <p className="text-zinc-500 text-sm mt-1">{m.description || 'Recurring membership'}</p>
                                </div>
                                <div className="mt-auto pt-4 border-t border-zinc-100">
                                    <div className="flex justify-between items-end mb-4">
                                        <div>
                                            <span className="text-3xl font-bold">${(m.price / 100).toFixed(0)}</span>
                                            <span className="text-zinc-500 text-sm">/{m.interval === 'month' ? 'mo' : m.interval}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleBuy(m.id, 'membership')}
                                        className="w-full py-2.5 bg-zinc-900 text-white rounded-lg font-medium hover:bg-zinc-800 transition-colors"
                                    >
                                        Select Plan
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Class Packs Section */}
                <div>
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Tag className="w-5 h-5 text-blue-500" />
                        Class Packs
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {displayPacks.map((p: any) => (
                            <div key={p.id} className="border border-zinc-200 rounded-xl p-5 hover:border-zinc-300 transition-colors bg-zinc-50/50">
                                <h4 className="font-semibold text-lg mb-1">{p.name}</h4>
                                <div className="flex items-baseline gap-1 mb-3">
                                    <span className="text-2xl font-bold">${(p.price / 100).toFixed(0)}</span>
                                    <span className="text-zinc-500 text-xs">/ {(p.price / 100 / p.credits).toFixed(0)} per class</span>
                                </div>
                                <ul className="text-sm text-zinc-600 space-y-2 mb-4">
                                    <li className="flex items-center gap-2">
                                        <Check className="w-3 h-3 text-green-600" />
                                        {p.credits} Credits
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <Check className="w-3 h-3 text-green-600" />
                                        Valid for {p.expirationDays || 365} days
                                    </li>
                                </ul>
                                <button
                                    onClick={() => handleBuy(p.id, 'pack')}
                                    className="w-full py-2 border border-zinc-300 bg-white text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-50 transition-colors"
                                >
                                    Purchase
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
