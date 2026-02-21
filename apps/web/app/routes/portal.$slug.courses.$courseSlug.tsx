import { useLoaderData, useOutletContext, Link, Form, useNavigation, useFetcher } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import {
    ArrowLeft, CheckSquare, Video, Play, Lock, ChevronRight, Award,
    FileText, ClipboardList, MessageSquare, Send, CheckCircle2, XCircle,
    RotateCcw, AlertCircle, ThumbsUp
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "~/utils/cn";
import DOMPurify from "isomorphic-dompurify";

function ItemIcon({ contentType, done }: { contentType: string; done: boolean }) {
    if (done) return <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 flex-shrink-0"><CheckSquare size={14} /></div>;
    if (contentType === 'video') return <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 flex-shrink-0"><Video size={14} /></div>;
    if (contentType === 'article') return <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 flex-shrink-0"><FileText size={14} /></div>;
    if (contentType === 'assignment') return <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 flex-shrink-0"><ClipboardList size={14} /></div>;
    if (contentType === 'quiz') return <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 flex-shrink-0"><CheckSquare size={14} /></div>;
    return <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 flex-shrink-0"><Play size={14} /></div>;
}

// ── Quiz Player component ─────────────────────────────────────────────────────
function QuizPlayer({ quiz, slug, courseId, existingSubmission }: {
    quiz: any; slug: string; courseId: string; existingSubmission: any;
}) {
    const fetcher = useFetcher<any>();
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [submitted, setSubmitted] = useState(!!existingSubmission);
    const [result, setResult] = useState<any>(existingSubmission ?? null);
    const [retaking, setRetaking] = useState(false);

    const questions: any[] = quiz.questions ?? [];
    const isSubmitting = fetcher.state !== 'idle';
    const showResult = submitted && result && !retaking;

    useEffect(() => {
        if (fetcher.data && !fetcher.data.error) {
            setResult(fetcher.data);
            setSubmitted(true);
            setRetaking(false);
        }
    }, [fetcher.data]);

    const handleSubmit = () => {
        if (Object.keys(answers).length < questions.filter(q => q.questionType !== 'short_answer').length && questions.length > 0) {
            // allow partial submission
        }
        const formData = new FormData();
        formData.set('intent', 'quiz-submit');
        formData.set('quizId', quiz.id);
        formData.set('courseId', courseId);
        formData.set('answers', JSON.stringify(answers));
        fetcher.submit(formData, { method: 'post' });
    };

    if (questions.length === 0) {
        return (
            <div className="p-8 text-center text-zinc-400">
                <CheckSquare size={48} className="mx-auto mb-3 text-zinc-300" />
                <p className="font-medium">This quiz has no questions yet.</p>
            </div>
        );
    }

    if (showResult) {
        const passed = result.passed;
        return (
            <div className="p-8 max-w-2xl mx-auto w-full">
                <div className={cn(
                    "rounded-2xl p-8 text-center mb-6 border",
                    passed
                        ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                        : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                )}>
                    {passed
                        ? <CheckCircle2 size={48} className="mx-auto mb-3 text-green-500" />
                        : <XCircle size={48} className="mx-auto mb-3 text-red-500" />
                    }
                    <h2 className={cn("text-3xl font-bold mb-1", passed ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400")}>
                        {passed ? 'Passed! 🎉' : 'Not Passed'}
                    </h2>
                    <p className="text-zinc-500 text-lg">
                        Score: <span className="font-bold text-zinc-900 dark:text-zinc-100">{result.score}%</span>
                        {result.passingScore > 0 && <> &middot; Required: {result.passingScore}%</>}
                    </p>
                </div>

                {/* Per-question breakdown */}
                {Array.isArray(result.graded) && result.graded.length > 0 && (
                    <div className="space-y-3 mb-6">
                        <h3 className="font-semibold text-zinc-700 dark:text-zinc-300">Answer Breakdown</h3>
                        {result.graded.map((g: any, i: number) => {
                            const q = questions.find(q => q.id === g.questionId);
                            return (
                                <div key={g.questionId} className={cn(
                                    "flex items-start gap-3 p-4 rounded-xl border",
                                    g.isCorrect
                                        ? "bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900"
                                        : "bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900"
                                )}>
                                    {g.isCorrect
                                        ? <CheckCircle2 size={18} className="text-green-500 mt-0.5 flex-shrink-0" />
                                        : <XCircle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
                                    }
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm">{q?.questionText ?? `Question ${i + 1}`}</p>
                                        {g.explanation && (
                                            <p className="text-xs text-zinc-500 mt-1 italic">{g.explanation}</p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <button
                    onClick={() => { setRetaking(true); setAnswers({}); setResult(null); }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition font-medium"
                >
                    <RotateCcw size={16} /> Retake Quiz
                </button>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 max-w-2xl mx-auto w-full space-y-6">
            <div className="mb-2">
                <h2 className="text-2xl font-bold">{quiz.title}</h2>
                {quiz.description && <p className="text-zinc-500 mt-1 text-sm">{quiz.description}</p>}
                {quiz.passingScore > 0 && (
                    <p className="text-xs text-zinc-400 mt-1">Passing score: {quiz.passingScore}%</p>
                )}
            </div>

            {questions.map((q: any, idx: number) => (
                <div key={q.id} className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 p-5">
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                        <span className="text-zinc-400 mr-2">{idx + 1}.</span>{q.questionText}
                    </p>

                    {q.questionType === 'multiple_choice' && Array.isArray(q.options) && (
                        <div className="space-y-2">
                            {(q.options as any[]).map((opt: any) => {
                                const val = typeof opt === 'object' ? opt.val ?? opt.value ?? opt.label : opt;
                                const label = typeof opt === 'object' ? opt.label ?? opt.val : opt;
                                const isSelected = answers[q.id] === val;
                                return (
                                    <label key={val} className={cn(
                                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition",
                                        isSelected
                                            ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-700"
                                            : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 bg-white dark:bg-zinc-900"
                                    )}>
                                        <input
                                            type="radio"
                                            name={`q_${q.id}`}
                                            value={val}
                                            checked={isSelected}
                                            onChange={() => setAnswers(a => ({ ...a, [q.id]: val }))}
                                            className="sr-only"
                                        />
                                        <div className={cn(
                                            "w-4 h-4 rounded-full border-2 flex-shrink-0 transition",
                                            isSelected ? "border-indigo-600 bg-indigo-600" : "border-zinc-300 dark:border-zinc-600"
                                        )} />
                                        <span className="text-sm">{label}</span>
                                    </label>
                                );
                            })}
                        </div>
                    )}

                    {q.questionType === 'true_false' && (
                        <div className="flex gap-3">
                            {['true', 'false'].map(val => (
                                <label key={val} className={cn(
                                    "flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition font-medium capitalize",
                                    answers[q.id] === val
                                        ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300"
                                        : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900"
                                )}>
                                    <input type="radio" name={`q_${q.id}`} value={val}
                                        checked={answers[q.id] === val}
                                        onChange={() => setAnswers(a => ({ ...a, [q.id]: val }))}
                                        className="sr-only"
                                    />
                                    {val}
                                </label>
                            ))}
                        </div>
                    )}

                    {q.questionType === 'short_answer' && (
                        <textarea
                            rows={3}
                            className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-indigo-500 transition resize-none"
                            placeholder="Type your answer..."
                            value={answers[q.id] ?? ''}
                            onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                        />
                    )}
                </div>
            ))}

            {fetcher.data?.error && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                    <AlertCircle size={16} /> {fetcher.data.error}
                </div>
            )}

            <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition disabled:opacity-60"
            >
                {isSubmitting ? 'Submitting…' : 'Submit Quiz'}
            </button>
        </div>
    );
}

// ── Comments section ──────────────────────────────────────────────────────────
function CommentsSection({ itemId, courseId, slug, comments, onCommentAdded }: {
    itemId: string; courseId: string; slug: string; comments: any[]; onCommentAdded: () => void;
}) {
    const fetcher = useFetcher<any>();
    const [text, setText] = useState('');
    const isSubmitting = fetcher.state !== 'idle';

    useEffect(() => {
        if (fetcher.data && !fetcher.data.error) {
            setText('');
            onCommentAdded();
        }
    }, [fetcher.data, onCommentAdded]);

    const handleSubmit = () => {
        if (!text.trim()) return;
        const fd = new FormData();
        fd.set('intent', 'comment-add');
        fd.set('courseId', courseId);
        fd.set('collectionItemId', itemId);
        fd.set('content', text.trim());
        fetcher.submit(fd, { method: 'post' });
    };

    return (
        <div className="mt-6 border-t border-zinc-100 dark:border-zinc-800 pt-6">
            <h3 className="font-bold text-sm uppercase tracking-wider text-zinc-500 mb-4 flex items-center gap-2">
                <MessageSquare size={14} /> Discussion ({comments.length})
            </h3>

            {comments.length > 0 && (
                <div className="space-y-3 mb-4">
                    {comments.map((c: any) => (
                        <div key={c.id} className="flex gap-3">
                            <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 text-xs font-bold flex-shrink-0">
                                {c.authorId?.[0]?.toUpperCase() ?? '?'}
                            </div>
                            <div className="flex-1 bg-zinc-50 dark:bg-zinc-800 rounded-xl px-4 py-3">
                                <p className="text-sm">{c.content}</p>
                                <p className="text-[10px] text-zinc-400 mt-1">
                                    {c.createdAt ? new Date(typeof c.createdAt === 'number' ? c.createdAt * 1000 : c.createdAt).toLocaleDateString() : ''}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex gap-2">
                <textarea
                    rows={2}
                    className="flex-1 px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-indigo-500 transition resize-none"
                    placeholder="Add a comment or question…"
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(); }}
                />
                <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !text.trim()}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition disabled:opacity-50 flex-shrink-0 self-end"
                >
                    <Send size={16} />
                </button>
            </div>
        </div>
    );
}

// ── Loader ────────────────────────────────────────────────────────────────────
export const loader = async (args: LoaderFunctionArgs) => {
    let token: string | null = null;

    const cookie = args.request.headers.get("Cookie");
    const isDev = import.meta.env.DEV || process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

    if (isDev && cookie?.includes("__e2e_bypass_user_id=")) {
        const match = cookie.match(/__e2e_bypass_user_id=([^;]+)/);
        if (match) token = match[1];
    }
    if (!token) {
        const { getToken } = await getAuth(args);
        token = await getToken();
    }

    const { slug, courseSlug } = args.params;
    const headers = { 'X-Tenant-Slug': slug! };

    const allCourses: any[] = await apiRequest(`/courses?status=active`, null, { headers }).catch(() => []);
    const course = allCourses.find((c: any) => c.slug === courseSlug);

    if (!course) return { course: null, courseDetail: null, enrollment: null };

    const [courseDetail, enrollments] = await Promise.all([
        apiRequest(`/courses/${course.id}`, null, { headers }).catch(() => null),
        token ? apiRequest(`/courses/my-enrollments`, token, { headers }).catch(() => []) : [],
    ]);

    const enrollment = (enrollments as any[]).find((e: any) => e.courseId === course.id) ?? null;
    const curriculum: any[] = courseDetail?.curriculum ?? [];

    const prereqs = courseDetail?.prerequisiteIds || [];
    const unmet = prereqs.filter((id: string) => {
        const e = (enrollments as any[]).find((e: any) => e.courseId === id);
        return !e || e.progress < 100;
    });
    const isLocked = unmet.length > 0;
    const unmetNames = unmet.map((id: string) => {
        const p = allCourses.find((c: any) => c.id === id);
        return p?.title || 'Unknown Course';
    });

    // Batch-fetch student's existing submissions, completions & lesson comments when enrolled
    let myQuizSubmissions: Record<string, any> = {};
    let myAssignmentSubmissions: Record<string, any> = {};
    let lessonComments: Record<string, any[]> = {};
    let completedItemIds: Set<string> = new Set();

    if (token && enrollment) {
        const quizItems = curriculum.filter(i => i.quizId);
        const assignmentItems = curriculum.filter(i => i.assignmentId);

        const [quizSubResults, assignSubResults, commentResults, completions] = await Promise.all([
            Promise.all(quizItems.map(i =>
                apiRequest(`/courses/quiz/${i.quizId}/my-submission`, token!, { headers }).catch(() => null)
            )),
            Promise.all(assignmentItems.map(i =>
                apiRequest(`/courses/assignments/${i.assignmentId}/my-submission`, token!, { headers }).catch(() => null)
            )),
            Promise.all(curriculum.map(i =>
                apiRequest(`/courses/comments/${i.id}`, token!, { headers }).catch(() => [])
            )),
            apiRequest(`/courses/${course.id}/my-completions`, token!, { headers }).catch(() => []),
        ]);

        quizItems.forEach((item, i) => {
            if (quizSubResults[i]) myQuizSubmissions[item.quizId] = quizSubResults[i];
        });
        assignmentItems.forEach((item, i) => {
            if (assignSubResults[i]) myAssignmentSubmissions[item.assignmentId] = assignSubResults[i];
        });
        curriculum.forEach((item, i) => {
            lessonComments[item.id] = (commentResults[i] as any[]) ?? [];
        });
        completedItemIds = new Set((completions as any[]).map((c: any) => c.itemId));
    }

    return {
        course, courseDetail, enrollment, slug, isLocked, unmetNames,
        myQuizSubmissions, myAssignmentSubmissions, lessonComments,
        completedItemIds: [...completedItemIds],
    };
};

// ── Action ────────────────────────────────────────────────────────────────────
export const action = async (args: ActionFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const { slug } = args.params;
    const formData = await args.request.formData();
    const intent = formData.get("intent") as string;
    const headers = { 'X-Tenant-Slug': slug! };

    try {
        if (intent === "progress") {
            const courseId = formData.get("courseId") as string;
            const itemId = formData.get("itemId") as string;
            if (itemId) {
                // Per-lesson completion (Tier 2)
                await apiRequest(`/courses/${courseId}/curriculum/${itemId}/complete`, token, {
                    method: 'POST', headers,
                });
            } else {
                // Fallback: manual progress update
                const progress = Number(formData.get("progress"));
                await apiRequest(`/courses/${courseId}/progress`, token, {
                    method: 'POST', body: JSON.stringify({ progress }), headers,
                });
            }
            return { success: true };
        }

        if (intent === "assignment-submit") {
            const assignmentId = formData.get("assignmentId") as string;
            const content = formData.get("content") as string;
            await apiRequest(`/courses/assignments/${assignmentId}/submit`, token, {
                method: 'POST', body: JSON.stringify({ content }), headers,
            });
            return { success: true, intent: 'assignment-submit' };
        }

        if (intent === "quiz-submit") {
            const quizId = formData.get("quizId") as string;
            const answersJson = formData.get("answers") as string;
            const answers = JSON.parse(answersJson || '{}');
            const result = await apiRequest(`/courses/quiz/${quizId}/submit`, token, {
                method: 'POST', body: JSON.stringify({ answers }), headers,
            });
            return { ...(result as object), intent: 'quiz-submit' };
        }

        if (intent === "comment-add") {
            const courseId = formData.get("courseId") as string;
            const collectionItemId = formData.get("collectionItemId") as string;
            const content = formData.get("content") as string;
            await apiRequest(`/courses/comments`, token, {
                method: 'POST', body: JSON.stringify({ courseId, collectionItemId, content }), headers,
            });
            return { success: true, intent: 'comment-add' };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed', intent };
    }
    return null;
};

// ── Main component ────────────────────────────────────────────────────────────
export default function PortalCourseViewer() {
    const {
        course, courseDetail, enrollment, slug, isLocked, unmetNames,
        myQuizSubmissions, myAssignmentSubmissions, lessonComments, completedItemIds: initialCompletedIds,
    } = useLoaderData<typeof loader>();
    const { tenant } = useOutletContext<any>();
    const navigation = useNavigation();

    const [activeItemId, setActiveItemId] = useState<string | null>(null);
    const [localComments, setLocalComments] = useState<Record<string, any[]>>(lessonComments ?? {});
    const [doneItems, setDoneItems] = useState<Set<string>>(new Set(initialCompletedIds ?? []));

    const isEnrolled = !!enrollment;
    const progress = enrollment?.progress ?? 0;
    const curriculum: any[] = courseDetail?.curriculum || [];
    const sessions: any[] = courseDetail?.sessions || [];
    const activeItem = curriculum.find(i => i.id === activeItemId) || curriculum[0] || null;
    const isSubmitting = navigation.state === 'submitting';

    const doneCount = doneItems.size;
    const newProgress = curriculum.length > 0
        ? Math.round(Math.min(100, ((doneCount + 1) / curriculum.length) * 100))
        : 100;

    if (!course) return (
        <div className="p-12 text-center text-zinc-500">
            Course not found. <Link to={`/portal/${slug ?? tenant?.slug}/courses`} className="text-indigo-600 underline">Browse all courses</Link>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto animate-in fade-in duration-500">
            <Link to={`/portal/${slug ?? tenant?.slug}/courses`} className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 mb-6 transition">
                <ArrowLeft size={14} /> Back to Courses
            </Link>

            {isLocked ? (
                <div className="space-y-6">
                    <div className="aspect-video w-full bg-zinc-100 dark:bg-zinc-800 rounded-2xl overflow-hidden relative">
                        {course.thumbnailUrl
                            ? <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover opacity-50 grayscale" />
                            : <div className="w-full h-full flex items-center justify-center"><Lock size={64} className="text-zinc-300 dark:text-zinc-700" /></div>
                        }
                        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/60 backdrop-blur-[2px]">
                            <div className="text-center text-white p-8 max-w-lg bg-black/40 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-md">
                                <Lock size={48} className="mx-auto mb-4 text-zinc-300" />
                                <h2 className="text-2xl font-bold mb-2">Course Locked</h2>
                                <p className="text-zinc-300 mb-6">Complete the following prerequisites first:</p>
                                <ul className="text-left bg-black/30 rounded-xl p-4 space-y-3 mb-8">
                                    {(unmetNames ?? []).map((name: string, i: number) => (
                                        <li key={i} className="flex items-center gap-3 font-medium">
                                            <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
                                                <Lock size={12} className="text-zinc-400" />
                                            </div>
                                            {name}
                                        </li>
                                    ))}
                                </ul>
                                <Link to={`/portal/${slug ?? tenant?.slug}/courses`} className="inline-block px-8 py-3 bg-white text-black rounded-xl font-bold hover:bg-zinc-200 transition">
                                    ← Browse Catalog
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            ) : !isEnrolled ? (
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
                    <Link to={`/portal/${slug ?? tenant?.slug}/courses`} className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition">
                        ← Go back and enroll
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* ── Main Content Panel ── */}
                    <div className="lg:col-span-2 space-y-4">
                        {activeItem ? (
                            <div className={cn(
                                "rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800",
                                activeItem.contentType === 'video'
                                    ? "bg-black aspect-video"
                                    : "bg-white dark:bg-zinc-900"
                            )}>
                                {/* Video */}
                                {activeItem.contentType === 'video' && activeItem.video?.cloudflareStreamId && (
                                    <iframe
                                        src={`https://iframe.cloudflarestream.com/${activeItem.video.cloudflareStreamId}`}
                                        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                                        allowFullScreen className="w-full h-full"
                                        title={activeItem.video?.title || 'Video'}
                                    />
                                )}
                                {activeItem.contentType === 'video' && activeItem.video?.r2Key && !activeItem.video?.cloudflareStreamId && (
                                    <video src={activeItem.video.r2Key} controls className="w-full h-full" />
                                )}
                                {activeItem.contentType === 'video' && !activeItem.video && (
                                    <div className="w-full h-full flex items-center justify-center text-zinc-400">
                                        <Play size={48} />
                                    </div>
                                )}

                                {/* Quiz */}
                                {activeItem.contentType === 'quiz' && activeItem.quiz && (
                                    <QuizPlayer
                                        quiz={activeItem.quiz}
                                        slug={slug ?? tenant?.slug}
                                        courseId={course.id}
                                        existingSubmission={myQuizSubmissions?.[activeItem.quizId] ?? null}
                                    />
                                )}

                                {/* Article */}
                                {activeItem.contentType === 'article' && (
                                    <div className="p-8 w-full">
                                        <h2 className="text-3xl font-bold mb-6">{activeItem.article?.title}</h2>
                                        {activeItem.article?.readingTimeMinutes > 0 && (
                                            <p className="text-sm text-zinc-400 mb-6">{activeItem.article.readingTimeMinutes} min read</p>
                                        )}
                                        <div className="prose dark:prose-invert max-w-none">
                                            {activeItem.article?.html ? (
                                                <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(activeItem.article.html) }} />
                                            ) : (
                                                <p className="text-zinc-500 italic">This article is currently empty.</p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Assignment */}
                                {activeItem.contentType === 'assignment' && (
                                    <AssignmentSection
                                        item={activeItem}
                                        existingSubmission={myAssignmentSubmissions?.[activeItem.assignmentId] ?? null}
                                    />
                                )}
                            </div>
                        ) : (
                            <div className="aspect-video bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400">
                                Select a lesson from the sidebar to begin.
                            </div>
                        )}

                        {/* Lesson info + mark complete */}
                        {activeItem && (() => {
                            const isActiveDone = doneItems.has(activeItem.id)
                                || (activeItem.quizId && !!myQuizSubmissions?.[activeItem.quizId])
                                || (activeItem.assignmentId && !!myAssignmentSubmissions?.[activeItem.assignmentId]);

                            return (
                                <div className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                                    <div>
                                        <p className="font-bold">{activeItem.video?.title || activeItem.quiz?.title || activeItem.article?.title || activeItem.assignment?.title || 'Lesson'}</p>
                                        <p className="text-sm text-zinc-400 capitalize">{activeItem.contentType}</p>
                                    </div>
                                    {!isActiveDone && activeItem.contentType !== 'quiz' && activeItem.contentType !== 'assignment' && (
                                        <Form method="post" onSubmit={() => setDoneItems(d => new Set([...d, activeItem.id]))}>
                                            <input type="hidden" name="intent" value="progress" />
                                            <input type="hidden" name="courseId" value={course.id} />
                                            <input type="hidden" name="itemId" value={activeItem.id} />
                                            <button
                                                type="submit"
                                                disabled={isSubmitting}
                                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-60"
                                            >
                                                {isSubmitting ? 'Saving…' : '✓ Mark Complete'}
                                            </button>
                                        </Form>
                                    )}
                                    {isActiveDone && (
                                        <span className="flex items-center gap-1.5 text-sm font-semibold text-green-600">
                                            <CheckCircle2 size={16} /> Completed
                                        </span>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Comments */}
                        {activeItem && (
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
                                <CommentsSection
                                    itemId={activeItem.id}
                                    courseId={course.id}
                                    slug={slug ?? tenant?.slug}
                                    comments={localComments[activeItem.id] ?? []}
                                    onCommentAdded={() => {
                                        // Optimistically add a placeholder — real data on next page reload
                                        setLocalComments(lc => ({
                                            ...lc,
                                            [activeItem.id]: [...(lc[activeItem.id] ?? []), {
                                                id: Date.now().toString(), content: '(your comment)', authorId: 'me', createdAt: Math.floor(Date.now() / 1000)
                                            }]
                                        }));
                                    }}
                                />
                            </div>
                        )}

                        {/* Live sessions */}
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

                    {/* ── Sidebar ── */}
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

                        {/* Certificate */}
                        {progress >= 100 && course?.id && (
                            <a
                                href={`/portal/${slug ?? tenant?.slug}/courses/${course.slug}/certificate`}
                                target="_blank" rel="noreferrer"
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
                            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[28rem] overflow-y-auto">
                                {curriculum.length === 0 && (
                                    <p className="p-4 text-sm text-zinc-400">No content in this course yet.</p>
                                )}
                                {curriculum.map((item: any, idx: number) => {
                                    const isActive = activeItemId === item.id || (!activeItemId && idx === 0);
                                    const isDone = doneItems.has(item.id)
                                        || (item.quizId && !!myQuizSubmissions?.[item.quizId])
                                        || (item.assignmentId && !!myAssignmentSubmissions?.[item.assignmentId]);
                                    const commentCount = (localComments[item.id] ?? []).length;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => setActiveItemId(item.id)}
                                            className={cn(
                                                "w-full flex items-center gap-3 p-3 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
                                                isActive && "bg-indigo-50 dark:bg-indigo-900/20"
                                            )}
                                        >
                                            <ItemIcon contentType={item.contentType} done={!!isDone} />
                                            <div className="flex-1 min-w-0">
                                                <p className={cn("text-sm font-medium truncate", isActive && "text-indigo-600")}>
                                                    {item.video?.title || item.quiz?.title || item.article?.title || item.assignment?.title || 'Untitled'}
                                                </p>
                                                <p className="text-xs text-zinc-400 capitalize flex items-center gap-1.5">
                                                    {item.contentType}
                                                    {commentCount > 0 && (
                                                        <span className="flex items-center gap-0.5 text-indigo-400">
                                                            <MessageSquare size={9} /> {commentCount}
                                                        </span>
                                                    )}
                                                </p>
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

// ── Assignment section component ──────────────────────────────────────────────
function AssignmentSection({ item, existingSubmission }: { item: any; existingSubmission: any | null }) {
    const [submitted, setSubmitted] = useState(!!existingSubmission);
    const [submission, setSubmission] = useState(existingSubmission);
    const fetcher = useFetcher<any>();
    const isSubmitting = fetcher.state !== 'idle';

    useEffect(() => {
        if (fetcher.data?.intent === 'assignment-submit' && !fetcher.data?.error) {
            setSubmitted(true);
        }
    }, [fetcher.data]);

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set('intent', 'assignment-submit');
        fd.set('assignmentId', item.assignmentId);
        fetcher.submit(fd, { method: 'post' });
    };

    return (
        <div className="p-8 w-full">
            <h2 className="text-3xl font-bold mb-6">{item.assignment?.title}</h2>

            {item.assignment?.instructionsHtml || item.assignment?.description ? (
                <div className="prose dark:prose-invert max-w-none mb-8">
                    {item.assignment?.instructionsHtml ? (
                        <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.assignment.instructionsHtml) }} />
                    ) : (
                        <p>{item.assignment?.description}</p>
                    )}
                </div>
            ) : null}

            {/* Graded feedback */}
            {(submission?.status === 'graded' || submission?.status === 'returned') && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-5 mb-6">
                    <div className="flex items-center gap-2 mb-2">
                        <ThumbsUp size={18} className="text-green-600" />
                        <span className="font-bold text-green-700 dark:text-green-400">
                            Graded: {submission.grade ?? '—'} / {item.assignment?.pointsAvailable ?? 100} pts
                        </span>
                    </div>
                    {submission.feedbackHtml && (
                        <div className="prose prose-sm dark:prose-invert max-w-none mt-2"
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(submission.feedbackHtml) }} />
                    )}
                </div>
            )}

            {/* Already submitted */}
            {submitted && submission?.status === 'submitted' && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5 mb-6 flex items-center gap-3">
                    <CheckCircle2 size={20} className="text-blue-600 flex-shrink-0" />
                    <div>
                        <p className="font-semibold text-blue-700 dark:text-blue-400">Submitted — awaiting grading</p>
                        {submission?.content && (
                            <p className="text-sm text-blue-600 dark:text-blue-500 mt-1 line-clamp-2">{submission.content}</p>
                        )}
                    </div>
                </div>
            )}

            {/* Submission form (show if not yet submitted, or allow resubmit after returned) */}
            {(!submitted || submission?.status === 'returned') && (
                <div className="bg-zinc-50 dark:bg-zinc-800 p-6 rounded-xl border border-zinc-200 dark:border-zinc-700">
                    <h3 className="font-bold mb-4 flex items-center gap-2">
                        <ClipboardList size={20} className="text-orange-500" />
                        {submission?.status === 'returned' ? 'Resubmit Assignment' : 'Submit Assignment'}
                        {item.assignment?.pointsAvailable && (
                            <span className="ml-auto text-xs font-normal text-zinc-400">{item.assignment.pointsAvailable} pts</span>
                        )}
                    </h3>

                    <form onSubmit={handleSubmit}>
                        <textarea
                            name="content"
                            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 min-h-[140px] mb-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition shadow-sm resize-none"
                            placeholder="Type your response here…"
                            defaultValue={submission?.content ?? ''}
                            required
                        />
                        {fetcher.data?.error && (
                            <p className="text-red-500 text-sm mb-3 flex items-center gap-1.5">
                                <AlertCircle size={14} /> {fetcher.data.error}
                            </p>
                        )}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition shadow-sm disabled:opacity-60"
                        >
                            {isSubmitting ? 'Submitting…' : 'Submit Assignment'}
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}
