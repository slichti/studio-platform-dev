
import { useLoaderData, useFetcher, Link } from "react-router";

import { LoaderFunction, ActionFunction } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, GripVertical, Save, X, ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { ConfirmationDialog } from "~/components/Dialogs";

const API_URL = typeof window !== 'undefined' ? (window as any).ENV?.API_URL : '';

interface FAQ {
    id: string;
    category: string;
    question: string;
    answer: string;
    sortOrder: number;
    isActive: boolean;
}

const CATEGORIES = [
    { id: 'features', label: 'Features' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'support', label: 'Support' },
    { id: 'getting_started', label: 'Getting Started' }
];

export const loader: LoaderFunction = async (args: any) => {
    const { getToken, userId } = await getAuth(args);

    if (!userId) {
        throw new Response("Unauthorized", { status: 401 });
    }

    const token = await getToken();

    let faqs: FAQ[] = [];
    try {
        const res: any = await apiRequest("/faqs/admin", token);
        faqs = res.faqs || [];
    } catch (e) {
        console.error("Failed to load FAQs", e);
    }

    return { faqs, token };
};

export default function AdminFAQsPage() {
    const { faqs: initialFaqs, token } = useLoaderData<any>();
    const [faqs, setFaqs] = useState<FAQ[]>(initialFaqs);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<FAQ | null>(null);
    const [saving, setSaving] = useState(false);
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        category: 'features',
        question: '',
        answer: '',
        isActive: true
    });

    const resetForm = () => {
        setFormData({
            category: 'features',
            question: '',
            answer: '',
            isActive: true
        });
        setEditingId(null);
        setShowCreateForm(false);
    };

    const handleCreate = async () => {
        if (!formData.question.trim() || !formData.answer.trim()) {
            toast.error("Question and answer are required");
            return;
        }

        setSaving(true);
        try {
            const res: any = await apiRequest("/faqs/admin", token, {
                method: "POST",
                body: JSON.stringify({
                    ...formData,
                    sortOrder: faqs.length
                })
            }, API_URL);

            if (res.id) {
                setFaqs([...faqs, {
                    ...formData,
                    id: res.id,
                    sortOrder: faqs.length,
                    isActive: true
                }]);
                toast.success("FAQ created!");
                resetForm();
            } else {
                toast.error(res.error || "Failed to create FAQ");
            }
        } catch (e: any) {
            toast.error("Error: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleUpdate = async () => {
        if (!editingId || !formData.question.trim() || !formData.answer.trim()) {
            toast.error("Question and answer are required");
            return;
        }

        setSaving(true);
        try {
            const res: any = await apiRequest(`/faqs/admin/${editingId}`, token, {
                method: "PUT",
                body: JSON.stringify(formData)
            }, API_URL);

            if (res.success) {
                setFaqs(faqs.map(f => f.id === editingId ? { ...f, ...formData } : f));
                toast.success("FAQ updated!");
                resetForm();
            } else {
                toast.error(res.error || "Failed to update FAQ");
            }
        } catch (e: any) {
            toast.error("Error: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;

        try {
            const res: any = await apiRequest(`/faqs/admin/${deleteTarget.id}`, token, {
                method: "DELETE"
            }, API_URL);

            if (res.success) {
                setFaqs(faqs.filter(f => f.id !== deleteTarget.id));
                toast.success("FAQ deleted!");
            } else {
                toast.error(res.error || "Failed to delete FAQ");
            }
        } catch (e: any) {
            toast.error("Error: " + e.message);
        }
        setDeleteTarget(null);
    };

    const handleToggleActive = async (faq: FAQ) => {
        try {
            const res: any = await apiRequest(`/faqs/admin/${faq.id}`, token, {
                method: "PUT",
                body: JSON.stringify({ isActive: !faq.isActive })
            }, API_URL);

            if (res.success) {
                setFaqs(faqs.map(f => f.id === faq.id ? { ...f, isActive: !f.isActive } : f));
                toast.success(faq.isActive ? "FAQ hidden" : "FAQ visible");
            }
        } catch (e: any) {
            toast.error("Error: " + e.message);
        }
    };

    const startEdit = (faq: FAQ) => {
        setFormData({
            category: faq.category,
            question: faq.question,
            answer: faq.answer,
            isActive: faq.isActive
        });
        setEditingId(faq.id);
        setShowCreateForm(false);
    };

    const startCreate = () => {
        resetForm();
        setShowCreateForm(true);
    };

    const filteredFaqs = activeCategory === 'all'
        ? faqs
        : faqs.filter(f => f.category === activeCategory);

    return (
        <div className="max-w-5xl mx-auto py-8 px-4">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold">FAQ Management</h1>
                    <p className="text-zinc-500 text-sm">Manage frequently asked questions for the features page</p>
                </div>
                {!showCreateForm && !editingId && (
                    <button
                        onClick={startCreate}
                        className="inline-flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-lg hover:bg-zinc-800 transition"
                    >
                        <Plus size={16} />
                        Add FAQ
                    </button>
                )}
            </div>

            {/* Category Filter */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                <button
                    onClick={() => setActiveCategory('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${activeCategory === 'all'
                            ? 'bg-zinc-900 text-white'
                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                        }`}
                >
                    All ({faqs.length})
                </button>
                {CATEGORIES.map(cat => {
                    const count = faqs.filter(f => f.category === cat.id).length;
                    return (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${activeCategory === cat.id
                                    ? 'bg-zinc-900 text-white'
                                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                                }`}
                        >
                            {cat.label} ({count})
                        </button>
                    );
                })}
            </div>

            {/* Create/Edit Form */}
            {(showCreateForm || editingId) && (
                <div className="bg-white border border-zinc-200 rounded-xl p-6 mb-6 shadow-sm">
                    <h3 className="font-semibold text-lg mb-4">
                        {editingId ? 'Edit FAQ' : 'Create New FAQ'}
                    </h3>
                    <div className="grid gap-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">
                                Category *
                            </label>
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                            >
                                {CATEGORIES.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">
                                Question *
                            </label>
                            <input
                                type="text"
                                value={formData.question}
                                onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                                placeholder="e.g. How do I get started?"
                                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">
                                Answer *
                            </label>
                            <textarea
                                value={formData.answer}
                                onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                                placeholder="Provide a clear, helpful answer..."
                                rows={4}
                                className="w-full px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="isActive"
                                checked={formData.isActive}
                                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                className="w-4 h-4 rounded border-zinc-300"
                            />
                            <label htmlFor="isActive" className="text-sm text-zinc-600">
                                Visible on public page
                            </label>
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100">
                            <button
                                onClick={resetForm}
                                className="px-4 py-2 text-zinc-600 hover:bg-zinc-100 rounded-lg transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={editingId ? handleUpdate : handleCreate}
                                disabled={saving}
                                className="inline-flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-lg hover:bg-zinc-800 transition disabled:opacity-50"
                            >
                                {saving ? (
                                    <span className="animate-pulse">Saving...</span>
                                ) : (
                                    <>
                                        <Save size={16} />
                                        {editingId ? 'Update FAQ' : 'Create FAQ'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* FAQs List */}
            {filteredFaqs.length === 0 && !showCreateForm && (
                <div className="bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-xl p-12 text-center">
                    <HelpCircle className="h-16 w-16 text-zinc-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-zinc-700 mb-2">No FAQs yet</h3>
                    <p className="text-zinc-500 mb-6">
                        Create frequently asked questions to help users understand your platform.
                    </p>
                    <button
                        onClick={startCreate}
                        className="inline-flex items-center gap-2 bg-zinc-900 text-white px-5 py-2.5 rounded-lg hover:bg-zinc-800 transition"
                    >
                        <Plus size={18} />
                        Create Your First FAQ
                    </button>
                </div>
            )}

            {filteredFaqs.length > 0 && (
                <div className="space-y-3">
                    {filteredFaqs.map((faq) => (
                        <div
                            key={faq.id}
                            className={`bg-white border rounded-xl overflow-hidden transition-shadow ${faq.isActive ? 'border-zinc-200' : 'border-orange-200 bg-orange-50/50'
                                }`}
                        >
                            <div
                                className="flex items-start gap-3 p-4 cursor-pointer hover:bg-zinc-50"
                                onClick={() => setExpandedId(expandedId === faq.id ? null : faq.id)}
                            >
                                <GripVertical className="h-5 w-5 text-zinc-300 mt-0.5 cursor-grab" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${faq.category === 'features' ? 'bg-blue-100 text-blue-700' :
                                                faq.category === 'pricing' ? 'bg-green-100 text-green-700' :
                                                    faq.category === 'support' ? 'bg-purple-100 text-purple-700' :
                                                        'bg-orange-100 text-orange-700'
                                            }`}>
                                            {CATEGORIES.find(c => c.id === faq.category)?.label}
                                        </span>
                                        {!faq.isActive && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                                                Hidden
                                            </span>
                                        )}
                                    </div>
                                    <h4 className="font-medium text-zinc-900">{faq.question}</h4>
                                    {expandedId === faq.id && (
                                        <p className="text-zinc-600 text-sm mt-2 whitespace-pre-wrap">{faq.answer}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleToggleActive(faq); }}
                                        className={`p-2 rounded-lg transition ${faq.isActive
                                                ? 'text-zinc-400 hover:text-orange-600 hover:bg-orange-50'
                                                : 'text-orange-600 hover:text-green-600 hover:bg-green-50'
                                            }`}
                                        title={faq.isActive ? 'Hide' : 'Show'}
                                    >
                                        {faq.isActive ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); startEdit(faq); }}
                                        className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition"
                                        title="Edit"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(faq); }}
                                        className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                        title="Delete"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Delete Confirmation */}
            <ConfirmationDialog
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                title="Delete FAQ"
                message={`Are you sure you want to delete this FAQ? This action cannot be undone.`}
                confirmText="Delete"
                isDestructive={true}
            />
        </div>
    );
}
