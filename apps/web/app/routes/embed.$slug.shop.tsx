// @ts-ignore
import { LoaderFunctionArgs } from "react-router";
// @ts-ignore
import { useLoaderData, Link } from "react-router";
import { apiRequest } from "~/utils/api";
import { useState } from "react";
import { ShoppingCart, Plus, Minus, X, Package, ExternalLink } from "lucide-react";

export const loader = async (args: LoaderFunctionArgs) => {
    const { slug } = args.params;

    try {
        // Public endpoint - no auth required
        const response = await fetch(`${process.env.API_BASE_URL || 'https://studio-platform-api.slichti.workers.dev'}/products?active=true`, {
            headers: { 'X-Tenant-Slug': slug || '' }
        });

        if (!response.ok) throw new Error("Failed to fetch products");

        const products = await response.json();
        return { products: products || [], slug };
    } catch (e) {
        console.error("Shop Loader Error", e);
        return { products: [], slug };
    }
};

export default function EmbedShop() {
    const { products, slug } = useLoaderData<typeof loader>();
    const [cart, setCart] = useState<Map<string, number>>(new Map());
    const [isCartOpen, setIsCartOpen] = useState(false);

    const addToCart = (productId: string) => {
        setCart(prev => {
            const next = new Map(prev);
            next.set(productId, (next.get(productId) || 0) + 1);
            return next;
        });
    };

    const removeFromCart = (productId: string) => {
        setCart(prev => {
            const next = new Map(prev);
            const current = next.get(productId) || 0;
            if (current <= 1) {
                next.delete(productId);
            } else {
                next.set(productId, current - 1);
            }
            return next;
        });
    };

    const cartItemCount = Array.from(cart.values()).reduce((a, b) => a + b, 0);

    const cartTotal = Array.from(cart.entries()).reduce((total, [id, qty]) => {
        const product = products.find((p: any) => p.id === id);
        return total + (product?.price || 0) * qty;
    }, 0);

    const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

    // Group by category
    const categories = [...new Set(products.map((p: any) => p.category || "Other"))];

    return (
        <div className="min-h-screen bg-zinc-50">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white border-b border-zinc-200 px-4 py-3">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <h1 className="text-xl font-bold text-zinc-900">Shop</h1>
                    <button
                        onClick={() => setIsCartOpen(true)}
                        className="relative p-2 hover:bg-zinc-100 rounded-full transition"
                    >
                        <ShoppingCart size={24} />
                        {cartItemCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-zinc-900 text-white text-xs font-bold rounded-full flex items-center justify-center">
                                {cartItemCount}
                            </span>
                        )}
                    </button>
                </div>
            </header>

            {/* Products */}
            <main className="max-w-6xl mx-auto px-4 py-8">
                {products.length === 0 ? (
                    <div className="text-center py-20 text-zinc-500">
                        <Package size={48} className="mx-auto mb-4 opacity-50" />
                        <p>No products available</p>
                    </div>
                ) : (
                    categories.map((category: any) => (
                        <section key={category} className="mb-12">
                            <h2 className="text-lg font-bold text-zinc-900 mb-4">{category}</h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {products.filter((p: any) => (p.category || "Other") === category).map((product: any) => (
                                    <div key={product.id} className="bg-white rounded-lg border border-zinc-200 overflow-hidden hover:shadow-md transition">
                                        <div className="aspect-square bg-zinc-100">
                                            {product.imageUrl ? (
                                                <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Package size={32} className="text-zinc-300" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-3">
                                            <h3 className="font-medium text-zinc-900 text-sm">{product.name}</h3>
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="font-bold text-zinc-900">{formatPrice(product.price)}</span>
                                                {product.stockQuantity <= 0 ? (
                                                    <span className="text-xs text-red-500">Out of Stock</span>
                                                ) : (
                                                    <button
                                                        onClick={() => addToCart(product.id)}
                                                        className="p-1.5 bg-zinc-900 text-white rounded-full hover:bg-zinc-800 transition"
                                                    >
                                                        <Plus size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))
                )}
            </main>

            {/* Cart Drawer */}
            {isCartOpen && (
                <div className="fixed inset-0 z-50">
                    <div className="absolute inset-0 bg-black/30" onClick={() => setIsCartOpen(false)} />
                    <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-xl flex flex-col animate-in slide-in-from-right">
                        <div className="p-4 border-b border-zinc-200 flex items-center justify-between">
                            <h2 className="text-lg font-bold">Your Cart ({cartItemCount})</h2>
                            <button onClick={() => setIsCartOpen(false)}><X size={24} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {cart.size === 0 ? (
                                <p className="text-center text-zinc-500 py-8">Your cart is empty</p>
                            ) : (
                                Array.from(cart.entries()).map(([productId, qty]) => {
                                    const product = products.find((p: any) => p.id === productId);
                                    if (!product) return null;
                                    return (
                                        <div key={productId} className="flex gap-4 p-3 bg-zinc-50 rounded-lg">
                                            <div className="w-16 h-16 bg-zinc-200 rounded flex-shrink-0">
                                                {product.imageUrl && <img src={product.imageUrl} className="w-full h-full object-cover rounded" />}
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-medium text-sm">{product.name}</h3>
                                                <p className="text-sm text-zinc-500">{formatPrice(product.price)}</p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <button onClick={() => removeFromCart(productId)} className="p-1 bg-white border rounded"><Minus size={14} /></button>
                                                    <span className="text-sm font-medium w-6 text-center">{qty}</span>
                                                    <button onClick={() => addToCart(productId)} className="p-1 bg-white border rounded"><Plus size={14} /></button>
                                                </div>
                                            </div>
                                            <div className="font-bold text-sm">
                                                {formatPrice(product.price * qty)}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {cart.size > 0 && (
                            <div className="p-4 border-t border-zinc-200 space-y-4">
                                <div className="flex justify-between text-lg font-bold">
                                    <span>Total</span>
                                    <span>{formatPrice(cartTotal)}</span>
                                </div>
                                <a
                                    href={`/studio/${slug}/checkout?cart=${encodeURIComponent(JSON.stringify(Object.fromEntries(cart)))}`}
                                    className="block w-full py-3 bg-zinc-900 text-white text-center font-medium rounded-lg hover:bg-zinc-800"
                                >
                                    Checkout
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
