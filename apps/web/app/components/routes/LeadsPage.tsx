
import { useLoaderData } from "react-router";
import { useState } from "react";
import { useAuth } from "@clerk/react-router";
import { Modal } from "../Modal";
import { Plus, Search, Phone, Mail, Clock, AlertCircle, CheckCircle, Pencil } from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "../../utils/api";
import { toast } from "sonner";

export default function LeadsPageComponent() {
    const { leads: initialLeads, token: loaderToken, slug } = useLoaderData<any>();
    const { getToken } = useAuth();
    const [leads, setLeads] = useState(initialLeads);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedLead, setSelectedLead] = useState<any>(null);
    const [leadTasks, setLeadTasks] = useState<any[]>([]);
    const [isTaskLoading, setIsTaskLoading] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [isEditingLead, setIsEditingLead] = useState(false);
    const [editFormData, setEditFormData] = useState<any>({});
    const [formData, setFormData] = useState({ firstName: "", lastName: "", email: "", phone: "", source: "", notes: "" });

    const openLeadDetail = async (lead: any) => {
        setSelectedLead(lead);
        setIsEditingLead(false);
        setEditFormData({ ...lead });
        setIsTaskLoading(true);
        try {
            const token = await getToken() ?? loaderToken;
            const tasks = await apiRequest(`/tasks?leadId=${lead.id}`, token, { headers: { 'X-Tenant-Slug': slug } });
            setLeadTasks(Array.isArray(tasks) ? tasks : []);
        } catch (e) { console.error(e); }
        finally { setIsTaskLoading(false); }
    };

    const handleUpdateLead = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = await getToken() ?? loaderToken;
            await apiRequest(`/leads/${selectedLead.id}`, token, {
                method: "PATCH",
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify(editFormData)
            });
            setSelectedLead({ ...selectedLead, ...editFormData });
            setLeads(leads.map((l: any) => l.id === selectedLead.id ? { ...l, ...editFormData } : l));
            setIsEditingLead(false);
            toast.success("Lead updated");
        } catch (e: any) { toast.error(e.message); }
    };

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskTitle) return;
        try {
            const token = await getToken() ?? loaderToken;
            const newTask = await apiRequest("/tasks", token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify({
                    title: newTaskTitle,
                    relatedLeadId: selectedLead.id,
                    status: 'todo',
                    priority: 'medium',
                    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000)
                })
            });
            setLeadTasks([newTask, ...leadTasks]);
            setNewTaskTitle("");
            toast.success("Task created");
        } catch (e: any) { toast.error(e.message); }
    };

    const toggleTaskStatus = async (taskId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'done' ? 'todo' : 'done';
        setLeadTasks(leadTasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
        const token = await getToken() ?? loaderToken;
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
            const token = await getToken() ?? loaderToken;
            const res: any = await apiRequest("/leads", token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify(formData)
            });
            if (res.error) toast.error(res.error);
            else {
                const refreshed: any = await apiRequest("/leads", token, { headers: { 'X-Tenant-Slug': slug } });
                setLeads(refreshed.leads || []);
                setIsAddOpen(false);
                setFormData({ firstName: "", lastName: "", email: "", phone: "", source: "", notes: "" });
                toast.success("Lead created");
            }
        } catch (e: any) { toast.error(e.message); }
        finally { setLoading(false); }
    };

    const handleStatusChange = async (leadId: string, newStatus: string) => {
        setLeads(leads.map((l: any) => l.id === leadId ? { ...l, status: newStatus } : l));
        try {
            const token = await getToken() ?? loaderToken;
            await apiRequest(`/leads/${leadId}`, token, {
                method: "PATCH",
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify({ status: newStatus })
            });
        } catch (e) { console.error(e); }
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
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8 text-zinc-900 dark:text-zinc-100">
                <div>
                    <h1 className="text-3xl font-bold">Leads CRM</h1>
                    <p className="text-zinc-500">Track and manage prospective students.</p>
                </div>
                <button onClick={() => setIsAddOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2">
                    <Plus size={18} /> Add New Lead
                </button>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                        <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search leads..." className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700" />
                    </div>
                    <div className="text-sm text-zinc-500">{filteredLeads.length} leads found</div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500">
                            <tr>
                                <th className="px-6 py-3 text-xs font-semibold uppercase">Name</th>
                                <th className="px-6 py-3 text-xs font-semibold uppercase">Contact</th>
                                <th className="px-6 py-3 text-xs font-semibold uppercase">Status</th>
                                <th className="px-6 py-3 text-xs font-semibold uppercase">Source</th>
                                <th className="px-6 py-3 text-xs font-semibold uppercase">Added</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {filteredLeads.map((lead: any) => (
                                <tr key={lead.id} onClick={() => openLeadDetail(lead)} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-zinc-900 dark:text-zinc-100">{lead.firstName} {lead.lastName}</div>
                                        <div className="text-xs text-zinc-400">{lead.notes}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                                        <div className="flex items-center gap-1"><Mail size={14} /> {lead.email}</div>
                                        {lead.phone && <div className="flex items-center gap-1"><Phone size={14} /> {lead.phone}</div>}
                                    </td>
                                    <td className="px-6 py-4 text-xs font-bold uppercase">
                                        <span className={`px-2 py-1 rounded ${getStatusColor(lead.status)}`}>{lead.status}</span>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-zinc-600 dark:text-zinc-400">{lead.source || 'Unknown'}</td>
                                    <td className="px-6 py-4 text-sm text-zinc-500"><Clock size={14} className="inline mr-1" /> {format(new Date(lead.createdAt), "MMM d")}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add New Lead">
                <form onSubmit={handleCreate} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <input value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} placeholder="First Name" required className="p-2 border rounded dark:bg-zinc-800" />
                        <input value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} placeholder="Last Name" className="p-2 border rounded dark:bg-zinc-800" />
                    </div>
                    <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="Email" required className="w-full p-2 border rounded dark:bg-zinc-800" />
                    <input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="Phone" className="w-full p-2 border rounded dark:bg-zinc-800" />
                    <select value={formData.source} onChange={e => setFormData({ ...formData, source: e.target.value })} className="w-full p-2 border rounded dark:bg-zinc-800">
                        <option value="">Select Source...</option>
                        <option value="Website">Website</option>
                        <option value="Social Media">Social Media</option>
                        <option value="Referral">Referral</option>
                    </select>
                    <textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Notes" className="w-full h-24 p-2 border rounded dark:bg-zinc-800" />
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setIsAddOpen(false)} className="flex-1 p-2 border rounded">Cancel</button>
                        <button type="submit" disabled={loading} className="flex-1 p-2 bg-blue-600 text-white rounded">{loading ? 'Adding...' : 'Add Lead'}</button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={!!selectedLead} onClose={() => setSelectedLead(null)} title={selectedLead ? `${selectedLead.firstName} ${selectedLead.lastName}` : ""}>
                {selectedLead && (
                    <div className="space-y-6">
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                            {isEditingLead ? (
                                <form onSubmit={handleUpdateLead} className="space-y-3">
                                    <div className="grid grid-cols-2 gap-2">
                                        <input value={editFormData.firstName} onChange={e => setEditFormData({ ...editFormData, firstName: e.target.value })} className="p-1 border rounded" />
                                        <input value={editFormData.lastName} onChange={e => setEditFormData({ ...editFormData, lastName: e.target.value })} className="p-1 border rounded" />
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <button onClick={() => setIsEditingLead(false)} className="px-2 py-1 text-xs border rounded">Cancel</button>
                                        <button type="submit" className="px-2 py-1 text-xs bg-blue-600 text-white rounded">Save</button>
                                    </div>
                                </form>
                            ) : (
                                <div className="flex justify-between">
                                    <h2 className="text-xl font-bold">{selectedLead.firstName} {selectedLead.lastName}</h2>
                                    <button onClick={() => setIsEditingLead(true)} className="text-zinc-400 hover:text-blue-600"><Pencil size={18} /></button>
                                </div>
                            )}
                        </div>
                        <div className="space-y-4">
                            <form onSubmit={handleCreateTask} className="flex gap-2">
                                <input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="Add a task..." className="flex-1 p-2 border rounded dark:bg-zinc-800" />
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Add</button>
                            </form>
                            <div className="space-y-2">
                                {leadTasks.map(task => (
                                    <div key={task.id} className="p-3 border rounded-lg flex items-center justify-between dark:bg-zinc-800 dark:border-zinc-700">
                                        <span className={task.status === 'done' ? 'line-through text-zinc-400' : ''}>{task.title}</span>
                                        <button onClick={() => toggleTaskStatus(task.id, task.status)} className={`w-5 h-5 rounded-full border ${task.status === 'done' ? 'bg-green-500 border-green-500' : ''}`}></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
