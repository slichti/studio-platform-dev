
import { useState, useEffect } from "react";
import { useOutletContext } from "react-router";
import { apiRequest } from "../../utils/api";
import {
    ShoppingCart,
    Plus,
    Search,
    CreditCard,
    Trash2,
    X,
    User,
    Wifi,
    Archive,
    Edit,
    Loader2
} from "lucide-react";

import { loadStripeTerminal } from "@stripe/terminal-js";

// Types
type Product = {
    id: string;
    name: string;
    description: string;
    price: number;
    currency: string;
    stockQuantity: number;
    category: string;
    imageUrl?: string;
    isActive: boolean;
    stripeProductId?: string;
};

type CartItem = {
    productId: string;
    name: string;
    price: number;
    quantity: number;
};

type Customer = {
    id: string; // memberId or stripeId
    email: string;
    profile?: { firstName: string; lastName: string };
    name?: string; // For stripe guests
    isStripeGuest?: boolean;
    stripeCustomerId?: string;
};

export default function POSPageComponent() {
    const { tenant, token } = useOutletContext<any>() || {};
    const tenantSlug = tenant?.slug;
    const [products, setProducts] = useState<Product[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    // Terminal State
    const [terminal, setTerminal] = useState<any>(null);
    const [terminalStatus, setTerminalStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
    const [readers, setReaders] = useState<any[]>([]);
    const [activeReader, setActiveReader] = useState<any>(null);
    const [showReaderModal, setShowReaderModal] = useState(false);

    // Product Modal
    const [showProductModal, setShowProductModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Customer State
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [showCustomerSearch, setShowCustomerSearch] = useState(false);
    const [customerQuery, setCustomerQuery] = useState("");
    const [customerResults, setCustomerResults] = useState<Customer[]>([]);
    const [searchingCustomer, setSearchingCustomer] = useState(false);
    const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);

    // Coupon State
    const [couponCode, setCouponCode] = useState("");
    const [discountAmount, setDiscountAmount] = useState(0);
    const [couponError, setCouponError] = useState("");
    const [activeCoupon, setActiveCoupon] = useState<{ code: string; id: string } | null>(null);

    // Load Products
    useEffect(() => {
        loadProducts();
    }, [refreshTrigger, tenant]);

    const loadProducts = async () => {
        try {
            const res = await apiRequest('/pos/products', token, { headers: { 'X-Tenant-Slug': tenantSlug } });
            if (res.products) {
                setProducts(res.products.filter((p: Product) => p.isActive));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // --- Stripe Terminal Setup ---
    useEffect(() => {
        if (!tenant) return;

        const initTerminal = async () => {
            const StripeTerminal = await loadStripeTerminal();
            if (!StripeTerminal) return;

            const t = StripeTerminal.create({
                onFetchConnectionToken: async () => {
                    const res = await apiRequest('/pos/connection-token', token, { method: 'POST', headers: { 'X-Tenant-Slug': tenantSlug } });
                    if (res.error) throw new Error(res.error);
                    return res.secret;
                },
                onUnexpectedReaderDisconnect: () => {
                    setTerminalStatus('disconnected');
                    setActiveReader(null);
                }
            });
            setTerminal(t);
        };

        initTerminal();
    }, [tenant]);

    const handleConnectReader = async (reader: any) => {
        setTerminalStatus('connecting');
        try {
            const result = await terminal.connectReader(reader);
            if (result.reader) {
                setActiveReader(result.reader);
                setTerminalStatus('connected');
                setShowReaderModal(false);
            } else {
                console.error("Connect failed", result.error);
                setTerminalStatus('disconnected');
            }
        } catch (e) {
            console.error("Connect error", e);
            setTerminalStatus('disconnected');
        }
    };

    // --- Cart Logic ---
    const addToCart = (product: Product) => {
        setCart(prev => {
            const existing = prev.find(p => p.productId === product.id);
            if (existing) {
                return prev.map(p => p.productId === product.id ? { ...p, quantity: p.quantity + 1 } : p);
            }
            return [...prev, { productId: product.id, name: product.name, price: product.price, quantity: 1 }];
        });
    };

    const removeFromCart = (productId: string) => {
        setCart(prev => prev.filter(p => p.productId !== productId));
    };

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const total = Math.max(0, subtotal - discountAmount);

    // Coupon Handler
    const handleApplyCoupon = async () => {
        if (!couponCode) return;
        setProcessing(true);
        setCouponError("");
        try {
            const res = await apiRequest('/pos/validate-coupon', token, {
                headers: { 'X-Tenant-Slug': tenantSlug },
                method: 'POST',
                body: JSON.stringify({ code: couponCode, cartTotal: subtotal })
            });

            if (res.valid) {
                setDiscountAmount(res.discountAmount);
                setActiveCoupon({ code: couponCode, id: res.couponId });
                setCouponError("");
            } else {
                setCouponError(res.error || "Invalid coupon");
                setDiscountAmount(0);
                setActiveCoupon(null);
            }
        } catch (e: any) {
            setCouponError(e.message);
        } finally {
            setProcessing(false);
        }
    };

    useEffect(() => {
        if (cart.length === 0) {
            setDiscountAmount(0);
            setActiveCoupon(null);
            setCouponCode("");
        } else if (activeCoupon) {
            handleApplyCoupon();
        }
    }, [cart.length]);

    // --- Checkout ---
    const handleCheckout = async (paymentMethod: 'card' | 'cash' | 'terminal') => {
        if (cart.length === 0) return;
        setProcessing(true);

        try {
            if (paymentMethod === 'terminal') {
                if (terminalStatus !== 'connected' || !activeReader) {
                    alert("Please connect a reader first.");
                    setProcessing(false);
                    setShowReaderModal(true);
                    return;
                }

                const piRes = await apiRequest('/pos/process-payment', token, {
                    method: 'POST',
                    headers: { 'X-Tenant-Slug': tenantSlug },
                    body: JSON.stringify({ items: cart, customerId: selectedCustomer?.stripeCustomerId })
                });

                if (piRes.error) throw new Error(piRes.error);
                const clientSecret = piRes.clientSecret;

                const result = await terminal.collectPaymentMethod(clientSecret);
                if (result.error) throw new Error(result.error.message);

                const processResult = await terminal.processPayment(result.paymentIntent);
                if (processResult.error) throw new Error(processResult.error.message);

                await createOrder('card', processResult.paymentIntent.id, selectedCustomer?.id);

            } else if (paymentMethod === 'card') {
                await createOrder('card', 'manual_entry', selectedCustomer?.id);
            } else {
                await createOrder('cash', null, selectedCustomer?.id);
            }

            setCart([]);
            setSelectedCustomer(null);
            alert("Order Completed!");
            setRefreshTrigger(p => p + 1);
        } catch (err: any) {
            console.error(err);
            alert(`Checkout Failed: ${err.message}`);
        } finally {
            setProcessing(false);
        }
    };

    const createOrder = async (method: string, stripePaymentIntentId: string | null, memberId: string | undefined) => {
        await apiRequest('/pos/orders', token, {
            method: 'POST',
            headers: { 'X-Tenant-Slug': tenantSlug },
            body: JSON.stringify({
                items: cart,
                memberId: memberId || null,
                paymentMethod: method,
                totalAmount: total,
                couponCode: activeCoupon?.code,
                stripePaymentIntentId: stripePaymentIntentId || undefined
            })
        });
    };

    useEffect(() => {
        if (!customerQuery || customerQuery.length < 2) {
            setCustomerResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            setSearchingCustomer(true);
            try {
                const res = await apiRequest(`/pos/customers?query=${customerQuery}`, token, { headers: { 'X-Tenant-Slug': tenantSlug } });
                setCustomerResults(res.customers || []);
            } catch (e) { console.error(e); }
            finally { setSearchingCustomer(false); }
        }, 500);
        return () => clearTimeout(timer);
    }, [customerQuery]);

    return (
        <div className="flex h-full">
            {/* --- Main Product Area --- */}
            <div className="flex-1 p-6 overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">POS & Retail</h1>
                        <p className="text-sm text-zinc-500">Manage inventory and process sales.</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowReaderModal(true)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${terminalStatus === 'connected' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-zinc-700 border-zinc-200'}`}
                        >
                            <Wifi size={16} />
                            {terminalStatus === 'connected' ? activeReader?.label || 'Reader Connected' : 'Connect Reader'}
                        </button>
                        <button
                            onClick={() => { setEditingProduct(null); setShowProductModal(true); }}
                            className="flex items-center gap-2 px-3 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm hover:opacity-90"
                        >
                            <Plus size={16} /> Add Product
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {products.map(product => (
                        <div key={product.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow group relative">
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                <button onClick={() => { setEditingProduct(product); setShowProductModal(true); }} className="p-1.5 bg-zinc-100 rounded text-zinc-600 hover:text-blue-600">
                                    <Edit size={14} />
                                </button>
                            </div>

                            <div className="aspect-square bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-300">
                                {product.imageUrl ? <img src={product.imageUrl} className="w-full h-full object-cover rounded-lg" /> : <Archive size={32} />}
                            </div>
                            <div>
                                <div className="flex justify-between items-start">
                                    <h3 className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{product.name}</h3>
                                    <span className="text-xs font-bold bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-600">${(product.price / 100).toFixed(2)}</span>
                                </div>
                                <p className="text-xs text-zinc-500 truncate">{product.category || 'General'}</p>
                            </div>
                            <div className="mt-auto pt-2 flex items-center justify-between">
                                <span className={`text-xs ${product.stockQuantity > 0 ? 'text-green-600' : 'text-red-500'} font-medium`}>
                                    {product.stockQuantity} in stock
                                </span>
                                <button
                                    onClick={() => addToCart(product)}
                                    disabled={product.stockQuantity <= 0}
                                    className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Plus size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* --- Sidebar Cart --- */}
            <div className="w-96 bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 flex flex-col z-10 shadow-xl">
                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
                    {selectedCustomer ? (
                        <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center text-xs font-bold">
                                    {selectedCustomer.profile?.firstName?.[0] || selectedCustomer.name?.[0] || 'C'}
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-blue-900 dark:text-blue-100">{selectedCustomer.profile ? `${selectedCustomer.profile.firstName} ${selectedCustomer.profile.lastName}` : selectedCustomer.name}</div>
                                    <div className="text-[10px] text-blue-600 dark:text-blue-300 truncate w-32">{selectedCustomer.email}</div>
                                </div>
                            </div>
                            <button onClick={() => setSelectedCustomer(null)} className="text-blue-400 hover:text-blue-600"><X size={14} /></button>
                        </div>
                    ) : (
                        <div className="relative">
                            <button
                                onClick={() => setShowCustomerSearch(!showCustomerSearch)}
                                className="w-full flex items-center justify-between px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-500 hover:border-blue-400 transition-colors"
                            >
                                <span className="flex items-center gap-2"><User size={14} /> Add Customer to Sale</span>
                                <Plus size={14} />
                            </button>

                            {showCustomerSearch && (
                                <div className="absolute top-12 left-0 right-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg p-2 z-20">
                                    <div className="flex items-center gap-2 px-2 py-1 bg-zinc-50 rounded border border-zinc-100 mb-2">
                                        <Search size={14} className="text-zinc-400" />
                                        <input
                                            autoFocus
                                            className="bg-transparent text-sm w-full outline-none"
                                            placeholder="Search name or email..."
                                            value={customerQuery}
                                            onChange={(e) => setCustomerQuery(e.target.value)}
                                        />
                                    </div>
                                    <div className="max-h-48 overflow-y-auto space-y-1">
                                        {searchingCustomer && <div className="text-xs text-center p-2 text-zinc-400">Searching...</div>}
                                        {customerResults.map(c => (
                                            <button
                                                key={c.id || c.stripeCustomerId}
                                                onClick={() => { setSelectedCustomer(c); setShowCustomerSearch(false); setCustomerQuery(""); }}
                                                className="w-full text-left p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded text-sm group"
                                            >
                                                <div className="font-medium">{c.profile ? `${c.profile.firstName} ${c.profile.lastName}` : c.name}</div>
                                                <div className="text-xs text-zinc-500">{c.email}</div>
                                            </button>
                                        ))}
                                        <button
                                            onClick={() => { setShowNewCustomerModal(true); setShowCustomerSearch(false); }}
                                            className="w-full text-left p-2 border-t border-zinc-100 text-blue-600 text-xs font-medium hover:bg-blue-50 rounded mt-1"
                                        >
                                            + Create New Customer
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {cart.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center group">
                            <div>
                                <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.name}</div>
                                <div className="text-xs text-zinc-500">${(item.price / 100).toFixed(2)} x {item.quantity}</div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="font-medium text-sm">${(item.price * item.quantity / 100).toFixed(2)}</div>
                                <button onClick={() => removeFromCart(item.productId)} className="text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {cart.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-400 space-y-2 opacity-50">
                            <ShoppingCart size={32} />
                            <span className="text-sm">Cart is empty</span>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 space-y-3">
                    <div className="flex gap-2">
                        <input
                            className="flex-1 px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm uppercase font-mono"
                            placeholder="PROMO CODE"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                            disabled={!!activeCoupon}
                        />
                        {activeCoupon ? (
                            <button onClick={() => { setActiveCoupon(null); setDiscountAmount(0); setCouponCode(""); }} className="px-3 py-2 bg-red-100 text-red-600 rounded-lg text-sm font-medium hover:bg-red-200">Remove</button>
                        ) : (
                            <button onClick={handleApplyCoupon} disabled={!couponCode || cart.length === 0} className="px-3 py-2 bg-zinc-900 dark:bg-zinc-700 text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">Apply</button>
                        )}
                    </div>
                    {couponError && <div className="text-xs text-red-500 font-medium">{couponError}</div>}

                    <div className="flex justify-between items-center text-sm text-zinc-500">
                        <span>Subtotal</span>
                        <span>${(subtotal / 100).toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between items-center text-lg font-bold text-zinc-900 dark:text-zinc-100">
                        <span>Total</span>
                        <span>${(total / 100).toFixed(2)}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            disabled={processing || cart.length === 0}
                            onClick={() => handleCheckout('card')}
                            className="bg-white border border-zinc-200 text-zinc-700 py-3 rounded-lg font-medium hover:bg-zinc-50 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <CreditCard size={16} /> Manual Card
                        </button>
                        <button
                            disabled={processing || cart.length === 0}
                            onClick={() => handleCheckout('cash')}
                            className="bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
                        >
                            Cash
                        </button>
                    </div>
                    <button
                        disabled={processing || cart.length === 0}
                        onClick={() => handleCheckout('terminal')}
                        className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg transition-all ${terminalStatus === 'connected' ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 dark:shadow-blue-900/20' : 'bg-zinc-200 text-zinc-500 cursor-not-allowed'}`}
                    >
                        {processing ? <Loader2 className="animate-spin" /> : <Wifi size={20} />}
                        {terminalStatus === 'connected' ? 'Charge Application' : 'Connect Reader to Charge'}
                    </button>
                </div>
            </div>

            {/* --- Modals --- */}
            {showProductModal && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl p-6 space-y-4">
                        <div className="flex justify-between items-center text-zinc-900 dark:text-zinc-100">
                            <h2 className="text-lg font-bold">{editingProduct ? 'Edit Product' : 'New Product'}</h2>
                            <button onClick={() => setShowProductModal(false)}><X size={20} /></button>
                        </div>
                        <ProductForm
                            token={token}
                            tenantSlug={tenantSlug}
                            product={editingProduct}
                            onSuccess={() => { setShowProductModal(false); setRefreshTrigger(p => p + 1); }}
                        />
                    </div>
                </div>
            )}

            {showReaderModal && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl p-6 space-y-6">
                        <div className="flex justify-between items-center text-zinc-900 dark:text-zinc-100">
                            <h2 className="text-xl font-bold flex items-center gap-2"><Wifi /> Connect Reader</h2>
                            <button onClick={() => setShowReaderModal(false)}><X size={20} /></button>
                        </div>
                        <div className="space-y-4">
                            {readers.length === 0 ? (
                                <button
                                    onClick={async () => {
                                        setProcessing(true);
                                        const res = await terminal.discoverReaders({ discoveryMethod: 'internet', simulated: false }).catch(() => ({}));
                                        if (res.discoveredReaders) setReaders(res.discoveredReaders);
                                        setProcessing(false);
                                    }}
                                    className="w-full py-3 bg-blue-600 text-white rounded-lg"
                                >
                                    {processing ? "Scanning..." : "Scan for Readers"}
                                </button>
                            ) : (
                                readers.map((r, i) => (
                                    <button key={i} onClick={() => handleConnectReader(r)} className="w-full p-4 border rounded-lg text-left">
                                        <div className="font-bold">{r.label || r.serialNumber}</div>
                                        <div className="text-xs">{r.deviceType}</div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showNewCustomerModal && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl p-6">
                        <h2 className="text-lg font-bold mb-4 text-zinc-900 dark:text-zinc-100">Create New Customer</h2>
                        <CustomerForm
                            token={token}
                            tenantSlug={tenantSlug}
                            onSuccess={(c: any) => { setSelectedCustomer(c); setShowNewCustomerModal(false); }}
                            onCancel={() => setShowNewCustomerModal(false)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

function ProductForm({ token, tenantSlug, product, onSuccess }: any) {
    const [submitting, setSubmitting] = useState(false);
    return (
        <form className="space-y-4" onSubmit={async (e) => {
            e.preventDefault();
            setSubmitting(true);
            const fd = new FormData(e.currentTarget);
            const data = Object.fromEntries(fd);
            const payload = {
                ...data,
                price: Math.round(parseFloat(data.price as string) * 100),
                stockQuantity: parseInt(data.stockQuantity as string),
                isActive: true
            };
            const url = product ? `/pos/products/${product.id}` : '/pos/products';
            const method = product ? 'PUT' : 'POST';
            await apiRequest(url, token, { method, headers: { 'X-Tenant-Slug': tenantSlug }, body: JSON.stringify(payload) });
            setSubmitting(false);
            onSuccess();
        }}>
            <input name="name" defaultValue={product?.name} required className="w-full p-2 border rounded dark:bg-zinc-800 dark:text-zinc-100" placeholder="Product Name" />
            <div className="grid grid-cols-2 gap-4">
                <input name="price" type="number" step="0.01" defaultValue={product ? (product.price / 100) : ''} required className="w-full p-2 border rounded dark:bg-zinc-800 dark:text-zinc-100" placeholder="Price ($)" />
                <input name="stockQuantity" type="number" defaultValue={product?.stockQuantity} required className="w-full p-2 border rounded dark:bg-zinc-800 dark:text-zinc-100" placeholder="Stock" />
            </div>
            <textarea name="description" defaultValue={product?.description} className="w-full p-2 border rounded dark:bg-zinc-800 dark:text-zinc-100 h-20" placeholder="Description" />
            <button disabled={submitting} type="submit" className="w-full bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white rounded p-2">
                {submitting ? 'Saving...' : 'Save Product'}
            </button>
        </form>
    );
}

function CustomerForm({ token, tenantSlug, onSuccess, onCancel }: any) {
    const [submitting, setSubmitting] = useState(false);
    return (
        <form className="space-y-4" onSubmit={async (e) => {
            e.preventDefault();
            setSubmitting(true);
            const fd = new FormData(e.currentTarget);
            const data = Object.fromEntries(fd);
            const res = await apiRequest('/pos/customers', token, { method: 'POST', headers: { 'X-Tenant-Slug': tenantSlug }, body: JSON.stringify(data) });
            setSubmitting(false);
            if (res.customer) onSuccess(res.customer);
        }}>
            <input name="name" required className="w-full p-2 border rounded dark:bg-zinc-800" placeholder="Jane Doe" />
            <input name="email" type="email" required className="w-full p-2 border rounded dark:bg-zinc-800" placeholder="jane@example.com" />
            <div className="flex gap-2 justify-end">
                <button type="button" onClick={onCancel} className="px-4 py-2 border rounded text-zinc-900 dark:text-zinc-100">Cancel</button>
                <button type="submit" disabled={submitting} className="px-4 py-2 bg-blue-600 text-white rounded">
                    {submitting ? 'Creating...' : 'Create Customer'}
                </button>
            </div>
        </form>
    );
}
