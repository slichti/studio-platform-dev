import { useLoaderData, useOutletContext, Link, Form, useNavigation } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { BookOpen, GraduationCap, ChevronRight, Loader2, Key } from "lucide-react";
import { useState } from "react";
import { cn } from "~/utils/cn";

export const loader = async (args: LoaderFunctionArgs) => {
    let userId: string | null = null;
    let token: string | null = null;

    const cookie = args.request.headers.get("Cookie");
    const isDev = import.meta.env.DEV || process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

    if (isDev && cookie?.includes("__e2e_bypass_user_id=")) {
        const match = cookie.match(/__e2e_bypass_user_id=([^;]+)/);
        if (match) { userId = match[1]; token = userId; }
    }
    if (!userId) {
        const authResult = await getAuth(args);
        userId = authResult.userId;
        token = await authResult.getToken();
    }

    const { slug } = args.params;
    const headers = { 'X-Tenant-Slug': slug! };

    const [courses, enrollments] = await Promise.all([
        apiRequest(`/courses?status=active`, null, { headers }).catch(() => []),
        token ? apiRequest(`/courses/my-enrollments`, token, { headers }).catch(() => []) : [],
    ]);

    return { courses, enrollments };
};

export const action = async (args: ActionFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const { slug } = args.params;
    const formData = await args.request.formData();
    const intent = formData.get("intent") as string;
    const courseId = formData.get("courseId") as string;
    const headers = { 'X-Tenant-Slug': slug! };

    try {
        if (intent === "enroll") {
            await apiRequest(`/courses/${courseId}/enroll`, token, { method: 'POST', headers });
            return { success: true };
        }
        if (intent === "redeem") {
            const code = formData.get("code") as string;
            await apiRequest(`/courses/${courseId}/redeem`, token, {
                method: 'POST', body: JSON.stringify({ code }), headers
            });
            return { success: true, redeemed: true };
        }
    } catch (e: any) {
        // Handle specific prerequisite error
        if (e.status === 403 && e.message?.includes('Prerequisites not met')) {
            return { error: 'You must complete the prerequisite courses first.' };
        }
        return { error: 'Action failed: ' + (e.message || 'Unknown error') };
    }
    return null;
};

export default function PortalCoursesIndex() {
    const { courses, enrollments } = useLoaderData<typeof loader>();
    const { tenant } = useOutletContext<any>();
    const navigation = useNavigation();
    const slug = tenant?.slug;

    const [redeemCourseId, setRedeemCourseId] = useState<string | null>(null);

    const enrolledMap = new Map((enrollments as any[]).map((e: any) => [e.courseId, e]));
    const enrollingId = navigation.formData?.get("courseId") as string;

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                    <GraduationCap className="text-indigo-600" size={30} />
                    Courses
                </h1>
                <p className="text-zinc-500 dark:text-zinc-400 mt-1">Premium courses available from {tenant?.name}.</p>
            </div>

            {(courses as any[]).length === 0 && (
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
                    const isEnrolling = enrollingId === course.id;

                    return (
                        <div key={course.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition group flex flex-col">
                            {/* Thumbnail */}
                            <div className="aspect-video relative bg-zinc-100 dark:bg-zinc-800 flex-shrink-0">
                                {course.thumbnailUrl ? (
                                    <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-zinc-300 dark:text-zinc-700">
                                        <BookOpen size={48} />
                                    </div>
                                )}
                                {isEnrolled && (
                                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-zinc-200 dark:bg-zinc-700">
                                        <div className="h-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
                                    </div>
                                )}
                            </div>

                            {/* Body */}
                            <div className="p-5 flex flex-col gap-3 flex-1">
                                <div>
                                    <h3 className="font-bold text-lg leading-tight text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 transition-colors">
                                        {course.title}
                                    </h3>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-1">
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
                                            {progress >= 100 ? '✓ Completed' : `Continue (${progress}%)`}
                                            <ChevronRight size={14} />
                                        </Link>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            {/* Prerequisites Check */}
                                            {(() => {
                                                const prereqs = course.prerequisiteIds || [];
                                                const unmet = prereqs.filter((id: string) => {
                                                    const e = enrolledMap.get(id);
                                                    return !e || e.progress < 100;
                                                });
                                                const isLocked = unmet.length > 0;

                                                if (isLocked) {
                                                    const unmetNames = unmet.map((id: string) => {
                                                        const p = courses.find((c: any) => c.id === id);
                                                        return p?.title || 'Unknown Course';
                                                    });
                                                    return (
                                                        <div className="flex flex-col items-end">
                                                            <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-400">
                                                                <BookOpen size={14} className="text-zinc-500" /> Locked
                                                            </div>
                                                            <div className="text-[10px] text-zinc-400 mt-1 max-w-[150px] text-right leading-tight">
                                                                Requires: {unmetNames.join(', ')}
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <>
                                                        {/* N1: Access code redeem */}
                                                        <button
                                                            type="button"
                                                            title="Have an access code?"
                                                            onClick={() => setRedeemCourseId(redeemCourseId === course.id ? null : course.id)}
                                                            className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                                                        >
                                                            <Key size={15} />
                                                        </button>
                                                        <Form method="post">
                                                            <input type="hidden" name="courseId" value={course.id} />
                                                            <input type="hidden" name="intent" value="enroll" />
                                                            <button
                                                                type="submit"
                                                                disabled={isEnrolling}
                                                                className={cn(
                                                                    "px-4 py-1.5 rounded-lg text-sm font-semibold transition",
                                                                    "bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60"
                                                                )}
                                                            >
                                                                {isEnrolling ? <Loader2 size={14} className="animate-spin" /> : course.price > 0 ? 'Enroll' : 'Start Free'}
                                                            </button>
                                                        </Form>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>

                                {/* N1: Access code input */}
                                {redeemCourseId === course.id && (
                                    <Form method="post" className="flex gap-2 mt-1">
                                        <input type="hidden" name="courseId" value={course.id} />
                                        <input type="hidden" name="intent" value="redeem" />
                                        <input
                                            name="code"
                                            placeholder="Access code (e.g. YOGA2026)"
                                            className="flex-1 px-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                                            autoFocus
                                        />
                                        <button
                                            type="submit"
                                            className="px-3 py-1.5 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                                        >
                                            Redeem
                                        </button>
                                    </Form>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
