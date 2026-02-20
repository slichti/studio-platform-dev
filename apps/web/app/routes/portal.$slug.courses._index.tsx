import { useOutletContext, Link } from "react-router";
import { useState } from "react";
import { BookOpen, GraduationCap, Clock, ChevronRight, Globe, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react-router";
import { toast } from "sonner";
import { apiRequest } from "~/utils/api";
import { cn } from "~/utils/cn";

export default function PortalCoursesIndex() {
    const { tenant, me } = useOutletContext<any>();
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    const slug = tenant?.slug;

    const { data: courses = [], isLoading } = useQuery<any[]>({
        queryKey: ['portal-courses', slug],
        queryFn: () => apiRequest(`/courses?status=active`, null, { headers: { 'X-Tenant-Slug': slug } }),
        enabled: !!slug
    });

    // My enrollments — keyed by courseId for O(1) lookup
    const { data: enrollments = [] } = useQuery<any[]>({
        queryKey: ['my-enrollments', slug],
        queryFn: async () => {
            const token = await getToken();
            return apiRequest(`/courses/my-enrollments`, token, { headers: { 'X-Tenant-Slug': slug } }).catch(() => []);
        },
        enabled: !!slug
    });

    const enrolledMap = new Map((enrollments as any[]).map((e: any) => [e.courseId, e]));
    const [enrollingId, setEnrollingId] = useState<string | null>(null);

    const handleEnroll = async (courseId: string) => {
        setEnrollingId(courseId);
        try {
            const token = await getToken();
            await apiRequest(`/courses/${courseId}/enroll`, token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': slug }
            });
            queryClient.invalidateQueries({ queryKey: ['my-enrollments', slug] });
            toast.success("Enrolled! Start learning now.");
        } catch (e: any) {
            toast.error(e.message || 'Enrollment failed');
        } finally {
            setEnrollingId(null);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                    <GraduationCap className="text-indigo-600" size={30} />
                    Courses
                </h1>
                <p className="text-zinc-500 dark:text-zinc-400 mt-1">Premium courses available from {tenant?.name}.</p>
            </div>

            {isLoading && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-64 bg-zinc-100 dark:bg-zinc-800 rounded-2xl animate-pulse" />
                    ))}
                </div>
            )}

            {!isLoading && (courses as any[]).length === 0 && (
                <div className="p-16 text-center bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                    <BookOpen size={36} className="mx-auto text-zinc-300 mb-4" />
                    <p className="font-medium text-zinc-600 dark:text-zinc-400">No courses available yet.</p>
                    <p className="text-sm text-zinc-400 mt-1">Check back soon — new courses are coming!</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(courses as any[]).map((course: any) => {
                    const enrollment = enrolledMap.get(course.id);
                    const isEnrolled = !!enrollment;
                    const progress = enrollment?.progress ?? 0;

                    return (
                        <div key={course.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition group">
                            {/* Thumbnail */}
                            <div className="aspect-video relative bg-zinc-100 dark:bg-zinc-800">
                                {course.thumbnailUrl ? (
                                    <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-zinc-300 dark:text-zinc-700">
                                        <BookOpen size={48} />
                                    </div>
                                )}
                                {isEnrolled && (
                                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-200 dark:bg-zinc-700">
                                        <div className="h-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
                                    </div>
                                )}
                            </div>
                            {/* Body */}
                            <div className="p-5 flex flex-col gap-3">
                                <div>
                                    <h3 className="font-bold text-lg leading-tight text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 transition-colors">
                                        {course.title}
                                    </h3>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-1 min-h-[40px]">
                                        {course.description || 'No description provided.'}
                                    </p>
                                </div>
                                <div className="flex items-center justify-between mt-auto pt-3 border-t border-zinc-100 dark:border-zinc-800">
                                    <div>
                                        {course.price > 0 ? (
                                            <span className="font-bold text-indigo-600">${(course.price / 100).toFixed(2)}</span>
                                        ) : (
                                            <span className="font-bold text-green-600">Free</span>
                                        )}
                                    </div>
                                    {isEnrolled ? (
                                        <Link
                                            to={`/portal/${slug}/courses/${course.slug}`}
                                            className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                                        >
                                            {progress === 100 ? '✓ Completed' : `Continue (${progress}%)`}
                                            <ChevronRight size={14} />
                                        </Link>
                                    ) : (
                                        <button
                                            disabled={enrollingId === course.id}
                                            onClick={() => handleEnroll(course.id)}
                                            className={cn(
                                                "px-4 py-1.5 rounded-lg text-sm font-semibold transition",
                                                "bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60"
                                            )}
                                        >
                                            {enrollingId === course.id ? (
                                                <Loader2 size={14} className="animate-spin" />
                                            ) : course.price > 0 ? 'Enroll' : 'Start Free'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
