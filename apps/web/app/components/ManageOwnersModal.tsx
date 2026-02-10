import { useState, useEffect } from "react";
import { Modal } from "./Modal";
import { apiRequest } from "../utils/api";
import { useAuth } from "@clerk/react-router";
import { Activity, Trash2, Plus, User, AlertCircle } from "lucide-react";
import { ErrorDialog, SuccessDialog, ConfirmationDialog } from "./Dialogs";

interface ManageOwnersModalProps {
    isOpen: boolean;
    onClose: () => void;
    tenantId: string | null;
    tenantName: string;
}

interface Owner {
    userId: string;
    email: string;
    profile: any;
    memberId: string;
    roleId: string;
}

export function ManageOwnersModal({ isOpen, onClose, tenantId, tenantName }: ManageOwnersModalProps) {
    const { getToken } = useAuth();
    const [owners, setOwners] = useState<Owner[]>([]);
    const [loading, setLoading] = useState(false);
    const [addLoading, setAddLoading] = useState(false);
    const [newOwnerEmail, setNewOwnerEmail] = useState("");

    // Dialogs inside this modal context
    // Actually, maybe better to use the parent's dialogs or local self-contained ones? 
    // Let's use simple local state for valid feedback to keep it self-contained.
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && tenantId) {
            fetchOwners();
        } else {
            setOwners([]);
            setNewOwnerEmail("");
            setError(null);
            setSuccess(null);
        }
    }, [isOpen, tenantId]);

    const fetchOwners = async () => {
        if (!tenantId) return;
        setLoading(true);
        try {
            const token = await getToken();
            const res = await apiRequest<Owner[]>(`/admin/tenants/${tenantId}/owners`, token);
            setOwners(res);
        } catch (e: any) {
            setError(e.message || "Failed to load owners");
        } finally {
            setLoading(false);
        }
    };

    const handleAddOwner = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tenantId || !newOwnerEmail) return;

        setAddLoading(true);
        setError(null);
        try {
            const token = await getToken();
            const res: any = await apiRequest(`/admin/tenants/${tenantId}/owners`, token, {
                method: 'POST',
                body: JSON.stringify({ email: newOwnerEmail })
            });

            if (res.error) throw new Error(res.error);

            if (res.message) {
                // e.g. "User is already an owner"
                setSuccess(res.message);
            } else {
                setSuccess(`Successfully added ${newOwnerEmail} as an owner.`);
                setNewOwnerEmail("");
                fetchOwners(); // Refresh list
            }
        } catch (e: any) {
            setError(e.message || "Failed to add owner");
        } finally {
            setAddLoading(false);
        }
    };

    const handleRemoveOwner = async (userId: string) => {
        if (!tenantId) return;
        if (!confirm("Are you sure you want to remove this owner? They will lose administrative access.")) return;

        setLoading(true); // Global loading for the list
        try {
            const token = await getToken();
            const res: any = await apiRequest(`/admin/tenants/${tenantId}/owners/${userId}`, token, {
                method: 'DELETE'
            });

            if (res.error) throw new Error(res.error);

            setSuccess("Owner removed successfully.");
            fetchOwners();
        } catch (e: any) {
            setError(e.message || "Failed to remove owner");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Manage Owners: ${tenantName}`} maxWidth="max-w-2xl">
            <div className="space-y-6">
                {/* Feedback */}
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-200 p-3 rounded-lg text-sm flex items-start gap-2">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                        <div>{error}</div>
                    </div>
                )}
                {success && (
                    <div className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-200 p-3 rounded-lg text-sm">
                        {success}
                    </div>
                )}

                {/* List */}
                <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Current Owners</h4>
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-800">
                        {loading && owners.length === 0 ? (
                            <div className="p-4 text-center text-sm text-zinc-500">Loading...</div>
                        ) : owners.length === 0 ? (
                            <div className="p-4 text-center text-sm text-zinc-500">No owners found (this should not happen).</div>
                        ) : (
                            owners.map(owner => (
                                <div key={owner.userId} className="p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center text-blue-700 dark:text-blue-300">
                                            <User size={16} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                                {(owner.profile as any)?.firstName || 'User'} {(owner.profile as any)?.lastName || ''}
                                            </div>
                                            <div className="text-xs text-zinc-500 dark:text-zinc-400">{owner.email}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveOwner(owner.userId)}
                                        className="text-zinc-400 hover:text-red-600 transition-colors p-1"
                                        title="Remove Owner Access"
                                        disabled={owners.length <= 1} // Prevent removing last owner safety check in UI
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                    {owners.length <= 1 && owners.length > 0 && (
                        <p className="text-xs text-zinc-400 italic">You cannot remove the last owner.</p>
                    )}
                </div>

                {/* Add Form */}
                <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
                    <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Add New Owner</h4>
                    <form onSubmit={handleAddOwner} className="flex gap-2">
                        <input
                            type="email"
                            required
                            placeholder="Enter user email address"
                            className="flex-1 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={newOwnerEmail}
                            onChange={(e) => setNewOwnerEmail(e.target.value)}
                        />
                        <button
                            type="submit"
                            disabled={addLoading || !newOwnerEmail}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {addLoading ? <Activity className="animate-spin" size={16} /> : <Plus size={16} />}
                            Add Owner
                        </button>
                    </form>
                    <p className="text-xs text-zinc-500 mt-2">
                        The user must already have a platform account.
                    </p>
                </div>
            </div>
        </Modal>
    );
}
