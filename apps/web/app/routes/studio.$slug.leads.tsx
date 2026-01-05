// @ts-ignore
import { useLoaderData } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { useState } from "react";
import { Modal } from "~/components/Modal";
import { Plus, Search, Phone, Mail, User, Clock, AlertCircle, CheckCircle, Calendar, Trash2, Pencil, Save, X } from "lucide-react";
import { format } from "date-fns";

export const loader = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const slug = args.params.slug;

    try {
        const res: any = await apiRequest("/leads", token, { headers: { 'X-Tenant-Slug': slug } });
        return { leads: res.leads || [], token, slug };
    } catch (e: any) {
        return { leads: [], token, slug, error: e.message };
    }
};

export default function LeadsPage() {
    const { leads: initialLeads, token, slug } = useLoaderData<any>();
    const [leads, setLeads] = useState(initialLeads);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");



    const [selectedLead, setSelectedLead] = useState<any>(null);
    const [leadTasks, setLeadTasks] = useState<any[]>([]);
    const [isTaskLoading, setIsTaskLoading] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState("");

    // Edit Lead State
    const [isEditingLead, setIsEditingLead] = useState(false);
    const [editFormData, setEditFormData] = useState<any>({});

    // Form State
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        source: "",
        notes: ""
    });

    const openLeadDetail = async (lead: any) => {
        setSelectedLead(lead);
        setIsEditingLead(false);
        setEditFormData({ ...lead }); // Init edit form
        setIsTaskLoading(true);
        try {
            const tasks = await apiRequest(`/tasks?leadId=${lead.id}`, token, { headers: { 'X-Tenant-Slug': slug } });
            setLeadTasks(Array.isArray(tasks) ? tasks : []);
        } catch (e) {
            console.error("Failed to load tasks", e);
        } finally {
            setIsTaskLoading(false);
        }
    };

    const handleUpdateLead = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await apiRequest(`/leads/${selectedLead.id}`, token, {
                method: "PATCH",
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify(editFormData)
            });
            // Update local state
            setSelectedLead({ ...selectedLead, ...editFormData });
            setLeads(leads.map((l: any) => l.id === selectedLead.id ? { ...l, ...editFormData } : l));
            setIsEditingLead(false);
        } catch (e: any) {
            alert("Failed to update lead: " + e.message);
        }
    };

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskTitle) return;
        try {
            const newTask = await apiRequest("/tasks", token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify({
                    title: newTaskTitle,
                    relatedLeadId: selectedLead.id,
                    status: 'todo',
                    priority: 'medium',
                    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
                })
            });
            // Update local state
            setLeadTasks([newTask, ...leadTasks]);
            setNewTaskTitle("");
        } catch (e: any) {
            alert("Failed to create task: " + e.message);
        }
    };

    const toggleTaskStatus = async (taskId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'done' ? 'todo' : 'done';
        setLeadTasks(leadTasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
        await apiRequest(`/tasks/${taskId}`, token, {
            method: "PATCH",
            headers: { 'X-Tenant-Slug': slug },
            body: JSON.stringify({ status: newStatus })
        });
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res: any = await apiRequest("/leads", token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify(formData)
            });

            if (res.error) {
                alert(res.error);
            } else {
                // Refresh
                const refreshed: any = await apiRequest("/leads", token, { headers: { 'X-Tenant-Slug': slug } });
                setLeads(refreshed.leads || []);
                setIsAddOpen(false);
                setFormData({ firstName: "", lastName: "", email: "", phone: "", source: "", notes: "" });
            }
        } catch (e: any) {
            alert("Failed to create lead: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (leadId: string, newStatus: string) => {
        // Optimistic
        setLeads(leads.map((l: any) => l.id === leadId ? { ...l, status: newStatus } : l));

        try {
            await apiRequest(`/leads/${leadId}`, token, {
                method: "PATCH",
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify({ status: newStatus })
            });
        } catch (e) {
            console.error(e);
            // Revert on error would be ideal here if strictly safe
        }
    };

    const filteredLeads = leads.filter((l: any) =>
        l.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.firstName + " " + l.lastName).toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'new': return 'bg-blue-100 text-blue-800';
            case 'contacted': return 'bg-yellow-100 text-yellow-800';
            case 'trialing': return 'bg-purple-100 text-purple-800';
            case 'converted': return 'bg-green-100 text-green-800';
            case 'lost': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto" >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Leads CRM</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">Track and manage prospective students.</p>
                </div>
                <button
                    onClick={() => setIsAddOpen(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2 shadow-sm transition-all hover:translate-y-[-1px]"
                >
                    <Plus size={18} />
                    Add New Lead
                </button>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
                {/* Toolbar */}
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search leads..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div className="text-sm text-zinc-500">
                        {filteredLeads.length} leads found
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                            <tr>
                                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Name</th>
                                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Contact</th>
                                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Source</th>
                                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Added</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {filteredLeads.map((lead: any) => (
                                <tr
                                    key={lead.id}
                                    onClick={() => openLeadDetail(lead)}
                                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs uppercase">
                                                {lead.firstName?.[0]}{lead.lastName?.[0]}
                                            </div>
                                            <div>
                                                <div className="font-medium text-zinc-900 dark:text-zinc-100">
                                                    {lead.firstName} {lead.lastName}
                                                </div>
                                                {lead.notes && (
                                                    <div className="text-xs text-zinc-400 truncate max-w-[200px]" title={lead.notes}>
                                                        {lead.notes}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
                                            <div className="flex items-center gap-2">
                                                <Mail size={14} className="text-zinc-400" />
                                                <span>{lead.email}</span>
                                            </div>
                                            {lead.phone && (
                                                <div className="flex items-center gap-2">
                                                    <Phone size={14} className="text-zinc-400" />
                                                    <span>{lead.phone}</span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <select
                                            value={lead.status}
                                            onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                                            className={`text-xs font-bold uppercase px-2 py-1 rounded border-none outline-none cursor-pointer focus:ring-2 focus:ring-blue-500/50 ${getStatusColor(lead.status)}`}
                                        >
                                            <option value="new">New</option>
                                            <option value="contacted">Contacted</option>
                                            <option value="trialing">Trialing</option>
                                            <option value="converted">Converted</option>
                                            <option value="lost">Lost</option>
                                        </select>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                                        {lead.source ? (
                                            <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-xs border border-zinc-200 dark:border-zinc-700">
                                                {lead.source}
                                            </span>
                                        ) : (
                                            <span className="text-zinc-400 text-xs italic">Unknown</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-zinc-500">
                                        <div className="flex items-center gap-1" title={new Date(lead.createdAt).toLocaleString()}>
                                            <Clock size={14} className="text-zinc-400" />
                                            {format(new Date(lead.createdAt), "MMM d")}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredLeads.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <AlertCircle size={32} className="text-zinc-300" />
                                            <p>No leads found matching your criteria.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal
                isOpen={isAddOpen}
                onClose={() => setIsAddOpen(false)}
                title="Add New Lead"
            >
                <form onSubmit={handleCreate} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">First Name</label>
                            <input
                                type="text"
                                required
                                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                value={formData.firstName}
                                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Last Name</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                value={formData.lastName}
                                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Email Address</label>
                        <input
                            type="email"
                            required
                            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Phone (Optional)</label>
                            <input
                                type="tel"
                                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Source</label>
                            <select
                                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                value={formData.source}
                                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                            >
                                <option value="">Select source...</option>
                                <option value="Walk-in">Walk-in</option>
                                <option value="Website">Website</option>
                                <option value="Referral">Referral</option>
                                <option value="Social Media">Social Media</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Notes</label>
                        <textarea
                            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Interests, goals, availability..."
                        ></textarea>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={() => setIsAddOpen(false)}
                            className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
                        >
                            {loading ? "Adding..." : "Add Lead"}
                        </button>
                    </div>
                </form>
            </Modal>


            {/* Lead Detail Modal */}
            < Modal
                isOpen={!!selectedLead
                }
                onClose={() => setSelectedLead(null)}
                title={selectedLead ? `${selectedLead.firstName} ${selectedLead.lastName}` : "Lead Details"}
            >
                {selectedLead && (
                    <div className="space-y-6">
                        {/* Header / Info */}
                        <div className="bg-zinc-50 dark:bg-zinc-800 p-4 rounded-lg flex flex-col gap-3 relative group">
                            <div className="flex justify-between items-start">
                                {isEditingLead ? (
                                    <form onSubmit={handleUpdateLead} className="w-full space-y-3">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-zinc-500 uppercase">First Name</label>
                                                <input className="w-full px-2 py-1 border rounded" value={editFormData.firstName} onChange={e => setEditFormData({ ...editFormData, firstName: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-zinc-500 uppercase">Last Name</label>
                                                <input className="w-full px-2 py-1 border rounded" value={editFormData.lastName} onChange={e => setEditFormData({ ...editFormData, lastName: e.target.value })} />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-zinc-500 uppercase">Email</label>
                                                <input className="w-full px-2 py-1 border rounded" value={editFormData.email} onChange={e => setEditFormData({ ...editFormData, email: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-zinc-500 uppercase">Phone</label>
                                                <input className="w-full px-2 py-1 border rounded" value={editFormData.phone} onChange={e => setEditFormData({ ...editFormData, phone: e.target.value })} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-zinc-500 uppercase">Notes</label>
                                            <textarea className="w-full px-2 py-1 border rounded h-20" value={editFormData.notes} onChange={e => setEditFormData({ ...editFormData, notes: e.target.value })} />
                                        </div>
                                        <div className="flex gap-2 justify-end">
                                            <button type="button" onClick={() => setIsEditingLead(false)} className="px-3 py-1 text-sm bg-zinc-200 rounded hover:bg-zinc-300">Cancel</button>
                                            <button type="submit" className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
                                        </div>
                                    </form>
                                ) : (
                                    <>
                                        <div>
                                            <h2 className="text-xl font-bold">{selectedLead.firstName} {selectedLead.lastName}</h2>
                                            <div className="text-sm text-zinc-500 flex gap-4 mt-1">
                                                <span className="flex items-center gap-1"><Mail size={14} /> {selectedLead.email}</span>
                                                {selectedLead.phone && <span className="flex items-center gap-1"><Phone size={14} /> {selectedLead.phone}</span>}
                                            </div>
                                        </div>
                                        <button onClick={() => setIsEditingLead(true)} className="p-2 text-zinc-400 hover:text-blue-600 rounded-full hover:bg-blue-50 transition-colors">
                                            <Pencil size={18} />
                                        </button>
                                    </>
                                )}
                            </div>

                            {!isEditingLead && (
                                <>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${getStatusColor(selectedLead.status)}`}>
                                            {selectedLead.status}
                                        </span>
                                        <span className="text-xs text-zinc-400">Added {format(new Date(selectedLead.createdAt), "MMM d, yyyy")}</span>
                                    </div>
                                    {selectedLead.notes && (
                                        <div className="mt-2 text-sm text-zinc-600 italic border-t border-zinc-200 dark:border-zinc-700 pt-3 relative pl-3">
                                            <span className="absolute left-0 top-3 bottom-0 w-1 bg-zinc-300 rounded-full"></span>
                                            "{selectedLead.notes}"
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Activity Timeline */}
                        <div>
                            <h3 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-4">
                                <Clock size={18} />
                                Activity Timeline
                            </h3>

                            <form onSubmit={handleCreateTask} className="flex gap-2 mb-6">
                                <div className="relative flex-1">
                                    <input
                                        className="w-full pl-9 pr-3 py-2 border rounded-lg bg-white dark:bg-zinc-800 dark:border-zinc-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="Add a new task or note..."
                                        value={newTaskTitle}
                                        onChange={e => setNewTaskTitle(e.target.value)}
                                    />
                                    <Plus className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                                </div>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm">Add</button>
                            </form>

                            <div className="relative pl-4 border-l-2 border-zinc-100 dark:border-zinc-800 space-y-6">
                                {leadTasks.map(task => (
                                    <div key={task.id} className="relative">
                                        {/* Dot */}
                                        <div className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-white dark:border-zinc-900 ${task.status === 'done' ? 'bg-green-500' : 'bg-blue-500'}`}></div>

                                        <div className="bg-white dark:bg-zinc-800 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow group">
                                            <div className="flex items-start gap-3">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); toggleTaskStatus(task.id, task.status); }}
                                                    className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${task.status === 'done' ? 'bg-green-500 border-green-500 text-white' : 'border-zinc-300 dark:border-zinc-600 hover:border-green-500'}`}
                                                >
                                                    {task.status === 'done' && <CheckCircle size={12} />}
                                                </button>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start">
                                                        <span className={`font-medium ${task.status === 'done' ? 'line-through text-zinc-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
                                                            {task.title}
                                                        </span>
                                                        <span className="text-[10px] text-zinc-400">
                                                            {task.dueDate ? format(new Date(task.dueDate), "MMM d") : 'No date'}
                                                        </span>
                                                    </div>
                                                    <div className="mt-1 flex gap-2">
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase ${task.priority === 'high' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-zinc-50 text-zinc-500 border-zinc-100'}`}>
                                                            {task.priority}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {leadTasks.length === 0 && (
                                    <div className="text-zinc-400 text-xs italic pl-2">No activity recorded yet.</div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                onClick={() => setSelectedLead(null)}
                                className="text-zinc-500 hover:text-zinc-700 text-sm"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}
            </Modal >
        </div >
    );
}
