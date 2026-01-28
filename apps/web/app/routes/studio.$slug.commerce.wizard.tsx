import { useState, useMemo, useEffect } from "react";
// @ts-ignore
import { useOutletContext, useNavigate, Link } from "react-router";
import { apiRequest } from "~/utils/api";
import { toast } from "sonner";
import { ArrowLeft, Check, Loader2, Sparkles, Tag, Edit3, ArrowRight } from "lucide-react";

export default function PricingWizard() {
    const { tenant, token } = useOutletContext<any>();
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [step, setStep] = useState<'config' | 'review'>('config');

    // Configuration
    const [basePrice, setBasePrice] = useState<number>(25); // Default Drop-in
    const [selectedTemplates, setSelectedTemplates] = useState<string[]>(['pack_10', 'membership_unlimited']);

    // Review State
    const [customizedItems, setCustomizedItems] = useState<any[]>([]);

    type TemplateItem =
        | { id: string; type: 'pack'; name: string; quantity: number; discount: number; interval?: undefined; multiplier?: undefined }
        | { id: string; type: 'membership'; name: string; interval: 'monthly' | 'annual'; multiplier: number; discount: number; quantity?: undefined };

    const templates: TemplateItem[] = [
        { id: 'pack_3', type: 'pack', name: '3 Class Pack', quantity: 3, discount: 0 },
        { id: 'pack_5', type: 'pack', name: '5 Class Pack', quantity: 5, discount: 0.05 },
        { id: 'pack_10', type: 'pack', name: '10 Class Pack', quantity: 10, discount: 0.10 },
        { id: 'pack_20', type: 'pack', name: '20 Class Pack', quantity: 20, discount: 0.15 },

        { id: 'membership_2x', type: 'membership', name: '2x / Week Membership', interval: 'monthly', multiplier: 8, discount: 0.15 },
        { id: 'membership_3x', type: 'membership', name: '3x / Week Membership', interval: 'monthly', multiplier: 12, discount: 0.20 },
        { id: 'membership_unlimited', type: 'membership', name: 'Unlimited Monthly', interval: 'monthly', multiplier: 15, discount: 0.30 }, // Assumes 15 classes/mo value
        { id: 'membership_unlimited_annual', type: 'membership', name: 'Unlimited Annual', interval: 'annual', multiplier: 180, discount: 0.40 }, // Assumes 15*12
    ];

    const previewItems = useMemo(() => {
        return templates.filter(t => selectedTemplates.includes(t.id)).map(t => {
            let price = 0;
            if (t.type === 'pack') {
                const totalValue = basePrice * t.quantity;
                price = Math.round(totalValue * (1 - t.discount));
            } else {
                const totalValue = basePrice * t.multiplier;
                price = Math.round(totalValue * (1 - t.discount));
            }
            return {
                ...t,
                id: t.id, // Preserve ID for mapping
                calculatedPrice: price
            };
        });
    }, [basePrice, selectedTemplates]);

    const toggleTemplate = (id: string) => {
        if (selectedTemplates.includes(id)) {
            setSelectedTemplates(selectedTemplates.filter(t => t !== id));
        } else {
            setSelectedTemplates([...selectedTemplates, id]);
        }
    };

    const handleReview = () => {
        // Hydrate customizedItems with calculated defaults
        setCustomizedItems(previewItems.map(p => ({
            ...p,
            finalPrice: p.calculatedPrice,
            finalName: p.name
            // We use finalPrice/finalName for editing
        })));
        setStep('review');
    };

    const handleCreate = async () => {
        setIsSubmitting(true);
        try {
            const items = customizedItems.map(item => ({
                type: item.type,
                name: item.finalName,
                price: Math.round(Number(item.finalPrice) * 100), // API expects cents
                credits: item.type === 'pack' ? item.quantity : undefined,
                interval: item.type === 'membership' ? item.interval : undefined
            }));

            const res: any = await apiRequest('/commerce/products/bulk', token, {
                method: 'POST',
                body: JSON.stringify({ items })
            });

            if (res.error) throw new Error(res.error);

            toast.success(`Created ${res.results?.length || 0} pricing options!`);
            navigate(`/studio/${tenant.slug}/commerce/packs`);
        } catch (e: any) {
            toast.error(e.message || "Failed to create products");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Update customized item
    const updateItem = (index: number, key: 'finalPrice' | 'finalName', value: any) => {
        const newItems = [...customizedItems];
        newItems[index] = { ...newItems[index], [key]: value };
        setCustomizedItems(newItems);
    };

    return (
        <div className="max-w-4xl mx-auto py-8">
            <div className="mb-8 flex items-center gap-4">
                <Link to={`/studio/${tenant.slug}/commerce/packs`} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition">
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Sparkles className="text-indigo-500" /> Pricing Wizard
                    </h1>
                    <p className="text-zinc-500">Auto-generate standard pricing options based on your drop-in rate.</p>
                </div>
            </div>

            {step === 'config' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Configuration */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                            <label className="block text-sm font-medium mb-2">Base Drop-in Price ($)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                                <input
                                    type="number"
                                    value={basePrice}
                                    onChange={(e) => setBasePrice(Number(e.target.value))}
                                    className="w-full pl-8 pr-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono text-lg"
                                />
                            </div>
                            <p className="text-xs text-zinc-500 mt-2">
                                We use this to calculate bulk discounts automatically.
                            </p>
                        </div>

                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
                            <h3 className="font-semibold text-indigo-900 dark:text-indigo-200 mb-2 text-sm">Summary</h3>
                            <p className="text-sm text-indigo-700 dark:text-indigo-300 mb-4">
                                You selected <strong>{selectedTemplates.length}</strong> items.
                            </p>
                            <button
                                onClick={handleReview}
                                disabled={selectedTemplates.length === 0}
                                className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                Review & Edit <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Templates */}
                    <div className="lg:col-span-2 space-y-6">
                        <div>
                            <h3 className="font-semibold mb-4 text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                <Tag size={16} /> Class Packs
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                {templates.filter(t => t.type === 'pack').map(t => (
                                    <TemplateCard
                                        key={t.id}
                                        template={t}
                                        selected={selectedTemplates.includes(t.id)}
                                        basePrice={basePrice}
                                        onToggle={() => toggleTemplate(t.id)}
                                    />
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="font-semibold mb-4 text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                <Tag size={16} /> Memberships
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                {templates.filter(t => t.type === 'membership').map(t => (
                                    <TemplateCard
                                        key={t.id}
                                        template={t}
                                        selected={selectedTemplates.includes(t.id)}
                                        basePrice={basePrice}
                                        onToggle={() => toggleTemplate(t.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="max-w-3xl mx-auto">
                    <button onClick={() => setStep('config')} className="mb-6 flex items-center text-sm text-zinc-500 hover:text-zinc-900">
                        <ArrowLeft size={16} className="mr-1" /> Back to Config
                    </button>

                    <h2 className="text-xl font-bold mb-6">Review & Edit Prices</h2>
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden mb-8">
                        <table className="w-full">
                            <thead className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Item Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Details</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 uppercase tracking-wider">Price ($)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                {customizedItems.map((item, idx) => (
                                    <tr key={item.id}>
                                        <td className="px-6 py-4">
                                            <input
                                                type="text"
                                                value={item.finalName}
                                                onChange={(e) => updateItem(idx, 'finalName', e.target.value)}
                                                className="w-full bg-transparent border-b border-transparent focus:border-indigo-500 focus:outline-none px-0 py-1"
                                            />
                                        </td>
                                        <td className="px-6 py-4 text-sm text-zinc-500">
                                            {item.type === 'pack' ? `${item.quantity} Credits` : `Billed ${item.interval}`}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end">
                                                <span className="text-zinc-400 mr-2">$</span>
                                                <input
                                                    type="number"
                                                    value={item.finalPrice}
                                                    onChange={(e) => updateItem(idx, 'finalPrice', e.target.value)}
                                                    className="w-24 text-right bg-zinc-50 dark:bg-zinc-800 border-none rounded px-2 py-1 font-mono focus:ring-1 focus:ring-indigo-500"
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-end gap-4">
                        <button
                            onClick={handleCreate}
                            disabled={isSubmitting}
                            className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl translate-y-0 hover:-translate-y-0.5"
                        >
                            {isSubmitting ? <Loader2 className="animate-spin" /> : <Sparkles size={16} />}
                            Create {customizedItems.length} Products
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function TemplateCard({ template, selected, basePrice, onToggle }: any) {
    // Recalculate preview price
    let price;
    if (template.type === 'pack') {
        const totalValue = basePrice * template.quantity;
        price = Math.round(totalValue * (1 - template.discount));
    } else {
        const totalValue = basePrice * (template.multiplier || 1);
        price = Math.round(totalValue * (1 - template.discount));
    }

    const savings = Math.round(template.discount * 100);

    return (
        <div
            onClick={onToggle}
            className={`cursor-pointer relative p-4 rounded-xl border-2 transition-all ${selected
                ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/10'
                : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900'
                }`}
        >
            <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-sm">{template.name}</h4>
                {selected && (
                    <div className="bg-indigo-600 text-white rounded-full p-0.5">
                        <Check size={12} />
                    </div>
                )}
            </div>

            <div className="text-2xl font-bold font-mono">
                ${price}
            </div>

            {savings > 0 && (
                <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                    Save {savings}% vs Drop-in
                </div>
            )}

            <div className="text-xs text-zinc-400 mt-2">
                {template.type === 'pack' ? `${template.quantity} credits` : `Billed ${template.interval}`}
            </div>
        </div>
    );
}
