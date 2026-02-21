import { useOutletContext } from "react-router";
import { Users, BookOpen, Calendar, ChevronDown, ChevronUp, Mail, CheckCircle2, Circle } from "lucide-react";
import React, { useState, useEffect } from "react";
import { apiRequest } from "~/utils/api";
import { ClientOnly } from "~/components/ClientOnly";
import { format } from "date-fns";
import { cn } from "~/utils/cn";

export default function AnalyticsEnrollments() {
    const { tenant, token } = useOutletContext<{ tenant: any, token: string }>();
    const [data, setData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const res = await apiRequest<{ items: any[] }>(`/reports/enrollments`, token, {
                    headers: { 'X-Tenant-Slug': tenant.slug }
                });
                setData(res.items || []);
            } catch (e: any) {
                setError(e.message || "Failed to load enrollments data.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [tenant.slug, token]);

    const toggleExpand = (id: string) => {
        const newSet = new Set(expandedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setExpandedIds(newSet);
    };

    if (isLoading) {
        return (
            <div className="space-y-4 animate-pulse">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 bg-zinc-100 dark:bg-zinc-800 rounded-xl" />
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 bg-red-50 text-red-600 rounded-xl border border-red-200">
                <p className="font-semibold">Error Loading Data</p>
                <p className="text-sm mt-1">{error}</p>
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-zinc-500 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl min-h-[300px]">
                <Users size={48} className="mb-4 text-zinc-300" />
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">No active enrollments</h3>
                <p className="text-sm max-w-sm text-center mt-2">There are no upcoming classes or active courses with enrollments right now.</p>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in duration-500">
            <div className="mb-8">
                <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
                    <Users size={24} className="text-blue-600" />
                    Enrollment Rosters
                </h2>
                <p className="text-zinc-500 text-sm">View and manage rosters for all active classes and courses.</p>
            </div>

            <div className="space-y-4">
                {data.map((item) => {
                    const isExpanded = expandedIds.has(item.id);
                    const isCourse = item.type === 'course';

                    return (
                        <div key={item.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-md">
                            {/* Header Row */}
                            <button
                                onClick={() => toggleExpand(item.id)}
                                className="w-full flex items-center justify-between p-5 text-left bg-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "p-2.5 rounded-lg flex-shrink-0",
                                        isCourse ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                                    )}>
                                        {isCourse ? <BookOpen size={20} /> : <Calendar size={20} />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</h3>
                                            <span className={cn(
                                                "text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border",
                                                isCourse
                                                    ? "bg-amber-50 text-amber-600 border-amber-200"
                                                    : "bg-blue-50 text-blue-600 border-blue-200"
                                            )}>
                                                {item.type}
                                            </span>
                                        </div>
                                        <p className="text-sm text-zinc-500 flex items-center gap-1.5">
                                            {isCourse ? (
                                                `Added ${format(new Date(item.date), 'MMM d, yyyy')}`
                                            ) : (
                                                format(new Date(item.date), 'EEE, MMM d • h:mm a')
                                            )}
                                            <span className="opacity-50">•</span>
                                            <span className="font-medium text-zinc-700 dark:text-zinc-300">
                                                {item.roster.length} {item.capacity ? `/ ${item.capacity}` : ''} Enrolled
                                            </span>
                                        </p>
                                    </div>
                                </div>
                                <div className="text-zinc-400">
                                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                </div>
                            </button>

                            {/* Roster List (Expanded) */}
                            {isExpanded && (
                                <div className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-5">
                                    {item.roster.length === 0 ? (
                                        <p className="text-sm text-zinc-500 py-4 text-center">No students currently enrolled.</p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left">
                                                <thead className="text-xs text-zinc-500 uppercase bg-zinc-100/50 dark:bg-zinc-800/20">
                                                    <tr>
                                                        <th className="px-4 py-3 font-medium rounded-l-lg">Student</th>
                                                        {isCourse ? (
                                                            <>
                                                                <th className="px-4 py-3 font-medium">Enrolled At</th>
                                                                <th className="px-4 py-3 font-medium">Progress</th>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <th className="px-4 py-3 font-medium">Type</th>
                                                                <th className="px-4 py-3 font-medium">Checked In</th>
                                                            </>
                                                        )}
                                                        <th className="px-4 py-3 font-medium rounded-r-lg">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                                                    {item.roster.map((student: any) => (
                                                        <tr key={student.bookingId || student.enrollmentId} className="hover:bg-zinc-100/30 dark:hover:bg-zinc-800/30">
                                                            <td className="px-4 py-3">
                                                                <div className="font-medium text-zinc-900 dark:text-zinc-100">{student.name}</div>
                                                                <div className="text-zinc-500 text-xs flex items-center gap-1 mt-0.5">
                                                                    <Mail size={12} />
                                                                    {student.email}
                                                                </div>
                                                            </td>

                                                            {isCourse ? (
                                                                <>
                                                                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                                                                        {student.enrolledAt ? format(new Date(student.enrolledAt), 'MM/dd/yy') : '-'}
                                                                    </td>
                                                                    <td className="px-4 py-3">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="w-16 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                                                                                <div
                                                                                    className={cn("h-full", student.progress === 100 ? "bg-green-500" : "bg-blue-500")}
                                                                                    style={{ width: `${student.progress || 0}%` }}
                                                                                />
                                                                            </div>
                                                                            <span className="text-xs text-zinc-500 font-medium">
                                                                                {student.progress || 0}%
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <td className="px-4 py-3">
                                                                        <span className="text-xs capitalize text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-md">
                                                                            {student.attendanceType?.replace('_', ' ')}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-4 py-3">
                                                                        {student.checkedIn ? (
                                                                            <span className="inline-flex items-center gap-1.5 text-green-600 font-medium text-xs bg-green-50 px-2 py-1 rounded-full border border-green-200">
                                                                                <CheckCircle2 size={14} /> Yes
                                                                            </span>
                                                                        ) : (
                                                                            <span className="inline-flex items-center gap-1.5 text-zinc-400 font-medium text-xs">
                                                                                <Circle size={14} /> No
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                </>
                                                            )}

                                                            <td className="px-4 py-3">
                                                                <span className={cn(
                                                                    "text-xs px-2.5 py-1 rounded-full font-medium capitalize",
                                                                    student.status === 'active' || student.status === 'confirmed'
                                                                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                                        : student.status === 'completed'
                                                                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                                                            : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                                                                )}>
                                                                    {student.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
