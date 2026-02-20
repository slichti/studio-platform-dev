import { useParams, useOutletContext, Link } from "react-router";
import { useState } from "react";
import { ArrowLeft, CheckSquare, Video, Play, Lock, ChevronDown, ChevronRight, Award } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react-router";
import { toast } from "sonner";
import { apiRequest } from "~/utils/api";
import { cn } from "~/utils/cn";

function ItemIcon({ contentType, done }: { contentType: string; done: boolean }) {
    if (done) return <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 flex-shrink-0"><CheckSquare size={14} /></div>;
    if (contentType === 'video') return <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 flex-shrink-0"><Video size={14} /></div>;
    return <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 flex-shrink-0"><CheckSquare size={14} /></div>;
}

export default function PortalCourseViewer() {
    const { slug, courseSlug } = useParams();
    const { tenant, me } = useOutletContext<any>();
    const { getToken } = useAuth();
    const queryClient = useQueryClient();

    const [activeItemId, setActiveItemId] = useState<string | null>(null);

    // Fetch course by slug
    const { data: courses = [] } = useQuery<any[]>({
        queryKey: ['portal-courses', slug],
        queryFn: () => apiRequest(`/courses?status=active`, null, { headers: { 'X-Tenant-Slug': slug! } }),
        enabled: !!slug
    });
    const course = (courses as any[]).find((c: any) => c.slug === courseSlug);

    // Fetch full course details (curriculum)
    const { data: courseDetail, isLoading } = useQuery<any>({
        queryKey: ['portal-course-detail', slug, course?.id],
        queryFn: () => apiRequest(`/courses/${course.id}`, null, { headers: { 'X-Tenant-Slug': slug! } }),
        enabled: !!course?.id
    });

    // Fetch my enrollment
    const { data: enrollments = [] } = useQuery<any[]>({
        queryKey: ['my-enrollments', slug],
        queryFn: async () => {
            const token = await getToken();
            return apiRequest(`/courses/my-enrollments`, token, { headers: { 'X-Tenant-Slug': slug! } }).catch(() => []);
        },
        enabled: !!slug
    });
    const enrollment = (enrollments as any[]).find((e: any) => e.courseId === course?.id);
    const isEnrolled = !!enrollment;
    const progress = enrollment?.progress ?? 0;

    const curriculum: any[] = courseDetail?.curriculum || [];
    const sessions: any[] = courseDetail?.sessions || [];
    const activeItem = curriculum.find(i => i.id === activeItemId) || curriculum[0];

    const handleMarkComplete = async () => {
        if (!course?.id) return;
        const token = await getToken();
        const doneCount = curriculum.filter(i => i._done).length + 1;
        const newProgress = Math.round(Math.min(100, (doneCount / Math.max(1, curriculum.length)) * 100));
        try {
            await apiRequest(`/courses/${course.id}/progress`, token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify({ progress: newProgress })
            });
            queryClient.invalidateQueries({ queryKey: ['my-enrollments', slug] });
            if (newProgress === 100) toast.success("🎉 Course completed! Great work.");
            else toast.success("Progress updated!");
        } catch (e: any) {
            toast.error(e.message || 'Failed to update progress');
        }
    };

    if (!course) return (
        <div className="p-12 text-center text-zinc-500">
            Course not found. <Link to={`/portal/${slug}/courses`} className="text-indigo-600 underline">Browse all courses</Link>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto animate-in fade-in duration-500">
            {/* Back button */}
            <Link to={`/portal/${slug}/courses`} className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 mb-6 transition">
                <ArrowLeft size={14} /> Back to Courses
            </Link>

            {!isEnrolled ? (
                // ── Not enrolled: show course preview ──
                <div className="space-y-6">
                    <div className="aspect-video w-full bg-zinc-100 dark:bg-zinc-800 rounded-2xl overflow-hidden relative">
                        {course.thumbnailUrl
                            ? <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center"><Play size={48} className="text-zinc-300" /></div>
                        }
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                            <div className="text-center text-white">
                                <Lock size={32} className="mx-auto mb-2" />
                                <p className="font-bold">Enroll to access this course</p>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold">{course.title}</h1>
                        <p className="text-zinc-500 mt-2">{course.description}</p>
                    </div>
                    <Link to={`/portal/${slug}/courses`} className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition">
                        ← Go back and enroll
                    </Link>
                </div>
            ) : (
                // ── Enrolled: two-panel course viewer ──
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Content Panel */}
                    <div className="lg:col-span-2 space-y-4">
                        {/* Video or Quiz player area */}
                        {activeItem ? (
                            <div className="bg-black rounded-2xl overflow-hidden aspect-video flex items-center justify-center">
                                {activeItem.contentType === 'video' && activeItem.video?.cloudflareStreamId ? (
                                    <iframe
                                        src={`https://iframe.cloudflarestream.com/${activeItem.video.cloudflareStreamId}`}
                                        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                                        allowFullScreen
                                        className="w-full h-full"
                                    />
                                ) : activeItem.contentType === 'video' && activeItem.video?.r2Key ? (
                                    <video
                                        src={activeItem.video.r2Key}
                                        controls
                                        className="w-full h-full"
                                    />
                                ) : (
                                    <div className="text-center text-zinc-400">
                                        <CheckSquare size={48} className="mx-auto mb-3 text-green-400" />
                                        <p className="font-medium text-white">Quiz: {activeItem.quiz?.title}</p>
                                        <p className="text-sm mt-2 text-zinc-400">Open quiz in new tab to complete</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="aspect-video bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400">
                                Select a lesson from the right to begin.
                            </div>
                        )}

                        {activeItem && (
                            <div className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                                <div>
                                    <p className="font-bold">{activeItem.video?.title || activeItem.quiz?.title || 'Lesson'}</p>
                                    <p className="text-sm text-zinc-400 capitalize">{activeItem.contentType}</p>
                                </div>
                                <button
                                    onClick={handleMarkComplete}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition"
                                >
                                    ✓ Mark Complete
                                </button>
                            </div>
                        )}

                        {/* Live Sessions */}
                        {sessions.length > 0 && (
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-3">
                                <h3 className="font-bold text-sm uppercase tracking-wider text-zinc-500">Live Sessions</h3>
                                {sessions.map((s: any) => (
                                    <div key={s.id} className="flex items-center gap-3 p-2">
                                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center text-blue-600 flex-shrink-0">
                                            <Play size={14} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm truncate">{s.title}</p>
                                            <p className="text-xs text-zinc-400">{new Date(s.startTime).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Curriculum Sidebar */}
                    <div className="lg:col-span-1 space-y-3">
                        {/* Progress */}
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
                            <div className="flex justify-between text-sm font-medium mb-2">
                                <span className="text-zinc-600 dark:text-zinc-400">Your progress</span>
                                <span className="font-bold">{progress}%</span>
                            </div>
                            <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full">
                                <div className="h-full bg-indigo-600 rounded-full transition-all" style={{ width: `${progress}%` }} />
                            </div>
                        </div>

                        {/* H4: Certificate download — shown when course is complete */}
                        {progress >= 100 && course?.id && (
                            <a
                                href={`/api/${slug}/courses/${course.id}/certificate`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 w-full px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-700 dark:text-amber-400 font-semibold text-sm hover:bg-amber-100 dark:hover:bg-amber-900/30 transition"
                            >
                                <Award size={18} className="flex-shrink-0" />
                                🎓 Download Certificate
                            </a>
                        )}

                        {/* Lesson list */}
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
                                <h3 className="font-bold">Course Content</h3>
                                <p className="text-xs text-zinc-400">{curriculum.length} lessons</p>
                            </div>
                            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-96 overflow-y-auto">
                                {curriculum.length === 0 && (
                                    <p className="p-4 text-sm text-zinc-400">No content in this course yet.</p>
                                )}
                                {curriculum.map((item: any, idx: number) => {
                                    const isActive = activeItemId === item.id || (!activeItemId && idx === 0);
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => setActiveItemId(item.id)}
                                            className={cn(
                                                "w-full flex items-center gap-3 p-3 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
                                                isActive && "bg-indigo-50 dark:bg-indigo-900/20"
                                            )}
                                        >
                                            <ItemIcon contentType={item.contentType} done={false} />
                                            <div className="flex-1 min-w-0">
                                                <p className={cn("text-sm font-medium truncate", isActive && "text-indigo-600")}>
                                                    {item.video?.title || item.quiz?.title || 'Untitled'}
                                                </p>
                                                <p className="text-xs text-zinc-400 capitalize">{item.contentType}</p>
                                            </div>
                                            {isActive && <ChevronRight size={14} className="text-indigo-400 flex-shrink-0" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
