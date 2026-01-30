import { useState } from "react";
import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRevalidator } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { Plus, Trash2, Edit2, Tag, Database, Save, X, Check } from "lucide-react";
import { toast } from "sonner";
import { ConfirmationDialog } from "~/components/Dialogs";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();

    // Fetch both tags and custom fields
    const [tags, customFields] = await Promise.all([
        apiRequest<any[]>("/tags", token),
        apiRequest<any[]>("/custom-fields", token)
    ]);

    return { tags, customFields, token };
};

export default function TagsAndFieldsSettings() {
    const { tags, customFields, token } = useLoaderData<typeof loader>();
    const { revalidate } = useRevalidator();
    const [activeTab, setActiveTab] = useState<'tags' | 'fields'>('tags');

    // Tags State
    const [isCreatingTag, setIsCreatingTag] = useState(false);
    const [editingTag, setEditingTag] = useState<any>(null);
    const [newTag, setNewTag] = useState({ name: "", color: "#3B82F6", description: "" });
    const [deleteTagId, setDeleteTagId] = useState<string | null>(null);

    // Fields State
    const [isCreatingField, setIsCreatingField] = useState(false);
    const [editingField, setEditingField] = useState<any>(null);
    const [newField, setNewField] = useState({
        entityType: "member", // default
        key: "",
        label: "",
        fieldType: "text",
        options: [],
        isRequired: false
    });
    const [deleteFieldId, setDeleteFieldId] = useState<string | null>(null);

    // --- Tag Handlers ---
    const handleSaveTag = async () => {
        try {
            if (editingTag) {
                await apiRequest(`/tags/${editingTag.id}`, token, {
                    method: "PUT",
                    body: JSON.stringify(newTag)
                });
                toast.success("Tag updated");
            } else {
                await apiRequest("/tags", token, {
                    method: "POST",
                    body: JSON.stringify(newTag)
                });
                toast.success("Tag created");
            }
            setIsCreatingTag(false);
            setEditingTag(null);
            setNewTag({ name: "", color: "#3B82F6", description: "" });
            revalidate();
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    const handleDeleteTag = async () => {
        if (!deleteTagId) return;
        try {
            await apiRequest(`/tags/${deleteTagId}`, token, { method: "DELETE" });
            toast.success("Tag deleted");
            revalidate();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setDeleteTagId(null);
        }
    };

    // --- Field Handlers ---
    const handleSaveField = async () => {
        try {
            // Simplified validation
            if (!newField.key) newField.key = newField.label.toLowerCase().replace(/\s+/g, '_');

            if (editingField) {
                await apiRequest(`/custom-fields/${editingField.id}`, token, {
                    method: "PUT",
                    body: JSON.stringify({
                        label: newField.label,
                        options: newField.options,
                        isRequired: newField.isRequired
                    })
                });
                toast.success("Field updated");
            } else {
                await apiRequest("/custom-fields", token, {
                    method: "POST",
                    body: JSON.stringify(newField)
                });
                toast.success("Field created");
            }
            setIsCreatingField(false);
            setEditingField(null);
            setNewField({ entityType: "member", key: "", label: "", fieldType: "text", options: [], isRequired: false });
            revalidate();
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    const handleDeleteField = async () => {
        if (!deleteFieldId) return;
        try {
            await apiRequest(`/custom-fields/${deleteFieldId}`, token, { method: "DELETE" });
            toast.success("Field deleted");
            revalidate();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setDeleteFieldId(null);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Tags & Custom Fields</h1>
                <p className="text-zinc-500 dark:text-zinc-400">Manage metadata for your members and classes.</p>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-zinc-200 dark:border-zinc-800 mb-6">
                <button
                    onClick={() => setActiveTab('tags')}
                    className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === 'tags'
                            ? "border-blue-600 text-blue-600"
                            : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                        }`}
                >
                    Member Tags
                </button>
                <button
                    onClick={() => setActiveTab('fields')}
                    className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === 'fields'
                            ? "border-blue-600 text-blue-600"
                            : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                        }`}
                >
                    Custom Fields
                </button>
            </div>

            {/* Tags View */}
            {activeTab === 'tags' && (
                <div>
                    <div className="flex justify-end mb-4">
                        <button
                            onClick={() => { setIsCreatingTag(true); setEditingTag(null); setNewTag({ name: "", color: "#3B82F6", description: "" }); }}
                            className="flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-lg hover:opacity-90 transition font-medium text-sm"
                        >
                            <Plus size={16} />
                            Create Tag
                        </button>
                    </div>

                    {(isCreatingTag || editingTag) && (
                        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 mb-6 animate-in fade-in slide-in-from-top-2">
                            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                                {editingTag ? "Edit Tag" : "New Tag"}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-500 mb-1">Name</label>
                                    <input
                                        type="text"
                                        value={newTag.name}
                                        onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
                                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm"
                                        placeholder="e.g. VIP"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-500 mb-1">Color</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={newTag.color}
                                            onChange={(e) => setNewTag({ ...newTag, color: e.target.value })}
                                            className="h-9 w-16 p-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg cursor-pointer"
                                        />
                                        <span className="text-sm font-mono text-zinc-500">{newTag.color}</span>
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-zinc-500 mb-1">Description</label>
                                    <input
                                        type="text"
                                        value={newTag.description || ""}
                                        onChange={(e) => setNewTag({ ...newTag, description: e.target.value })}
                                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm"
                                        placeholder="Optional description"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => { setIsCreatingTag(false); setEditingTag(null); }}
                                    className="px-3 py-2 text-sm text-zinc-600 hover:text-zinc-900"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveTag}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                                >
                                    <Save size={16} />
                                    Save Tag
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="grid gap-3">
                        {tags.length === 0 && !isCreatingTag && (
                            <div className="text-center py-12 text-zinc-500 bg-zinc-50 dark:bg-zinc-900/30 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                                <Tag className="mx-auto h-8 w-8 mb-3 opacity-50" />
                                <p>No tags created yet</p>
                            </div>
                        )}
                        {tags.map((tag: any) => (
                            <div key={tag.id} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: tag.color }} />
                                    <div>
                                        <h4 className="font-medium text-zinc-900 dark:text-zinc-100">{tag.name}</h4>
                                        {tag.description && <p className="text-xs text-zinc-500">{tag.description}</p>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            setEditingTag(tag);
                                            setNewTag({ name: tag.name, color: tag.color, description: tag.description });
                                            setIsCreatingTag(true);
                                        }}
                                        className="p-2 text-zinc-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => setDeleteTagId(tag.id)}
                                        className="p-2 text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Fields View */}
            {activeTab === 'fields' && (
                <div>
                    <div className="flex justify-end mb-4">
                        <button
                            onClick={() => { setIsCreatingField(true); setEditingField(null); setNewField({ entityType: "member", key: "", label: "", fieldType: "text", options: [], isRequired: false }); }}
                            className="flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-lg hover:opacity-90 transition font-medium text-sm"
                        >
                            <Plus size={16} />
                            Add Field
                        </button>
                    </div>

                    {(isCreatingField || editingField) && (
                        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 mb-6 animate-in fade-in slide-in-from-top-2">
                            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                                {editingField ? "Edit Field" : "New Custom Field"}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-500 mb-1">Entity</label>
                                    <select
                                        disabled={!!editingField}
                                        value={newField.entityType}
                                        onChange={(e) => setNewField({ ...newField, entityType: e.target.value })}
                                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                                    >
                                        <option value="member">Member</option>
                                        <option value="lead">Lead</option>
                                        <option value="class">Class</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-500 mb-1">Field Label</label>
                                    <input
                                        type="text"
                                        value={newField.label}
                                        onChange={(e) => setNewField({ ...newField, label: e.target.value })}
                                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm"
                                        placeholder="e.g. T-Shirt Size"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-500 mb-1">Type</label>
                                    <select
                                        disabled={!!editingField}
                                        value={newField.fieldType}
                                        onChange={(e) => setNewField({ ...newField, fieldType: e.target.value })}
                                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                                    >
                                        <option value="text">Text</option>
                                        <option value="number">Number</option>
                                        <option value="boolean">Yes/No</option>
                                        <option value="date">Date</option>
                                        <option value="select">Dropdown</option>
                                    </select>
                                </div>
                                <div className="flex items-center pt-6">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={newField.isRequired}
                                            onChange={(e) => setNewField({ ...newField, isRequired: e.target.checked })}
                                            className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-zinc-700 dark:text-zinc-300">Required Field</span>
                                    </label>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => { setIsCreatingField(false); setEditingField(null); }}
                                    className="px-3 py-2 text-sm text-zinc-600 hover:text-zinc-900"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveField}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                                >
                                    <Save size={16} />
                                    Save Field
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="grid gap-3">
                        {customFields.length === 0 && !isCreatingField && (
                            <div className="text-center py-12 text-zinc-500 bg-zinc-50 dark:bg-zinc-900/30 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                                <Database className="mx-auto h-8 w-8 mb-3 opacity-50" />
                                <p>No custom fields defined</p>
                            </div>
                        )}
                        {customFields.map((field: any) => (
                            <div key={field.id} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                            {field.entityType}
                                        </span>
                                        <h4 className="font-medium text-zinc-900 dark:text-zinc-100">{field.label}</h4>
                                    </div>
                                    <p className="text-xs text-zinc-500 flex items-center gap-2">
                                        Key: <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">{field.key}</code> • Type: {field.fieldType} {field.isRequired && "• Required"}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            setEditingField(field);
                                            setNewField({ ...field });
                                            setIsCreatingField(true);
                                        }}
                                        className="p-2 text-zinc-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => setDeleteFieldId(field.id)}
                                        className="p-2 text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <ConfirmationDialog
                isOpen={!!deleteTagId}
                onClose={() => setDeleteTagId(null)}
                onConfirm={handleDeleteTag}
                title="Delete Tag?"
                message="Are you sure you want to delete this tag? This will remove it from all members."
            />
            <ConfirmationDialog
                isOpen={!!deleteFieldId}
                onClose={() => setDeleteFieldId(null)}
                onConfirm={handleDeleteField}
                title="Delete Field?"
                message="Are you sure you want to delete this custom field? All data associated with this field will be lost."
            />
        </div>
    );
}
