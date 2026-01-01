// @ts-ignore
import { useLoaderData } from "react-router";
// @ts-ignore
import { LoaderFunction } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { apiRequest } from "~/utils/api";
import { useState } from "react";
import { ShoppingCart, Plus, Minus, Trash2, Search, Package, Clock, ShoppingBag, CreditCard, Banknote, Ticket } from "lucide-react";
import { GiftCardInput } from "../components/GiftCardInput";

export const loader: LoaderFunction = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const slug = args.params.slug;

    try {
        const [productsRes, ordersRes] = await Promise.all([
            apiRequest("/pos/products", token, { headers: { 'X-Tenant-Slug': slug } }),
            apiRequest("/pos/orders", token, { headers: { 'X-Tenant-Slug': slug } })
        ]);

        return {
            products: (productsRes as any).products || [],
            orders: (ordersRes as any).orders || [],
            token,
            slug
        };
    } catch (e) {
        console.error("Failed to load POS data", e);
        return { products: [], orders: [], token, slug };
    }
};

export default function POSPage() {
    const { products: initialProducts, orders: initialOrders, token, slug } = useLoaderData<any>();

    const [view, setView] = useState<"pos" | "history" | "inventory">("pos");
    const [products, setProducts] = useState(initialProducts);
    const [orders, setOrders] = useState(initialOrders);
    const [cart, setCart] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<"card" | "cash" | "gift_card">("card");
    const [appliedGiftCard, setAppliedGiftCard] = useState<any>(null);

    // --- POS Logic ---
    const addToCart = (product: any) => {
        setCart(prev => {
            const existing = prev.find(item => item.productId === product.id);
            if (existing) {
                return prev.map(item =>
                    item.productId === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prev, {
                productId: product.id,
                name: product.name,
                unitPrice: product.price,
                quantity: 1
            }];
        });
    };

    const updateQuantity = (productId: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.productId === productId) {
                const newQty = Math.max(0, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }).filter(item => item.quantity > 0));
    };

    const cartTotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        setLoading(true);
        try {
            // 1. If gift card, redeem first
            if (appliedGiftCard) {
                const redeemAmount = Math.min(appliedGiftCard.balance, cartTotal);
                const redeemRes: any = await apiRequest("/gift-cards/redeem", token, {
                    method: "POST",
                    headers: { 'X-Tenant-Slug': slug },
                    body: JSON.stringify({
                        code: appliedGiftCard.code,
                        amount: redeemAmount,
                        referenceId: 'POS-TEMP' // Will update after order created
                    })
                });
                if (redeemRes.error) {
                    throw new Error(redeemRes.error);
                }
            }

            // 2. Process Order
            const res: any = await apiRequest("/pos/orders", token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify({
                    items: cart,
                    totalAmount: cartTotal,
                    paymentMethod: paymentMethod === 'gift_card' ? 'other' : paymentMethod
                })
            });

            if (res.error) {
                alert(res.error);
            } else {
                alert("Sale Successful!");
                setCart([]);
                setAppliedGiftCard(null);
                setPaymentMethod("card");
                // Refresh data
                const [pRes, oRes]: any = await Promise.all([
                    apiRequest("/pos/products", token, { headers: { 'X-Tenant-Slug': slug } }),
                    apiRequest("/pos/orders", token, { headers: { 'X-Tenant-Slug': slug } })
                ]);
                setProducts(pRes.products || []);
                setOrders(oRes.orders || []);
            }
        } catch (e: any) {
            alert("Checkout failed: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    // --- Inventory Management ---
    const [showAddProduct, setShowAddProduct] = useState(false);
    const [newProduct, setNewProduct] = useState({ name: "", price: "", stock: "0", category: "Retail" });

    const handleAddProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await apiRequest("/pos/products", token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify({
                    name: newProduct.name,
                    price: parseInt(newProduct.price) * 100, // to cents
                    stockQuantity: parseInt(newProduct.stock),
                    category: newProduct.category
                })
            });
            setShowAddProduct(false);
            setNewProduct({ name: "", price: "", stock: "0", category: "Retail" });
            const pRes: any = await apiRequest("/pos/products", token, { headers: { 'X-Tenant-Slug': slug } });
            setProducts(pRes.products || []);
        } catch (e) {
            alert("Failed to add product");
        } finally {
            setLoading(false);
        }
    };

    const filteredProducts = products.filter((p: any) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex flex-col h-screen max-h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
            {/* Header / Tabs */}
            <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-6">
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <ShoppingBag className="text-blue-600" /> POS & Retail
                    </h1>
                    <nav className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                        <button
                            onClick={() => setView("pos")}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${view === 'pos' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-700'}`}
                        >
                            Terminal
                        </button>
                        <button
                            onClick={() => setView("history")}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${view === 'history' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-700'}`}
                        >
                            Orders
                        </button>
                        <button
                            onClick={() => setView("inventory")}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${view === 'inventory' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-700'}`}
                        >
                            Inventory
                        </button>
                    </nav>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="Find products..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800 border-none rounded-full text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64"
                        />
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Main View Area */}
                <div className="flex-1 overflow-auto p-6">
                    {view === 'pos' && (
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                            {filteredProducts.map((p: any) => (
                                <button
                                    key={p.id}
                                    onClick={() => addToCart(p)}
                                    disabled={p.stockQuantity <= 0}
                                    className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 transition-all flex flex-col items-start gap-3 text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <div className="w-full aspect-square bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center mb-1 group-hover:scale-105 transition-transform">
                                        <Package className="h-10 w-10 text-zinc-300" />
                                    </div>
                                    <div className="flex-1 min-w-0 w-full">
                                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{p.name}</h3>
                                        <p className="text-sm text-zinc-500 line-clamp-1">{p.category}</p>
                                    </div>
                                    <div className="flex justify-between items-end w-full">
                                        <span className="text-lg font-bold text-blue-600">${(p.price / 100).toFixed(2)}</span>
                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${p.stockQuantity > 5 ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                                            {p.stockQuantity} Left
                                        </span>
                                    </div>
                                </button>
                            ))}
                            {filteredProducts.length === 0 && (
                                <div className="col-span-full py-20 text-center">
                                    <Package className="h-12 w-12 text-zinc-200 mx-auto mb-4" />
                                    <p className="text-zinc-500">No products found. Add some in Inventory.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {view === 'history' && (
                        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">Order ID</th>
                                        <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">Customer</th>
                                        <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">Total</th>
                                        <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">Items</th>
                                        <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                    {orders.map((o: any) => (
                                        <tr key={o.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                            <td className="px-6 py-4 text-sm font-mono text-zinc-600 dark:text-zinc-400">#{o.id.substring(0, 8)}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-zinc-200 flex items-center justify-center text-[10px] font-bold">
                                                        {o.member?.user?.profile?.firstName?.charAt(0) || '?'}
                                                    </div>
                                                    <span className="text-sm font-medium">
                                                        {o.member?.user?.profile?.firstName || 'Guest'} {o.member?.user?.profile?.lastName || ''}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm font-bold text-green-600">${(o.totalAmount / 100).toFixed(2)}</span>
                                            </td>
                                            <td className="px-6 py-4 text-xs text-zinc-500">
                                                {o.items.map((it: any) => it.product.name).join(", ")}
                                            </td>
                                            <td className="px-6 py-4 text-xs text-zinc-400">
                                                {new Date(o.createdAt).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                    {orders.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-20 text-center text-zinc-500 italic">No orders processed yet.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {view === 'inventory' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h2 className="text-xl font-bold">Manage Inventory</h2>
                                <button
                                    onClick={() => setShowAddProduct(true)}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-blue-700"
                                >
                                    <Plus className="h-4 w-4" /> Add Product
                                </button>
                            </div>

                            {showAddProduct && (
                                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-md">
                                    <h3 className="font-semibold mb-4">New Product Details</h3>
                                    <form onSubmit={handleAddProduct} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Product Name</label>
                                            <input
                                                className="w-full border border-zinc-200 dark:border-zinc-700 rounded px-3 py-2 text-sm"
                                                placeholder="e.g. Studio T-Shirt"
                                                value={newProduct.name}
                                                onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Price ($)</label>
                                            <input
                                                type="number"
                                                className="w-full border border-zinc-200 dark:border-zinc-700 rounded px-3 py-2 text-sm"
                                                placeholder="25.00"
                                                value={newProduct.price}
                                                onChange={e => setNewProduct({ ...newProduct, price: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Initial Stock</label>
                                            <input
                                                type="number"
                                                className="w-full border border-zinc-200 dark:border-zinc-700 rounded px-3 py-2 text-sm"
                                                placeholder="10"
                                                value={newProduct.stock}
                                                onChange={e => setNewProduct({ ...newProduct, stock: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="md:col-span-4 flex justify-end gap-3 mt-2">
                                            <button
                                                type="button"
                                                onClick={() => setShowAddProduct(false)}
                                                className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={loading}
                                                className="bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:opacity-90"
                                            >
                                                {loading ? 'Saving...' : 'Create Product'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                                <table className="w-full text-left">
                                    <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">Product</th>
                                            <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">Category</th>
                                            <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">Price</th>
                                            <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">In Stock</th>
                                            <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                        {products.map((p: any) => (
                                            <tr key={p.id}>
                                                <td className="px-6 py-4 text-sm font-medium">{p.name}</td>
                                                <td className="px-6 py-4 text-sm text-zinc-500">{p.category}</td>
                                                <td className="px-6 py-4 text-sm font-bold">${(p.price / 100).toFixed(2)}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-sm font-medium ${p.stockQuantity <= 5 ? 'text-red-500' : 'text-zinc-900 dark:text-zinc-100'}`}>
                                                        {p.stockQuantity}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                        {p.isActive ? 'Active' : 'Hidden'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* POS Sidebar: Cart */}
                {view === 'pos' && (
                    <div className="w-96 bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 flex flex-col shadow-xl">
                        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <ShoppingCart className="h-5 w-5 text-zinc-400" /> Current Cart
                            </h2>
                        </div>

                        <div className="flex-1 overflow-auto p-6 space-y-4">
                            {cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-zinc-400 opacity-50 space-y-3">
                                    <ShoppingCart className="h-12 w-12" />
                                    <p className="text-sm">Cart is empty</p>
                                </div>
                            ) : (
                                cart.map((item: any) => (
                                    <div key={item.productId} className="flex gap-3 items-start animate-in slide-in-from-right-1">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{item.name}</h4>
                                            <p className="text-xs text-zinc-500">${(item.unitPrice / 100).toFixed(2)} ea</p>
                                        </div>
                                        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
                                            <button onClick={() => updateQuantity(item.productId, -1)} className="p-1 hover:bg-white dark:hover:bg-zinc-700 rounded transition-colors">
                                                <Minus className="h-3 w-3" />
                                            </button>
                                            <span className="w-6 text-center text-xs font-bold">{item.quantity}</span>
                                            <button onClick={() => addToCart({ id: item.productId, name: item.name, price: item.unitPrice })} className="p-1 hover:bg-white dark:hover:bg-zinc-700 rounded transition-colors">
                                                <Plus className="h-3 w-3" />
                                            </button>
                                        </div>
                                        <div className="text-sm font-bold w-16 text-right">
                                            ${((item.unitPrice * item.quantity) / 100).toFixed(2)}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-zinc-800 space-y-6">
                            {/* Payment Method Selector */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Payment Method</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        onClick={() => setPaymentMethod("card")}
                                        className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${paymentMethod === 'card' ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-blue-300'}`}
                                    >
                                        <CreditCard size={18} />
                                        <span className="text-[10px] font-extrabold mt-1">CARD</span>
                                    </button>
                                    <button
                                        onClick={() => setPaymentMethod("cash")}
                                        className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${paymentMethod === 'cash' ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-emerald-300'}`}
                                    >
                                        <Banknote size={18} />
                                        <span className="text-[10px] font-extrabold mt-1">CASH</span>
                                    </button>
                                    <button
                                        onClick={() => setPaymentMethod("gift_card")}
                                        className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${paymentMethod === 'gift_card' ? 'bg-amber-600 border-amber-600 text-white shadow-lg shadow-amber-500/20' : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-amber-300'}`}
                                    >
                                        <Ticket size={18} />
                                        <span className="text-[10px] font-extrabold mt-1">GIFT</span>
                                    </button>
                                </div>
                            </div>

                            {paymentMethod === 'gift_card' && (
                                <GiftCardInput
                                    token={token}
                                    slug={slug}
                                    onApply={(card) => setAppliedGiftCard(card)}
                                    onRemove={() => setAppliedGiftCard(null)}
                                />
                            )}

                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-zinc-500 text-sm">
                                    <span>Subtotal</span>
                                    <span>${(cartTotal / 100).toFixed(2)}</span>
                                </div>
                                {appliedGiftCard && (
                                    <div className="flex justify-between items-center text-emerald-600 text-sm font-bold">
                                        <span>Gift Card Credit</span>
                                        <span>-${(Math.min(appliedGiftCard.balance, cartTotal) / 100).toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center text-lg font-bold text-zinc-900 dark:text-zinc-100 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                                    <span>Remaining</span>
                                    <span>${(Math.max(0, cartTotal - (appliedGiftCard?.balance || 0)) / 100).toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setCart([])}
                                    className="flex-1 py-3 text-sm font-medium text-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                                >
                                    Clear
                                </button>
                                <button
                                    onClick={handleCheckout}
                                    disabled={loading || cart.length === 0}
                                    className="flex-[2] bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white py-3 rounded-xl font-bold shadow-lg shadow-zinc-200 dark:shadow-none hover:translate-y-[-2px] active:translate-y-0 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {loading ? 'Processing...' : (
                                        <>
                                            Charge ${(Math.max(0, cartTotal - (appliedGiftCard?.balance || 0)) / 100).toFixed(2)}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
