// @ts-ignore
import { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
// @ts-ignore
import { useLoaderData, useSubmit, Form, redirect, useRevalidator } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { useState } from "react";
import { Plus, Edit, Trash2, Package, Search, Filter, DollarSign, Box, Tag, Image as ImageIcon, X, Save, Upload } from "lucide-react";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken, userId } = await getAuth(args);
    const { slug } = args.params;
    if (!userId) return redirect("/sign-in");

    const token = await getToken();

    try {
        const productsData = await apiRequest('/products', token, { headers: { 'X-Tenant-Slug': slug } }) as any;
        return { products: productsData || [] };
    } catch (e) {
        console.error("Retail Loader Error", e);
        return { products: [] };
    }
};

export const action = async (args: ActionFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const { slug } = args.params;
    const token = await getToken();
    const formData = await args.request.formData();
    const intent = formData.get("intent");

    if (intent === 'create' || intent === 'update') {
        const id = formData.get("id");
        const payload = {
            name: formData.get("name"),
            description: formData.get("description"),
            category: formData.get("category"),
            sku: formData.get("sku"),
            price: parseInt(formData.get("price") as string || "0"),
            stockQuantity: parseInt(formData.get("stockQuantity") as string || "0"),
            imageUrl: formData.get("imageUrl"),
            isActive: formData.get("isActive") === "true"
        };

        await apiRequest(id ? `/products/${id}` : '/products', token, {
            method: id ? 'PATCH' : 'POST',
            headers: { 'X-Tenant-Slug': slug },
            body: JSON.stringify(payload)
        });
    }

    if (intent === 'delete') {
        const id = formData.get("id");
        await apiRequest(`/products/${id}`, token, {
            method: 'DELETE',
            headers: { 'X-Tenant-Slug': slug }
        });
    }

    return { success: true };
};

