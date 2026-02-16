
import { useState } from "react";
import { useOutletContext, useParams } from "react-router";
import { Save, Plus, Trash2, ChevronRight, MessageSquare, CornerDownRight } from "lucide-react";
import { apiRequest } from "~/utils/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/Card";
import { toast } from "sonner";

// Types
interface ChatOption {
    id: string;
    label: string;
    type: "action" | "menu";
    children?: ChatOption[];
    actionType?: "message" | "link";
    payload?: string;
    routeToRole?: "owner" | "admin" | "instructor" | "support";
    autoReply?: string;
}

// Recursive Node Editor Component
const ConfigNode = ({ node, index, parentPath, onUpdate, onDelete }: {
    node: ChatOption,
    index: number,
    parentPath: number[],
    onUpdate: (n: ChatOption) => void,
    onDelete: () => void
}) => {
    const [expanded, setExpanded] = useState(true);

    return (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 overflow-hidden mb-2">
            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800">
                <button onClick={() => setExpanded(!expanded)} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded text-zinc-500 dark:text-zinc-400">
                    <ChevronRight size={14} className={`transition-transform ${expanded ? "rotate-90" : ""}`} />
                </button>
                <input
                    value={node.label}
                    onChange={(e) => onUpdate({ ...node, label: e.target.value })}
                    className="bg-transparent font-medium text-sm focus:outline-none flex-1 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
                    placeholder="Option Label"
                />
                <div className="flex items-center gap-1">
                    <select
                        value={node.type}
                        onChange={(e) => onUpdate({ ...node, type: e.target.value as any, children: e.target.value === 'menu' ? [] : undefined })}
                        className="text-xs border border-zinc-200 dark:border-zinc-700 rounded px-1 py-0.5 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200"
                    >
                        <option value="action">Action</option>
                        <option value="menu">Sub-Menu</option>
                    </select>
                    <button onClick={onDelete} className="text-red-500 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 size={14} /></button>
                </div>
            </div>

            {expanded && (
                <div className="p-3 space-y-3 bg-white dark:bg-zinc-900">
                    {node.type === 'action' ? (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block mb-1">Route To Role</label>
                                <select
                                    value={node.routeToRole || "support"}
                                    onChange={(e) => onUpdate({ ...node, routeToRole: e.target.value as any })}
                                    className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200 focus:ring-2 focus:ring-black dark:focus:ring-zinc-600 outline-none"
                                >
                                    <option value="support">General Support</option>
                                    <option value="instructor">Instructor</option>
                                    <option value="admin">Admin / Billing</option>
                                    <option value="owner">Owner</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block mb-1">Auto-Reply Message</label>
                                <input
                                    value={node.autoReply || ""}
                                    onChange={(e) => onUpdate({ ...node, autoReply: e.target.value })}
                                    className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1.5 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-200 focus:ring-2 focus:ring-black dark:focus:ring-zinc-600 outline-none"
                                    placeholder="Optional auto-reply..."
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="pl-4 border-l-2 border-zinc-100 dark:border-zinc-800">
                            {node.children?.map((child, i) => (
                                <ConfigNode
                                    key={child.id}
                                    node={child}
                                    index={i}
                                    parentPath={[...parentPath, i]}
                                    onUpdate={(updated) => {
                                        const newChildren = [...(node.children || [])];
                                        newChildren[i] = updated;
                                        onUpdate({ ...node, children: newChildren });
                                    }}
                                    onDelete={() => {
                                        const newChildren = [...(node.children || [])];
                                        newChildren.splice(i, 1);
                                        onUpdate({ ...node, children: newChildren });
                                    }}
                                />
                            ))}
                            <button
                                onClick={() => {
                                    const newChild: ChatOption = { id: crypto.randomUUID(), label: "New Option", type: "action" };
                                    onUpdate({ ...node, children: [...(node.children || []), newChild] });
                                }}
                                className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-medium mt-2 hover:underline"
                            >
                                <CornerDownRight size={12} /> Add Sub-Option
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default function ChatSettingsPage() {
    const { slug } = useParams();
    const { tenant } = useOutletContext<any>() || {};

    // Initial state from tenant settings or default
    const [config, setConfig] = useState<ChatOption[]>(
        tenant?.settings?.chatConfig || [
            {
                id: "init-1",
                label: "I have a question about classes",
                type: "action",
                actionType: "message",
                routeToRole: "instructor",
                autoReply: "An instructor will get back to you shortly."
            },
            {
                id: "init-2",
                label: "Billing Issue",
                type: "action",
                actionType: "message",
                routeToRole: "admin",
                autoReply: "We are checking your billing details."
            }
        ]
    );

    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            const token = await (window as any).Clerk?.session?.getToken();
            await apiRequest(`/tenant/settings`, token, {
                method: 'PATCH',
                headers: { 'X-Tenant-Slug': slug || '' },
                body: JSON.stringify({
                    settings: {
                        chatEnabled: tenant.settings?.chatEnabled, // Keep existing toggle state
                        chatConfig: config
                    }
                })
            });
            toast.success("Chat configuration saved!");
            window.location.reload();
        } catch (e: any) {
            toast.error(e.message || "Failed to save");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-4xl pb-20">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Chat Configuration</h1>
                    <p className="text-zinc-500 dark:text-zinc-400">Design the decision tree for your support chat.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors font-medium"
                >
                    {saving ? "Saving..." : <><Save size={16} /> Save Config</>}
                </button>
            </div>

            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Main Menu</CardTitle>
                        <CardDescription>
                            These are the top-level options users will see when they open the chat.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {config.map((node, i) => (
                            <ConfigNode
                                key={node.id || `node-${i}`}
                                node={node}
                                index={i}
                                parentPath={[i]}
                                onUpdate={(updated) => {
                                    const newConfig = [...config];
                                    newConfig[i] = updated;
                                    setConfig(newConfig);
                                }}
                                onDelete={() => {
                                    const newConfig = [...config];
                                    newConfig.splice(i, 1);
                                    setConfig(newConfig);
                                }}
                            />
                        ))}
                        <button
                            onClick={() => setConfig([...config, { id: crypto.randomUUID(), label: "New Option", type: "action" }])}
                            className="w-full py-3 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300 font-medium text-sm flex items-center justify-center gap-2 mt-4 transition-colors"
                        >
                            <Plus size={16} /> Add Root Option
                        </button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
