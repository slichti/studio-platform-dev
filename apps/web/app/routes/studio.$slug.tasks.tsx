
import { useLoaderData } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { useState } from "react";
import { Modal } from "~/components/Modal";
import { Plus, Search, CheckCircle, Clock, Calendar, User, Filter, Trash2, MoreVertical, Pencil, X } from "lucide-react";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { format } from "date-fns";

export const loader = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const slug = args.params.slug;

    try {
        const tasks = await apiRequest("/tasks", token, { headers: { 'X-Tenant-Slug': slug } }) as any[];
        // Also fetch me to filter "mine"
        const me: any = await apiRequest("/tenant/me", token, { headers: { 'X-Tenant-Slug': slug } });
        return { initialTasks: tasks || [], me, token, slug };
    } catch (e: any) {
        return { initialTasks: [], me: null, token, slug, error: e.message };
    }
};

export default function TasksPage() {
    const { initialTasks, me, token, slug } = useLoaderData<any>();
    const [tasks, setTasks] = useState(initialTasks);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // Filter State
    const [filterAssignee, setFilterAssignee] = useState<'all' | 'mine'>('all');

    // Edit State
    // Edit State
    const [editingTask, setEditingTask] = useState<any>(null);
    const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        title: "",
        description: "",
        priority: "medium",
        status: "todo",
        dueDate: "",
        assignedToId: me?.id || ""
    });

    const refreshTasks = async () => {
        const res = await apiRequest("/tasks", token, { headers: { 'X-Tenant-Slug': slug } }) as any[];
        setTasks(res || []);
    };

    const handleOpenAdd = () => {
        setEditingTask(null);
        setFormData({ title: "", description: "", priority: "medium", status: "todo", dueDate: "", assignedToId: me?.id || "" });
        setIsAddOpen(true);
    };

    const handleOpenEdit = (task: any) => {
        setEditingTask(task);
        setFormData({
            title: task.title,
            description: task.description || "",
            priority: task.priority,
            status: task.status,
            dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : "",
            assignedToId: task.assignedToId || ""
        });
        setIsAddOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const endpoint = editingTask ? `/tasks/${editingTask.id}` : "/tasks";
            const method = editingTask ? "PATCH" : "POST";

            await apiRequest(endpoint, token, {
                method,
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify(formData)
            });
            await refreshTasks();
            setIsAddOpen(false);
        } catch (e: any) {
            alert("Failed to save task: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (taskId: string) => {
        setTaskToDelete(taskId);
    };

    const handleConfirmDelete = async () => {
        if (!taskToDelete) return;
        try {
            await apiRequest(`/tasks/${taskToDelete}`, token, {
                method: "DELETE",
                headers: { 'X-Tenant-Slug': slug }
            });
            setTasks(tasks.filter((t: any) => t.id !== taskToDelete));
            if (editingTask?.id === taskToDelete) setIsAddOpen(false);
            setTaskToDelete(null);
        } catch (e) {
            console.error(e);
        }
    };

    const handleQuickStatusChange = async (taskId: string, newStatus: string) => {
        setTasks(tasks.map((t: any) => t.id === taskId ? { ...t, status: newStatus } : t));
        try {
            await apiRequest(`/tasks/${taskId}`, token, {
                method: "PATCH",
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify({ status: newStatus })
            });
        } catch (e) { console.error(e); }
    };


    const filteredTasks = tasks.filter((t: any) => {
        if (filterAssignee === 'mine') return t.assignedToId === me?.id;
        return true;
    });

    const getPriorityColor = (p: string) => {
        switch (p) {
            case 'high': return 'text-red-700 bg-red-50 border-red-200';
            case 'medium': return 'text-orange-700 bg-orange-50 border-orange-200';
            case 'low': return 'text-blue-700 bg-blue-50 border-blue-200';
            default: return 'text-gray-700 bg-gray-50';
        }
    };

    const columns = [
        { id: 'todo', title: 'To Do', color: 'bg-zinc-100 dark:bg-zinc-800/50', border: 'border-zinc-200 dark:border-zinc-700' },
        { id: 'in_progress', title: 'In Progress', color: 'bg-blue-50/50 dark:bg-blue-900/10', border: 'border-blue-200 dark:border-blue-800' },
        { id: 'done', title: 'Done', color: 'bg-green-50/50 dark:bg-green-900/10', border: 'border-green-200 dark:border-green-800' }
    ];

    return (
        <div className="p-6 h-[calc(100vh-64px)] flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                            <CheckCircle size={24} />
                        </div>
                        Tasks Board
                    </h1>
                </div>
                <div className="flex gap-2 items-center">
                    <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
                        <button
                            onClick={() => setFilterAssignee('all')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${filterAssignee === 'all' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
                        >
                            All Tasks
                        </button>
                        <button
                            onClick={() => setFilterAssignee('mine')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${filterAssignee === 'mine' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
                        >
                            My Tasks
                        </button>
                    </div>
                    <button
                        onClick={handleOpenAdd}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2 shadow-sm transition-all hover:scale-105 active:scale-95"
                    >
                        <Plus size={18} />
                        New Task
                    </button>
                </div>
            </div>

            {/* Kanban Board */}
            <div className="flex-1 overflow-x-auto overflow-y-hidden">
                <div className="flex gap-6 h-full min-w-[1000px]">
                    {columns.map(col => {
                        const colTasks = filteredTasks.filter((t: any) => t.status === col.id);
                        return (
                            <div key={col.id} className={`flex-1 flex flex-col rounded-xl border ${col.border} ${col.color} backdrop-blur-sm min-w-[300px]`}>
                                <div className="p-4 flex items-center justify-between border-b border-inherit">
                                    <h3 className="font-semibold text-zinc-700 dark:text-zinc-200 flex items-center gap-2">
                                        {col.title}
                                        <span className="bg-white/50 dark:bg-black/20 px-2 py-0.5 rounded-full text-xs">
                                            {colTasks.length}
                                        </span>
                                    </h3>
                                    {col.id === 'todo' && (
                                        <button onClick={handleOpenAdd} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                                            <Plus size={16} />
                                        </button>
                                    )}
                                </div>
                                <div className="p-3 flex-1 overflow-y-auto space-y-3">
                                    {colTasks.map((task: any) => (
                                        <div
                                            key={task.id}
                                            onClick={() => handleOpenEdit(task)}
                                            className="bg-white dark:bg-zinc-800 p-4 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group animate-in fade-in slide-in-from-bottom-2 duration-300"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${getPriorityColor(task.priority)}`}>
                                                    {task.priority}
                                                </span>
                                                {col.id !== 'done' && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleQuickStatusChange(task.id, 'done'); }}
                                                        className="text-zinc-300 hover:text-green-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        title="Mark as Done"
                                                    >
                                                        <CheckCircle size={16} />
                                                    </button>
                                                )}
                                            </div>
                                            <h4 className="font-medium text-zinc-900 dark:text-zinc-100 mb-1 leading-snug">{task.title}</h4>
                                            {task.description && (
                                                <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-3">
                                                    {task.description}
                                                </p>
                                            )}

                                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-700/50">
                                                <div className="flex items-center gap-2">
                                                    {task.assignee?.userProfile?.firstName && (
                                                        <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold" title={task.assignee.userProfile.firstName}>
                                                            {task.assignee.userProfile.firstName[0]}
                                                        </div>
                                                    )}
                                                    {task.dueDate && (
                                                        <div className={`flex items-center gap-1 text-[10px] ${new Date(task.dueDate) < new Date() && task.status !== 'done' ? 'text-red-500 font-bold' : 'text-zinc-400'}`}>
                                                            <Calendar size={10} />
                                                            {format(new Date(task.dueDate), "MMM d")}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <Modal
                isOpen={isAddOpen}
                onClose={() => setIsAddOpen(false)}
                title={editingTask ? "Edit Task" : "Create New Task"}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1 dark:text-zinc-300">Task Title</label>
                        <input
                            required
                            className="w-full px-3 py-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                            placeholder="e.g. Follow up with John"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 dark:text-zinc-300">Description</label>
                        <textarea
                            className="w-full px-3 py-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 outline-none transition-all h-24 resize-none"
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Details about the task..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 dark:text-zinc-300">Status</label>
                            <select
                                className="w-full px-3 py-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                                value={formData.status}
                                onChange={e => setFormData({ ...formData, status: e.target.value })}
                            >
                                <option value="todo">To Do</option>
                                <option value="in_progress">In Progress</option>
                                <option value="done">Done</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 dark:text-zinc-300">Priority</label>
                            <select
                                className="w-full px-3 py-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                                value={formData.priority}
                                onChange={e => setFormData({ ...formData, priority: e.target.value })}
                            >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 dark:text-zinc-300">Due Date</label>
                            <input
                                type="date"
                                className="w-full px-3 py-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                                value={formData.dueDate}
                                onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 justify-end pt-6 border-t dark:border-zinc-700">
                        {editingTask && (
                            <button
                                type="button"
                                onClick={() => handleDelete(editingTask.id)}
                                className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg mr-auto flex items-center gap-2"
                            >
                                <Trash2 size={16} />
                                Delete
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setIsAddOpen(false)}
                            className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 shadow-sm hover:shadow active:scale-95 transition-all"
                        >
                            {loading ? "Saving..." : (editingTask ? "Save Changes" : "Create Task")}
                        </button>
                    </div>
                </form>
            </Modal>


            <ConfirmDialog
                open={!!taskToDelete}
                onOpenChange={(open) => !open && setTaskToDelete(null)}
                onConfirm={handleConfirmDelete}
                title="Delete Task"
                description="Are you sure you want to delete this task? This cannot be undone."
                confirmText="Delete"
                variant="destructive"
            />
        </div >
    );
}
