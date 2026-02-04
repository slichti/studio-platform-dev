import { useState, useEffect } from "react";
import { useOutletContext, useParams } from "react-router";
import { apiRequest } from "~/utils/api";
import {
    Package,
    Truck,
    FileText,
    AlertTriangle,
    ArrowUpRight,
    ArrowDownRight,
    Plus,
    Search,
    MoreVertical,
    CheckCircle2,
    Clock,
    XCircle,
    Building2,
    Mail,
    Phone,
    MapPin,
    RefreshCw,
    Filter,
    Edit3,
    Eye,
    Settings
} from "lucide-react";
import { toast } from "sonner";

export default function InventoryDashboard() {
    const { slug } = useParams();
    const { token, features } = useOutletContext<any>() || {};
    const [activeTab, setActiveTab] = useState<'status' | 'suppliers' | 'orders'>('status');
    const [loading, setLoading] = useState(true);
    const [inventory, setInventory] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        loadData();
    }, [slug, activeTab]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'status') {
                const data = await apiRequest('/inventory', token);
                setInventory(data || []);
            } else if (activeTab === 'suppliers') {
                const data = await apiRequest('/inventory/suppliers', token);
                setSuppliers(data || []);
            } else if (activeTab === 'orders') {
                const data = await apiRequest('/inventory/purchase-orders', token);
                setPurchaseOrders(data || []);
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to load inventory data");
        } finally {
            setLoading(false);
        }
    };

    const handleReceivePO = async (poId: string) => {
        if (!confirm("Mark this purchase order as received? Stocks will be updated automatically.")) return;
        try {
            await apiRequest(`/inventory/purchase-orders/${poId}/receive`, token, { method: 'POST' });
            toast.success("Purchase order received and inventory updated");
            loadData();
        } catch (e) {
            toast.error("Failed to receive purchase order");
        }
    };

    const handleAdjustStock = async (productId: string, delta: number, reason: string) => {
        try {
            await apiRequest('/inventory/adjust', token, {
                method: 'POST',
                body: JSON.stringify({ productId, delta, reason })
            });
            toast.success("Stock adjusted");
            loadData();
        } catch (e) {
            toast.error("Failed to adjust stock");
        }
    };

    const filteredStatus = inventory.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku?.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-zinc-50 dark:bg-zinc-950">
            {/* Header Area */}
            <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-8 py-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                            <Package className="text-blue-600" /> Inventory & Suppliers
                        </h1>
                        <p className="text-sm text-zinc-500 mt-1">Track stock levels, manage vendors, and handle purchase orders.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-sm font-semibold hover:opacity-90 shadow-lg shadow-zinc-200 dark:shadow-none transition-all">
                            <Plus size={18} /> New Purchase Order
                        </button>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex items-center gap-6">
                    {[
                        { id: 'status', label: 'Stock Status', icon: <Package size={16} /> },
                        { id: 'suppliers', label: 'Suppliers', icon: <Truck size={16} /> },
                        { id: 'orders', label: 'Purchase Orders', icon: <FileText size={16} /> }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 pb-3 px-1 text-sm font-medium transition-all relative ${activeTab === tab.id ? 'text-blue-600' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
                        >
                            {tab.icon} {tab.label}
                            {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8">
                {loading ? (
                    <div className="h-64 flex flex-col items-center justify-center text-zinc-400 gap-4">
                        <RefreshCw className="animate-spin" size={32} />
                        <p className="animate-pulse">Fetching inventory sync...</p>
                    </div>
                ) : (
                    <div className="max-w-7xl mx-auto space-y-6">
                        {/* Search & Statistics */}
                        <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                            <div className="relative flex-1 min-w-[300px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                <input
                                    className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 transition-all"
                                    placeholder="Search products, SKUs, or suppliers..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <button className="p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-500 transition-colors">
                                    <Filter size={18} />
                                </button>
                                <div className="h-8 w-[1px] bg-zinc-200 dark:bg-zinc-800" />
                                <div className="flex items-center gap-4 px-2">
                                    <div className="text-center">
                                        <div className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Out of Stock</div>
                                        <div className="text-lg font-bold text-red-500">{inventory.filter(p => p.stockQuantity <= 0).length}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Low Stock</div>
                                        <div className="text-lg font-bold text-amber-500">{inventory.filter(p => p.stockQuantity > 0 && p.stockQuantity <= p.lowStockThreshold).length}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Status Tab Content */}
                        {activeTab === 'status' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredStatus.map(product => (
                                    <div key={product.id} className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                                        <div className="p-6">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl text-zinc-600 dark:text-zinc-300 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-500">
                                                    <Package size={24} />
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className={`text-2xl font-black ${product.stockQuantity <= product.lowStockThreshold ? 'text-red-500' : 'text-zinc-900 dark:text-zinc-100'}`}>
                                                        {product.stockQuantity}
                                                    </span>
                                                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">In Stock</span>
                                                </div>
                                            </div>
                                            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1">{product.name}</h3>
                                            <div className="flex items-center gap-2 mb-4">
                                                <span className="text-xs font-mono text-zinc-400 bg-zinc-50 dark:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-100 dark:border-zinc-700">{product.sku || 'NO SKU'}</span>
                                                {product.stockQuantity <= product.lowStockThreshold && (
                                                    <span className="flex items-center gap-1 text-[10px] text-red-600 font-bold uppercase bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full border border-red-100 dark:border-red-800">
                                                        <AlertTriangle size={10} /> Low Stock
                                                    </span>
                                                )}
                                            </div>

                                            <div className="space-y-3 py-4 border-t border-zinc-100 dark:border-zinc-800">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-zinc-500">Supplier</span>
                                                    <span className="text-zinc-900 dark:text-zinc-100 font-medium">{product.supplier?.name || 'Unassigned'}</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-zinc-500">Threshold</span>
                                                    <span className="text-zinc-900 dark:text-zinc-100 font-medium">{product.lowStockThreshold || 5} units</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex gap-2">
                                            <button
                                                onClick={() => handleAdjustStock(product.id, 1, 'correction')}
                                                className="flex-1 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold hover:bg-zinc-50 flex items-center justify-center gap-2"
                                            >
                                                <Plus size={14} /> Quick Add
                                            </button>
                                            <button className="p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:text-blue-600 transition-colors">
                                                <Settings size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Suppliers Tab Content */}
                        {activeTab === 'suppliers' && (
                            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                                            <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Vendor Info</th>
                                            <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Contact</th>
                                            <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {suppliers.map(vendor => (
                                            <tr key={vendor.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl"><Building2 size={20} /></div>
                                                        <div>
                                                            <div className="font-bold text-zinc-900 dark:text-zinc-100">{vendor.name}</div>
                                                            <div className="text-xs text-zinc-500 truncate w-40">{vendor.notes || 'No description'}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="space-y-1">
                                                        <div className="text-sm flex items-center gap-2 text-zinc-600 dark:text-zinc-400"><Mail size={14} /> {vendor.email || '—'}</div>
                                                        <div className="text-sm flex items-center gap-2 text-zinc-600 dark:text-zinc-400"><Phone size={14} /> {vendor.phone || '—'}</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-3 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs font-bold rounded-full border border-green-100 dark:border-green-800 flex items-center gap-1 w-fit">
                                                        <CheckCircle2 size={12} /> Active
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-blue-600"><Edit3 size={16} /></button>
                                                        <button className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-900"><MoreVertical size={16} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Purchase Orders Tab Content */}
                        {activeTab === 'orders' && (
                            <div className="space-y-4">
                                {purchaseOrders.map(order => (
                                    <div key={order.id} className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-6">
                                            <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl text-zinc-600">
                                                <FileText size={24} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{order.poNumber}</h3>
                                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${order.status === 'received' ? 'bg-green-50 text-green-700 border-green-100' :
                                                        order.status === 'sent' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                            'bg-zinc-100 text-zinc-600 border-zinc-200'
                                                        }`}>
                                                        {order.status}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 text-xs text-zinc-500 font-medium">
                                                    <span className="flex items-center gap-1"><Truck size={12} /> {order.supplierName}</span>
                                                    <span className="flex items-center gap-1"><Clock size={12} /> {new Date(order.createdAt).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-8">
                                            <div className="text-right">
                                                <div className="text-xs text-zinc-400 font-bold uppercase tracking-tight">Total Value</div>
                                                <div className="text-lg font-black text-zinc-900 dark:text-zinc-100">${(order.totalAmount / 100).toFixed(2)}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold hover:bg-zinc-50 transition-colors flex items-center gap-2">
                                                    <Eye size={16} /> Details
                                                </button>
                                                {order.status !== 'received' && (
                                                    <button
                                                        onClick={() => handleReceivePO(order.id)}
                                                        className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all flex items-center gap-2"
                                                    >
                                                        <CheckCircle2 size={16} /> Receive Order
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {purchaseOrders.length === 0 && (
                                    <div className="h-48 bg-zinc-100/50 dark:bg-zinc-900/50 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl flex flex-col items-center justify-center text-zinc-400 gap-2">
                                        <Truck size={32} />
                                        <p className="text-sm font-medium">No purchase orders found.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
