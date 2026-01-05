
// @ts-ignore
import { useOutletContext } from "react-router";
import { apiRequest } from "../utils/api";
import { useState, useEffect } from "react";
import { useAuth } from "@clerk/react-router";

export default function StudioHardwareSettings() {
    const { tenant } = useOutletContext<any>();
    const { getToken } = useAuth();

    // State
    const [skus, setSkus] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedSku, setSelectedSku] = useState<any>(null);
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

    // Shipping Form
    const [shipping, setShipping] = useState({
        name: tenant.name,
        line1: tenant.address || '',
        city: '',
        state: '',
        postal_code: '',
        country: 'US',
        phone: ''
    });
    const [isOrdering, setIsOrdering] = useState(false);

    useEffect(() => {
        const fetchSkus = async () => {
            const token = await getToken();
            const url = import.meta.env.VITE_API_URL || "https://studio-platform-api.slichti.workers.dev";

            try {
                const res: any = await apiRequest(`${url}/platform/hardware/skus`, token);
                if (res && res.data) {
                    setSkus(res.data);
                }
            } catch (e) {
                console.error("Failed to fetch SKUs", e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchSkus();
    }, [getToken]);

    const handleOrder = async () => {
        if (!selectedSku) return;
        setIsOrdering(true);
        const token = await getToken();
        // Construct the shipping object for Stripe
        const payload = {
            skuId: selectedSku.id,
            quantity: 1,
            shipping: {
                name: shipping.name,
                address: {
                    line1: shipping.line1,
                    city: shipping.city,
                    state: shipping.state,
                    postal_code: shipping.postal_code,
                    country: shipping.country,
                },
                phone: shipping.phone
            }
        };

        const res = await apiRequest(`${import.meta.env.VITE_API_URL}/platform/hardware/orders`, token, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        setIsOrdering(false);
        if (res && !res.error) {
            alert('Order Placed Successfully! You will receive confirmation shortly.');
            setIsOrderModalOpen(false);
        } else {
            alert(`Order Failed: ${res?.error || 'Unknown error'}`);
            // Note: In test mode, we might need a test token or similar.
        }
    };

    return (
        <div className="max-w-4xl text-zinc-900 dark:text-zinc-100">
            <h1 className="text-2xl font-bold mb-6">Hardware & Terminals</h1>
            <p className="text-zinc-500 mb-8 max-w-2xl">
                Purchase Stripe Terminal readers to accept in-person payments fully integrated with your studio.
            </p>

            {/* Order Modal */}
            {isOrderModalOpen && selectedSku && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 w-full max-w-lg p-6 my-8">
                        <h3 className="text-lg font-bold mb-4">Order {selectedSku.product?.name || 'Reader'}</h3>

                        <div className="space-y-4">
                            {/* Product Summary */}
                            <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg flex items-center gap-4">
                                {selectedSku.image && <img src={selectedSku.image} alt="" className="w-12 h-12 object-contain" />}
                                <div>
                                    <div className="font-medium">{selectedSku.product?.name}</div>
                                    <div className="text-sm text-zinc-500">${(selectedSku.price.unit_amount / 100).toFixed(2)}</div>
                                </div>
                            </div>

                            {/* Shipping Form */}
                            <h4 className="font-medium border-b dark:border-zinc-700 pb-2">Shipping Address</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-xs font-medium mb-1">Recipient Name</label>
                                    <input
                                        value={shipping.name}
                                        onChange={e => setShipping({ ...shipping, name: e.target.value })}
                                        className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-md px-3 py-2 text-sm"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-medium mb-1">Address Line 1</label>
                                    <input
                                        value={shipping.line1}
                                        onChange={e => setShipping({ ...shipping, line1: e.target.value })}
                                        className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-md px-3 py-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1">City</label>
                                    <input
                                        value={shipping.city}
                                        onChange={e => setShipping({ ...shipping, city: e.target.value })}
                                        className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-md px-3 py-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1">State</label>
                                    <input
                                        value={shipping.state}
                                        onChange={e => setShipping({ ...shipping, state: e.target.value })}
                                        className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-md px-3 py-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1">Zip Code</label>
                                    <input
                                        value={shipping.postal_code}
                                        onChange={e => setShipping({ ...shipping, postal_code: e.target.value })}
                                        className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-md px-3 py-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium mb-1">Country</label>
                                    <select
                                        value={shipping.country}
                                        onChange={e => setShipping({ ...shipping, country: e.target.value })}
                                        className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-md px-3 py-2 text-sm"
                                    >
                                        <option value="US">United States</option>
                                        <option value="CA">Canada</option>
                                        <option value="GB">United Kingdom</option>
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-medium mb-1">Phone</label>
                                    <input
                                        value={shipping.phone}
                                        onChange={e => setShipping({ ...shipping, phone: e.target.value })}
                                        className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-md px-3 py-2 text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6 justify-end">
                            <button
                                onClick={() => setIsOrderModalOpen(false)}
                                className="px-4 py-2 text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleOrder}
                                disabled={isOrdering}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {isOrdering ? 'Placing Order...' : 'Confirm Purchase'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div>Loading hardware...</div>
            ) : skus.length === 0 ? (
                <div className="p-8 bg-zinc-50 dark:bg-zinc-900 rounded-lg text-center text-zinc-500">
                    No hardware available for purchase at this time.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {skus.map((sku: any) => (
                        <div key={sku.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-sm flex flex-col">
                            <div className="aspect-video bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center p-4">
                                {sku.image ? (
                                    <img src={sku.image} alt={sku.product?.name} className="h-full object-contain" />
                                ) : (
                                    <div className="text-4xl">📠</div>
                                )}
                            </div>
                            <div className="p-6 flex-1 flex flex-col">
                                <h3 className="text-lg font-bold mb-1">{sku.product?.name || 'Terminal Reader'}</h3>
                                <p className="text-sm text-zinc-500 mb-4 flex-1">
                                    {sku.product?.description || 'Accept payments securely with this Stripe Terminal reader.'}
                                </p>
                                <div className="flex items-center justify-between mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-800">
                                    <div className="text-xl font-bold">
                                        ${(sku.price.unit_amount / 100).toFixed(2)}
                                    </div>
                                    <button
                                        onClick={() => { setSelectedSku(sku); setIsOrderModalOpen(true); }}
                                        className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-md text-sm font-medium hover:opacity-90"
                                    >
                                        Buy Now
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
