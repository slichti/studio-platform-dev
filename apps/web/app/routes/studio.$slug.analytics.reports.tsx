import { useOutletContext } from "react-router";
import { Mail, Plus, Trash2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

import { useReportSchedules, useReportScheduleMutations, useCustomReports } from "~/hooks/useAnalytics";

export default function AnalyticsReports() {
    const { tenant } = useOutletContext<{ tenant: any }>();
    const { data: schedules = [] } = useReportSchedules(tenant.slug);
    const { data: customReports = [] } = useCustomReports(tenant.slug);
    const { createMutation: createSchedule, deleteMutation: deleteSchedule } = useReportScheduleMutations(tenant.slug);

    const [isCreatingSchedule, setIsCreatingSchedule] = useState(false);
    const [newSchedule, setNewSchedule] = useState({ reportType: 'revenue', frequency: 'weekly', recipients: '', customReportId: '' });

    const handleCreateSchedule = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreatingSchedule(true);
        try {
            const recipients = newSchedule.recipients.split(',').map(r => r.trim()).filter(r => !!r);
            await createSchedule.mutateAsync({ ...newSchedule, recipients });
            toast.success("Schedule created");
            setNewSchedule({ reportType: 'revenue', frequency: 'weekly', recipients: '', customReportId: '' });
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setIsCreatingSchedule(false);
        }
    };

    return (
        <div className="animate-in fade-in duration-500 max-w-4xl">
            <div className="mb-8">
                <h2 className="text-xl font-semibold mb-2">Scheduled Reports</h2>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm">Automated email summaries delivered to your inbox.</p>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border border-blue-100 dark:border-blue-900/20 p-6 rounded-xl shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Create Schedule Form */}
                    <div className="bg-white dark:bg-zinc-900 p-5 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
                        <h4 className="font-semibold mb-4 text-sm flex items-center gap-2">
                            <Plus size={16} /> New Schedule
                        </h4>
                        <form onSubmit={handleCreateSchedule} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-500 mb-1">Report Type</label>
                                    <select
                                        value={newSchedule.reportType}
                                        onChange={e => setNewSchedule({ ...newSchedule, reportType: e.target.value })}
                                        className="w-full text-sm border rounded-md p-2 dark:bg-zinc-800"
                                    >
                                        <option value="revenue">Revenue</option>
                                        <option value="attendance">Attendance</option>
                                        <option value="journal">Journal</option>
                                        <option value="custom">Custom Report</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-500 mb-1">Frequency</label>
                                    <select
                                        value={newSchedule.frequency}
                                        onChange={e => setNewSchedule({ ...newSchedule, frequency: e.target.value })}
                                        className="w-full text-sm border rounded-md p-2 dark:bg-zinc-800"
                                    >
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                    </select>
                                </div>
                            </div>

                            {newSchedule.reportType === 'custom' && (
                                <div>
                                    <label className="block text-xs font-medium text-zinc-500 mb-1">Select Saved Report</label>
                                    <select
                                        value={newSchedule.customReportId}
                                        onChange={e => setNewSchedule({ ...newSchedule, customReportId: e.target.value })}
                                        className="w-full text-sm border rounded-md p-2 dark:bg-zinc-800"
                                        required
                                    >
                                        <option value="">-- Choose a report --</option>
                                        {customReports.map((r: any) => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-medium text-zinc-500 mb-1">Recipients (comma separated)</label>
                                <input
                                    placeholder="owner@example.com, manager@example.com"
                                    value={newSchedule.recipients}
                                    onChange={e => setNewSchedule({ ...newSchedule, recipients: e.target.value })}
                                    className="w-full text-sm border rounded-md p-2 dark:bg-zinc-800"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isCreatingSchedule}
                                className="w-full bg-blue-600 text-white rounded-md py-2 text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                                {isCreatingSchedule ? 'Creating...' : 'Create Email Schedule'}
                            </button>
                        </form>
                    </div>

                    {/* Existing Schedules */}
                    <div className="space-y-3">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                            <Calendar size={16} /> Active Schedules
                        </h4>
                        {schedules.length === 0 ? (
                            <div className="text-zinc-400 text-sm italic py-8 text-center border-2 border-dashed rounded-lg">No schedules configured.</div>
                        ) : (
                            schedules.map((s: any) => (
                                <div key={s.id} className="bg-white dark:bg-zinc-900 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 flex justify-between items-center shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center text-blue-600">
                                            <Mail size={18} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold capitalize">{s.reportType} {s.frequency}</div>
                                            <div className="text-xs text-zinc-500 truncate max-w-[200px]">{s.recipients.join(', ')}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            deleteSchedule.mutate(s.id);
                                            toast.success("Schedule deleted");
                                        }}
                                        className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
