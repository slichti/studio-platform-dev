
import { useLoaderData, useSubmit, Form, useRevalidator, useFetcher } from "react-router";
import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Package, Search, DollarSign, Box, Tag, X, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { ConfirmationDialog } from "~/components/Dialogs";

export default function RetailPage() {
    const { products } = useLoaderData<any>();
    const submit = useSubmit();

    const [searchQuery, setSearchQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [isEditing, setIsEditing] = useState<any | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    // Get unique categories
    const categories = [...new Set(products.map((p: any) => p.category).filter(Boolean))];

    // Filter products
    const filteredProducts = products.filter((p: any) => {
        if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        if (categoryFilter && p.category !== categoryFilter) return false;
        return true;
    });

    const handleDeleteClick = (id: string) => {
        setConfirmDeleteId(id);
    };

    const confirmDeleteAction = () => {
        if (confirmDeleteId) {
            submit({ intent: 'delete', id: confirmDeleteId }, { method: 'post' });
            setConfirmDeleteId(null);
            toast.success("Product deleted");
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
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsImporting(true)}
                            className="px-3 py-2 border border-zinc-200 rounded-lg text-sm font-medium hover:bg-zinc-50 flex items-center gap-2"
                        >
                            <Upload size={16} /> Import
                        </button>
                        <button
                            onClick={() => setIsCreating(true)}
                            className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 flex items-center gap-2"
                        >
                            <Plus size={16} /> Add Product
                        </button>
                    </div>
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
                        <div className="flex gap-2 justify-center mt-4">
                            <button onClick={() => setIsCreating(true)} className="text-sm text-zinc-900 underline">Add manually</button>
                            <span className="text-zinc-300">|</span>
                            {/* Trigger Import Modal */}
                            <button onClick={() => setIsImporting(true)} className="text-sm text-zinc-900 underline">Import JSON</button>
                        </div>
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
                                        <button onClick={() => handleDeleteClick(product.id)} className="p-1.5 bg-white rounded shadow hover:bg-red-50 text-red-500"><Trash2 size={14} /></button>
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
                                        <span className={`flex items-center gap-1 ${(product.stockQuantity <= (product.lowStockThreshold || 5)) ? 'text-amber-600 font-medium' : ''}`}>
                                            <Package size={12} /> {product.stockQuantity} in stock
                                            {(product.stockQuantity <= (product.lowStockThreshold || 5)) && <span className="text-[10px] bg-amber-100 px-1 rounded border border-amber-200">LOW</span>}
                                        </span>
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

            {/* Import Modal */}
            {isImporting && (
                <ImportModal
                    onClose={() => setIsImporting(false)}
                    onImport={(json) => {
                        const formData = new FormData();
                        formData.append("intent", "import_products");
                        formData.append("products", json);
                        submit(formData, { method: "post" });
                        setIsImporting(false);
                    }}
                />
            )}

            <ConfirmationDialog
                isOpen={!!confirmDeleteId}
                onClose={() => setConfirmDeleteId(null)}
                onConfirm={confirmDeleteAction}
                title="Delete Product"
                message="Are you sure you want to delete this product? This action cannot be undone."
                confirmText="Delete Product"
                isDestructive
            />
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
    const [lowStockThreshold, setLowStockThreshold] = useState(product?.lowStockThreshold?.toString() || "5");
    const [imageUrl, setImageUrl] = useState(product?.imageUrl || "");
    const [isActive, setIsActive] = useState(product?.isActive !== false);


    const fetcher = useFetcher();
    const isUploading = fetcher.state !== "idle";

    // Handle Upload Response
    useEffect(() => {
        if (fetcher.data && (fetcher.data as any).url && (fetcher.data as any).url !== imageUrl) {
            setImageUrl((fetcher.data as any).url);
        }
    }, [fetcher.data]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const formData = new FormData();
            formData.append("intent", "upload_image");
            formData.append("file", e.target.files[0]);
            fetcher.submit(formData, { method: "post", encType: "multipart/form-data" });
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            name,
            description,
            category,
            sku,
            price: Math.round(parseFloat(price || "0") * 100),
            stockQuantity: parseInt(stockQuantity || "0"),
            lowStockThreshold: parseInt(lowStockThreshold || "5"),
            imageUrl,
            isActive
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
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
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Low Warning At</label>
                            <input type="number" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-black/5" />
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
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Image</label>
                            <div className="flex gap-2">
                                <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className="flex-1 px-3 py-2 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-black/5" />
                                <label className={`px-3 py-2 border border-zinc-200 rounded-lg bg-zinc-50 hover:bg-zinc-100 cursor-pointer flex items-center gap-2 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={isUploading} />
                                    <Upload size={16} className="text-zinc-500" />
                                    <span className="text-sm font-medium text-zinc-600">{isUploading ? '...' : 'Upload'}</span>
                                </label>
                            </div>
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

function ImportModal({ onClose, onImport }: { onClose: () => void, onImport: (json: string) => void }) {
    const [json, setJson] = useState("");

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full animate-in fade-in zoom-in duration-200">
                <div className="p-4 border-b border-zinc-200 flex justify-between items-center">
                    <h2 className="text-lg font-bold">Import Products</h2>
                    <button onClick={onClose}><X size={20} className="text-zinc-400 hover:text-zinc-600" /></button>
                </div>
                <div className="p-6">
                    <label className="block text-sm font-medium text-zinc-700 mb-2">Paste JSON Array</label>
                    <textarea
                        value={json}
                        onChange={(e) => setJson(e.target.value)}
                        className="w-full h-64 p-3 border border-zinc-200 rounded-lg font-mono text-xs"
                        placeholder='[{"name": "Product 1", "price": 1000}, ...]'
                    />
                    <p className="text-xs text-zinc-500 mt-2">Required: name, price (cents). Optional: description, sku, category.</p>
                </div>
                <div className="p-4 border-t border-zinc-200 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-500">Cancel</button>
                    <button onClick={() => onImport(json)} disabled={!json} className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm disabled:opacity-50">Import</button>
                </div>
            </div>
        </div>
    );
}