export default function RetailManagement() {
    const { products } = useLoaderData<typeof loader>();
    const submit = useSubmit();
    const revalidator = useRevalidator();

    const [searchQuery, setSearchQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [isEditing, setIsEditing] = useState<any | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    // Get unique categories
    const categories = [...new Set(products.map((p: any) => p.category).filter(Boolean))];

    // Filter products
    const filteredProducts = products.filter((p: any) => {
        if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        if (categoryFilter && p.category !== categoryFilter) return false;
        return true;
    });

    const handleDelete = (id: string) => {
        if (confirm("Are you sure you want to delete this product?")) {
            submit({ intent: 'delete', id }, { method: 'post' });
        }
    };

    const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

    return (
        <div className="flex flex-col h-full bg-zinc-50">
            {/* Header */}
            <header className="bg-white border-b border-zinc-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-zinc-900 rounded-lg text-white"><Package size={20} /></div>
                        <div>
                            <h1 className="text-xl font-bold text-zinc-900">Retail</h1>
                            <p className="text-sm text-zinc-500">{products.length} products</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 flex items-center gap-2"
                    >
                        <Plus size={16} /> Add Product
                    </button>
                </div>

                {/* Search & Filter */}
                <div className="flex gap-4 mt-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="Search products..."
                            className="w-full pl-9 pr-4 py-2 border border-zinc-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-black/5"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="px-4 py-2 border border-zinc-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-black/5"
                    >
                        <option value="">All Categories</option>
                        {categories.map((cat: any) => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>
            </header>

            {/* Products Grid */}
            <div className="flex-1 overflow-y-auto p-6">
                {filteredProducts.length === 0 ? (
                    <div className="text-center py-20 text-zinc-500">
                        <Package size={48} className="mx-auto mb-4 opacity-50" />
                        <p>No products found</p>
                        <button onClick={() => setIsCreating(true)} className="mt-4 text-sm text-zinc-900 underline">Add your first product</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredProducts.map((product: any) => (
                            <div key={product.id} className="bg-white rounded-lg border border-zinc-200 overflow-hidden group hover:border-zinc-300 transition">
                                <div className="aspect-square bg-zinc-100 relative">
                                    {product.imageUrl ? (
                                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Package size={48} className="text-zinc-300" />
                                        </div>
                                    )}
                                    {!product.isActive && (
                                        <div className="absolute top-2 left-2 px-2 py-1 bg-red-100 text-red-600 text-xs font-medium rounded">Inactive</div>
                                    )}
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition flex gap-1">
                                        <button onClick={() => setIsEditing(product)} className="p-1.5 bg-white rounded shadow hover:bg-zinc-50"><Edit size={14} /></button>
                                        <button onClick={() => handleDelete(product.id)} className="p-1.5 bg-white rounded shadow hover:bg-red-50 text-red-500"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                                <div className="p-4">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="font-medium text-zinc-900">{product.name}</h3>
                                            <p className="text-sm text-zinc-500">{product.category || "Uncategorized"}</p>
                                        </div>
                                        <span className="text-lg font-bold text-zinc-900">{formatPrice(product.price)}</span>
                                    </div>
                                    <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                                        <span className="flex items-center gap-1"><Box size={12} /> {product.stockQuantity} in stock</span>
                                        {product.sku && <span className="font-mono">{product.sku}</span>}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Edit/Create Modal */}
            {(isEditing || isCreating) && (
                <ProductModal
                    product={isEditing}
                    onClose={() => { setIsEditing(null); setIsCreating(false); }}
                    onSave={(data) => {
                        const formData = new FormData();
                        formData.append("intent", isEditing ? "update" : "create");
                        if (isEditing) formData.append("id", isEditing.id);
                        Object.entries(data).forEach(([key, value]) => {
                            formData.append(key, String(value));
                        });
                        submit(formData, { method: "post" });
                        setIsEditing(null);
                        setIsCreating(false);
                    }}
                />
            )}
        </div>
    );
}

function ProductModal({ product, onClose, onSave }: { product?: any, onClose: () => void, onSave: (data: any) => void }) {
    const [name, setName] = useState(product?.name || "");
    const [description, setDescription] = useState(product?.description || "");
    const [category, setCategory] = useState(product?.category || "");
    const [sku, setSku] = useState(product?.sku || "");
    const [price, setPrice] = useState(product?.price ? (product.price / 100).toFixed(2) : "");
    const [stockQuantity, setStockQuantity] = useState(product?.stockQuantity?.toString() || "0");
    const [imageUrl, setImageUrl] = useState(product?.imageUrl || "");
    const [isActive, setIsActive] = useState(product?.isActive !== false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            name,
            description,
            category,
            sku,
            price: Math.round(parseFloat(price || "0") * 100),
            stockQuantity: parseInt(stockQuantity || "0"),
            imageUrl,
            isActive
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full animate-in fade-in zoom-in duration-200">
                <div className="p-4 border-b border-zinc-200 flex justify-between items-center">
                    <h2 className="text-lg font-bold">{product ? "Edit Product" : "New Product"}</h2>
                    <button onClick={onClose}><X size={20} className="text-zinc-400 hover:text-zinc-600" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Name *</label>
                            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-black/5" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Price ($)</label>
                            <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-black/5" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Stock</label>
                            <input type="number" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-black/5" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Category</label>
                            <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Apparel" className="w-full px-3 py-2 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-black/5" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">SKU</label>
                            <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-black/5 font-mono" />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Description</label>
                            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-black/5 resize-none" />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Image URL</label>
                            <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className="w-full px-3 py-2 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-black/5" />
                        </div>
                        <div className="col-span-2 flex items-center gap-2">
                            <input type="checkbox" id="isActive" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4" />
                            <label htmlFor="isActive" className="text-sm text-zinc-700">Active (visible to customers)</label>
                        </div>
                    </div>
                    <div className="pt-4 flex justify-end gap-3 border-t border-zinc-100">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-700">Cancel</button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 flex items-center gap-2">
                            <Save size={16} /> {product ? "Save Changes" : "Create Product"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
