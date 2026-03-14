import { useState, useEffect } from "react";
import { type LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRevalidator, useParams } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { useAuth } from "@clerk/react-router";
import { apiRequest } from "~/utils/api";
import { Plus, Trash2, Edit2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { ConfirmationDialog } from "~/components/Dialogs";

export const loader = async (args: LoaderFunctionArgs) => {
    const { slug } = args.params;
    try {
        const { getToken } = await getAuth(args);
        const token = await getToken();
        if (!slug || !token) return { tags: [], error: "Unauthorized" };

        const tags = await apiRequest<any[]>("/tenant/tags", token, { headers: { "X-Tenant-Slug": slug } });
        return { tags: Array.isArray(tags) ? tags : [], error: null };
    } catch (e: any) {
        console.error("Member tags loader:", e);
        return { tags: [], error: e.message || "Failed to load tags" };
    }
};

const DISCOUNT_TYPES = [
    { value: "none", label: "No discount" },
    { value: "percent", label: "Percent off" },
    { value: "fixed", label: "Fixed amount off" },
];
const VISIBILITY_OPTIONS = [
    { value: "internal_only", label: "Internal only" },
    { value: "visible_to_member", label: "Visible to member" },
];

export default function MemberTagsSettings() {
    const { tags, error } = useLoaderData<typeof loader>();
    const revalidator = useRevalidator();
    const { slug } = useParams();
    const { getToken } = useAuth();

    useEffect(() => {
        if (error) toast.error(error);
    }, [error]);

    const [isCreating, setIsCreating] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [form, setForm] = useState({
        name: "",
        slug: "",
        description: "",
        color: "#6366f1",
        category: "",
        discountType: "none" as "none" | "percent" | "fixed",
        discountValue: 0,
        visibility: "internal_only" as "internal_only" | "visible_to_member",
    });

    const openCreate = () => {
        setEditing(null);
        setForm({
            name: "",
            slug: "",
            description: "",
            color: "#6366f1",
            category: "",
            discountType: "none",
            discountValue: 0,
            visibility: "internal_only",
        });
        setIsCreating(true);
    };

    const openEdit = (tag: any) => {
        setIsCreating(false);
        setEditing(tag);
        setForm({
            name: tag.name || "",
            slug: tag.slug || "",
            description: tag.description || "",
            color: tag.color || "#6366f1",
            category: tag.category || "",
            discountType: tag.discountType || "none",
            discountValue: tag.discountValue ?? 0,
            visibility: tag.visibility || "internal_only",
        });
    };

    const saveTag = async () => {
        const token = await getToken();
        if (!token || !slug) return;
        try {
            const body: any = {
                name: form.name.trim(),
                description: form.description.trim() || undefined,
                color: form.color || undefined,
                category: form.category.trim() || undefined,
                discountType: form.discountType,
                discountValue: form.discountType !== "none" ? form.discountValue : undefined,
                visibility: form.visibility,
            };
            if (form.slug.trim()) body.slug = form.slug.trim();

            if (editing) {
                await apiRequest(`/tenant/tags/${editing.id}`, token, {
                    method: "PUT",
                    headers: { "X-Tenant-Slug": slug },
                    body: JSON.stringify(body),
                });
                toast.success("Tag updated");
            } else {
                await apiRequest("/tenant/tags", token, {
                    method: "POST",
                    headers: { "X-Tenant-Slug": slug },
                    body: JSON.stringify(body),
                });
                toast.success("Tag created");
            }
            setIsCreating(false);
            setEditing(null);
            revalidator.revalidate();
        } catch (e: any) {
            toast.error(e.message || "Failed to save");
        }
    };

    const deleteTag = async () => {
        if (!deleteId) return;
        const token = await getToken();
        if (!token || !slug) return;
        try {
            await apiRequest(`/tenant/tags/${deleteId}`, token, {
                method: "DELETE",
                headers: { "X-Tenant-Slug": slug },
            });
            toast.success("Tag deleted");
            setDeleteId(null);
            revalidator.revalidate();
        } catch (e: any) {
            toast.error(e.message || "Failed to delete");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Member Tags</h1>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                        Create tags (e.g. Senior, Silver Sneakers) to apply discounts and restrict class registration.
                    </p>
                </div>
                <Button onClick={openCreate} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add tag
                </Button>
            </div>

            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20 px-4 py-3 text-sm text-red-800 dark:text-red-200">
                    {error}
                </div>
            )}

            {/* Tag list */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                {tags.length === 0 && !isCreating ? (
                    <div className="p-8 text-center text-zinc-500 dark:text-zinc-400">
                        No tags yet. Add a tag to get started.
                    </div>
                ) : (
                    <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {tags.map((tag: any) => (
                            <li key={tag.id} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div
                                        className="w-4 h-4 rounded flex-shrink-0"
                                        style={{ backgroundColor: tag.color || "#6366f1" }}
                                    />
                                    <div className="min-w-0">
                                        <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{tag.name}</div>
                                        <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-2 flex-wrap">
                                            <span className="font-mono">{tag.slug || tag.id}</span>
                                            {tag.category && <span>• {tag.category}</span>}
                                            {tag.discountType && tag.discountType !== "none" && (
                                                <span>
                                                    • {tag.discountType === "percent" ? `${tag.discountValue}% off` : `${(tag.discountValue / 100).toFixed(2)} off`}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <Button variant="ghost" size="sm" onClick={() => openEdit(tag)} className="gap-1">
                                        <Edit2 className="w-3.5 h-3.5" /> Edit
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(tag.id)} className="text-red-600 hover:text-red-700 gap-1">
                                        <Trash2 className="w-3.5 h-3.5" /> Delete
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Create / Edit form */}
            {(isCreating || editing) && (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
                    <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">{editing ? "Edit tag" : "New tag"}</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                placeholder="e.g. Silver Sneakers"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Slug (optional)</Label>
                            <Input
                                value={form.slug}
                                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                                placeholder="e.g. silver-sneakers"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Description (optional)</Label>
                        <Input
                            value={form.description}
                            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                            placeholder="Brief description"
                        />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Category (optional)</Label>
                            <Input
                                value={form.category}
                                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                                placeholder="e.g. pricing, access"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Color</Label>
                            <div className="flex gap-2">
                                <input
                                    type="color"
                                    value={form.color}
                                    onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                                    className="h-10 w-14 rounded border border-zinc-300 dark:border-zinc-600 cursor-pointer"
                                />
                                <Input
                                    value={form.color}
                                    onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                                    className="flex-1 font-mono"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Discount type</Label>
                            <select
                                value={form.discountType}
                                onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value as any }))}
                                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                            >
                                {DISCOUNT_TYPES.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                        {form.discountType !== "none" && (
                            <div className="space-y-2">
                                <Label>Discount value {form.discountType === "percent" ? "(%)" : "(cents)"}</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    max={form.discountType === "percent" ? 100 : undefined}
                                    value={form.discountValue}
                                    onChange={(e) => setForm((f) => ({ ...f, discountValue: parseInt(e.target.value, 10) || 0 }))}
                                />
                            </div>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label>Visibility</Label>
                        <select
                            value={form.visibility}
                            onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value as any }))}
                            className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                        >
                            {VISIBILITY_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex gap-2 pt-2">
                        <Button onClick={saveTag} className="gap-2">
                            <Save className="w-4 h-4" /> Save
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => { setIsCreating(false); setEditing(null); }}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            )}

            <ConfirmationDialog
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                title="Delete tag"
                message="Are you sure? Members will lose this tag and any discount or class eligibility tied to it."
                confirmText="Delete"
                onConfirm={deleteTag}
                isDestructive
            />
        </div>
    );
}
