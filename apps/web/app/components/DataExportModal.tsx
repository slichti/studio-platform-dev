// Data Export Modal - Shows data table with checkbox selection for CSV export

import { useState, useEffect } from "react";
import { X, Download, CheckSquare, Square, Loader2 } from "lucide-react";
import { useAuth } from "@clerk/react-router";
import { apiRequest } from "../utils/api";

interface DataExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    tenantId: string;
    tenantName: string;
    dataType: 'subscribers' | 'financials' | 'products';
}

interface DataItem {
    id: string;
    [key: string]: any;
}

const DATA_TYPE_CONFIG = {
    subscribers: {
        title: 'Subscribers',
        endpoint: 'subscribers',
        columns: [
            { key: 'email', label: 'Email' },
            { key: 'firstName', label: 'First Name' },
            { key: 'lastName', label: 'Last Name' },
            { key: 'roles', label: 'Roles' },
            { key: 'status', label: 'Status' },
            { key: 'joinedAt', label: 'Joined' },
        ],
    },
    financials: {
        title: 'Financial Transactions',
        endpoint: 'transactions',
        columns: [
            { key: 'memberEmail', label: 'Member Email' },
            { key: 'memberName', label: 'Member Name' },
            { key: 'planName', label: 'Plan' },
            { key: 'amount', label: 'Amount' },
            { key: 'status', label: 'Status' },
            { key: 'createdAt', label: 'Date' },
        ],
    },
    products: {
        title: 'Products',
        endpoint: 'products',
        columns: [
            { key: 'sku', label: 'SKU' },
            { key: 'name', label: 'Name' },
            { key: 'price', label: 'Price' },
            { key: 'quantity', label: 'Qty' },
            { key: 'category', label: 'Category' },
            { key: 'isActive', label: 'Active' },
        ],
    },
};

export function DataExportModal({ isOpen, onClose, tenantId, tenantName, dataType }: DataExportModalProps) {
    const [data, setData] = useState<DataItem[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { getToken } = useAuth();

    const config = DATA_TYPE_CONFIG[dataType];

    useEffect(() => {
        if (isOpen) {
            fetchData();
        } else {
            // Reset on close
            setData([]);
            setSelectedIds(new Set());
            setError(null);
        }
    }, [isOpen, tenantId, dataType]);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = await getToken();
            const result = await apiRequest<DataItem[]>(`/admin/tenants/${tenantId}/${config.endpoint}`, token);
            setData(result);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelect = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === data.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(data.map(d => d.id)));
        }
    };

    const exportToCSV = () => {
        const selectedData = data.filter(d => selectedIds.has(d.id));
        if (selectedData.length === 0) return;

        // Build CSV
        const headers = config.columns.map(c => c.label);
        const rows = selectedData.map(item =>
            config.columns.map(c => {
                let value = item[c.key];
                // Format dates
                if (value instanceof Date || (typeof value === 'number' && c.key.includes('At'))) {
                    value = new Date(value).toLocaleDateString();
                }
                // Format booleans
                if (typeof value === 'boolean') {
                    value = value ? 'Yes' : 'No';
                }
                // Format currency
                if (c.key === 'amount' || c.key === 'price' || c.key === 'costPrice') {
                    value = `$${(value / 100).toFixed(2)}`;
                }
                // Escape commas and quotes
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    value = `"${value.replace(/"/g, '""')}"`;
                }
                return value ?? '';
            }).join(',')
        );

        const csv = [headers.join(','), ...rows].join('\n');

        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${tenantName.replace(/\s+/g, '_')}_${dataType}_export.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-zinc-900">{config.title}</h2>
                        <p className="text-sm text-zinc-500">{tenantName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-lg">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="animate-spin text-blue-600" size={32} />
                            <span className="ml-3 text-zinc-600">Loading data...</span>
                        </div>
                    ) : error ? (
                        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
                            Error: {error}
                        </div>
                    ) : data.length === 0 ? (
                        <div className="text-center py-12 text-zinc-500">
                            No {config.title.toLowerCase()} found for this tenant.
                        </div>
                    ) : (
                        <div className="border border-zinc-200 rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-zinc-50">
                                    <tr>
                                        <th className="w-12 px-4 py-3 text-left">
                                            <button
                                                onClick={toggleSelectAll}
                                                className="text-zinc-600 hover:text-zinc-900"
                                            >
                                                {selectedIds.size === data.length ? (
                                                    <CheckSquare size={18} className="text-blue-600" />
                                                ) : (
                                                    <Square size={18} />
                                                )}
                                            </button>
                                        </th>
                                        {config.columns.map(col => (
                                            <th key={col.key} className="px-4 py-3 text-left font-medium text-zinc-700">
                                                {col.label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                    {data.map(item => (
                                        <tr
                                            key={item.id}
                                            className={`hover:bg-zinc-50 ${selectedIds.has(item.id) ? 'bg-blue-50' : ''}`}
                                            onClick={() => toggleSelect(item.id)}
                                        >
                                            <td className="px-4 py-3">
                                                {selectedIds.has(item.id) ? (
                                                    <CheckSquare size={18} className="text-blue-600" />
                                                ) : (
                                                    <Square size={18} className="text-zinc-400" />
                                                )}
                                            </td>
                                            {config.columns.map(col => {
                                                let value = item[col.key];
                                                // Format display
                                                if (value instanceof Date || (typeof value === 'number' && col.key.includes('At'))) {
                                                    value = new Date(value).toLocaleDateString();
                                                }
                                                if (typeof value === 'boolean') {
                                                    value = value ? (
                                                        <span className="text-green-600">Yes</span>
                                                    ) : (
                                                        <span className="text-zinc-400">No</span>
                                                    );
                                                }
                                                if (col.key === 'amount' || col.key === 'price') {
                                                    value = `$${((value || 0) / 100).toFixed(2)}`;
                                                }
                                                return (
                                                    <td key={col.key} className="px-4 py-3 text-zinc-700">
                                                        {value ?? '-'}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-zinc-200 flex items-center justify-between bg-zinc-50">
                    <div className="text-sm text-zinc-600">
                        {selectedIds.size} of {data.length} selected
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-zinc-600 hover:bg-zinc-100 rounded-lg">
                            Cancel
                        </button>
                        <button
                            onClick={exportToCSV}
                            disabled={selectedIds.size === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Download size={16} />
                            Export Selected to CSV
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DataExportModal;
