
import { Play, Pause, Trash2, Pencil, Calendar, Users, Clock, Zap, Target, Bell, X } from "lucide-react";

interface AutomationCardProps {
    automation: any;
    onEdit: (auto: any) => void;
    onToggle: (id: string) => void;
    onDelete: (id: string) => void;
    TRIGGERS: any[];
}

export function AutomationCard({ automation, onEdit, onToggle, onDelete, TRIGGERS }: AutomationCardProps) {
    const trigger = TRIGGERS.find(t => t.id === automation.triggerEvent) || TRIGGERS[0];
    const TriggerIcon = trigger.icon || Zap;

    return (
        <div className="group relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col h-full">
            {/* Gradient Header */}
            <div className={`h-24 w-full bg-gradient-to-r ${automation.isActive ? 'from-violet-500 to-fuchsia-500' : 'from-zinc-200 to-zinc-300 dark:from-zinc-800 dark:to-zinc-700'} relative p-4 flex justify-between items-start`}>
                <div className="bg-white/20 backdrop-blur-md p-2 rounded-xl text-white">
                    <TriggerIcon size={20} />
                </div>
                <div className="bg-white/90 dark:bg-black/80 backdrop-blur text-xs font-bold px-2 py-1 rounded-full uppercase tracking-widest text-zinc-900 dark:text-zinc-100">
                    {automation.isActive ? 'Active' : 'Paused'}
                </div>
            </div>

            <div className="p-5 flex-1 flex flex-col">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1 line-clamp-2 leading-tight">
                    {automation.name || automation.subject || "Untitled Automation"}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 font-medium uppercase tracking-wider">
                    {trigger.label}
                </p>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2 mt-auto mb-4">
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-lg">
                        <div className="text-xs text-zinc-400 mb-0.5">Runs</div>
                        <div className="font-bold text-zinc-900 dark:text-zinc-100">{automation.runCount || 0}</div>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-lg">
                        <div className="text-xs text-zinc-400 mb-0.5">Open Rate</div>
                        <div className="font-bold text-zinc-900 dark:text-zinc-100">--%</div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => onEdit(automation)}
                        className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        <Pencil size={14} /> Edit
                    </button>
                    <button
                        onClick={() => onToggle(automation.id)}
                        className={`p-2 rounded-lg transition-colors ${automation.isActive ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20' : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'}`}
                        title={automation.isActive ? "Pause" : "Activate"}
                    >
                        {automation.isActive ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <button
                        onClick={() => onDelete(automation.id)}
                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
