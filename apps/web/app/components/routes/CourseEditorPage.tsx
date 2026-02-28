import { useParams, useOutletContext, Link } from "react-router";
import { useState, useCallback, useEffect } from "react";
import {
    ArrowLeft, Save, Plus, Trash2, Calendar, GripVertical,
    Video, BookOpen, ChevronRight, Settings, CheckSquare,
    LayoutDashboard, GraduationCap, Globe, Users, TrendingUp,
    ArrowUpDown, Loader2, FileText, ClipboardList,
    ChevronDown, ChevronUp, Image as ImageIcon
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react-router";
import React, { Suspense } from "react";
const Select = React.lazy(() => import("react-select"));

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { Badge } from "~/components/ui/Badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ComponentErrorBoundary } from "~/components/ErrorBoundary";
import { SkeletonLoader } from "~/components/ui/SkeletonLoader";
import { Modal } from "~/components/Modal";
import { CardCreator } from "~/components/CardCreator";

import { useCourse, useCourses } from "~/hooks/useCourses";
import { apiRequest } from "~/utils/api";
import { cn } from "~/lib/utils";
import { DateTimePicker } from "../ui/DateTimePicker";

// ── Video & Quiz Picker Modal ─────────────────────────────────────────────────

function AddContentModal({
    isOpen,
    onClose,
    contentType,
    slug,
    courseId,
    token,
    onAdded
}: {
    isOpen: boolean;
    onClose: () => void;
    contentType: 'video' | 'quiz';
    slug: string;
    courseId: string;
    token: string | null;
    onAdded: () => void;
}) {
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

    const { data: items = [] } = useQuery({
        queryKey: [contentType === 'video' ? 'videos' : 'quizzes', slug],
        queryFn: () => apiRequest(
            contentType === 'video' ? `/media/videos` : `/quizzes`,
            token,
            { headers: { 'X-Tenant-Slug': slug } }
        ),
        enabled: isOpen && !!token
    });

    const filtered = (items as any[]).filter((item: any) =>
        (item.title || '').toLowerCase().includes(search.toLowerCase())
    );

    const handleAdd = async (item: any) => {
        setLoading(true);
        try {
            await apiRequest(`/courses/${courseId}/curriculum`, token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify({
                    contentType,
                    videoId: contentType === 'video' ? item.id : null,
                    quizId: contentType === 'quiz' ? item.id : null,
                })
            });
            toast.success(`${item.title} added to curriculum`);
            onAdded();
            onClose();
        } catch (e: any) {
            toast.error(e.message || 'Failed to add item');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Add ${contentType === 'video' ? 'Video' : 'Quiz'}`}>
            <div className="space-y-4 pt-2">
                <input
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    placeholder="Search..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    autoFocus
                />
                <div className="space-y-2 max-h-80 overflow-y-auto">
                    {filtered.length === 0 && (
                        <div className="p-6 text-center text-zinc-500 text-sm">
                            No {contentType === 'video' ? 'videos' : 'quizzes'} found in your library.
                        </div>
                    )}
                    {filtered.map((item: any) => (
                        <button
                            key={item.id}
                            disabled={loading}
                            onClick={() => handleAdd(item)}
                            className="w-full flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition text-left group"
                        >
                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                                contentType === 'video' ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600" : "bg-green-100 dark:bg-green-900/30 text-green-600"
                            )}>
                                {contentType === 'video' ? <Video size={16} /> : <CheckSquare size={16} />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">{item.title}</div>
                                {item.duration && <div className="text-xs text-zinc-400">{Math.round(item.duration / 60)} min</div>}
                            </div>
                            <ChevronRight size={14} className="text-zinc-300 group-hover:text-blue-500 flex-shrink-0" />
                        </button>
                    ))}
                </div>
            </div>
        </Modal>
    );
}

function CreateContentModal({
    isOpen,
    onClose,
    contentType,
    slug,
    courseId,
    token,
    onAdded
}: {
    isOpen: boolean;
    onClose: () => void;
    contentType: 'article' | 'assignment';
    slug: string;
    courseId: string;
    token: string | null;
    onAdded: () => void;
}) {
    const [title, setTitle] = useState('');
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        setLoading(true);
        try {
            const endpoint = contentType === 'article' ? '/articles' : '/assignments';
            const contentRes = await apiRequest(endpoint, token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify({ title })
            });
            await apiRequest(`/courses/${courseId}/curriculum`, token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify({
                    contentType,
                    [contentType + 'Id']: contentRes.id
                })
            });
            toast.success(`${title} created and added to curriculum`);
            onAdded();
            onClose();
        } catch (e: any) {
            toast.error(e.message || `Failed to create ${contentType}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Create New ${contentType === 'article' ? 'Article' : 'Assignment'}`}>
            <div className="space-y-4 pt-2">
                <div className="space-y-1">
                    <label className="text-sm font-semibold">Title</label>
                    <input
                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="e.g. Week 1 Reading..."
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        autoFocus
                    />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleCreate} disabled={!title.trim() || loading} className="bg-blue-600 text-white hover:bg-blue-700">
                        {loading && <Loader2 size={16} className="animate-spin mr-2" />}
                        Create
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

// ── Curriculum Item Row ───────────────────────────────────────────────────────

function CurriculumItem({
    item,
    index,
    onRemove,
    onMoveUp,
    onMoveDown,
    isFirst,
    isLast
}: {
    item: any;
    index: number;
    onRemove: (id: string) => void;
    onMoveUp: (index: number) => void;
    onMoveDown: (index: number) => void;
    isFirst: boolean;
    isLast: boolean;
}) {
    const isVideo = item.contentType === 'video';
    const isQuiz = item.contentType === 'quiz';
    const isArticle = item.contentType === 'article';
    const isAssignment = item.contentType === 'assignment';

    let Icon = Video;
    let iconClass = "bg-purple-50 dark:bg-purple-900/20 text-purple-600";
    let title = item.video?.title || item.quiz?.title || item.article?.title || item.assignment?.title || 'Untitled';
    let subtitle = item.contentType.charAt(0).toUpperCase() + item.contentType.slice(1);

    if (isQuiz) {
        Icon = CheckSquare;
        iconClass = "bg-green-50 dark:bg-green-900/20 text-green-600";
    } else if (isArticle) {
        Icon = FileText;
        iconClass = "bg-blue-50 dark:bg-blue-900/20 text-blue-600";
    } else if (isAssignment) {
        Icon = ClipboardList;
        iconClass = "bg-orange-50 dark:bg-orange-900/20 text-orange-600";
    }

    if (isVideo && item.video?.duration) subtitle += ` · ${Math.round(item.video.duration / 60)} min`;
    if (isArticle && item.article?.readingTimeMinutes) subtitle += ` · ${item.article.readingTimeMinutes} min read`;

    return (
        <div className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:shadow-sm transition group">
            {/* Drag handle / order buttons */}
            <div className="flex flex-col gap-0.5">
                <button onClick={() => onMoveUp(index)} disabled={isFirst} className="p-0.5 text-zinc-300 hover:text-zinc-600 disabled:opacity-20 disabled:cursor-not-allowed transition">
                    <ArrowUpDown size={10} />
                </button>
                <GripVertical size={14} className="text-zinc-300 mx-auto" />
                <button onClick={() => onMoveDown(index)} disabled={isLast} className="p-0.5 text-zinc-300 hover:text-zinc-600 disabled:opacity-20 disabled:cursor-not-allowed transition">
                    <ArrowUpDown size={10} className="rotate-180" />
                </button>
            </div>
            {/* Icon */}
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", iconClass)}>
                <Icon size={18} />
            </div>
            {/* Title */}
            <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{title}</div>
                <div className="text-xs text-zinc-400 uppercase tracking-wider font-bold">
                    {subtitle}
                </div>
            </div>
            {/* Remove */}
            <button
                onClick={() => onRemove(item.id)}
                className="p-1.5 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition rounded"
            >
                <Trash2 size={14} />
            </button>
        </div>
    );
}

// ── Grading Tab ───────────────────────────────────────────────────────────────

function GradingTab({ submissions, onGraded, token, slug, getToken }: {
    submissions: any[];
    onGraded: () => void;
    token: string | null;
    slug: string;
    getToken: () => Promise<string | null>;
}) {
    const [gradingId, setGradingId] = useState<string | null>(null);
    const [gradeValue, setGradeValue] = useState<string>('');
    const [feedbackValue, setFeedbackValue] = useState<string>('');
    const [saving, setSaving] = useState(false);
    const [filter, setFilter] = useState<'all' | 'submitted' | 'graded'>('submitted');

    const filtered = submissions.filter(s =>
        filter === 'all' ? true : s.status === filter
    );

    const openGrading = (s: any) => {
        setGradingId(s.id);
        setGradeValue(s.grade != null ? String(s.grade) : '');
        setFeedbackValue(s.feedbackHtml ?? '');
    };

    const handleGrade = async () => {
        if (!gradingId) return;
        const grade = Number(gradeValue);
        if (isNaN(grade) || grade < 0) { toast.error('Enter a valid grade'); return; }
        setSaving(true);
        try {
            const t = token || await getToken();
            await apiRequest(`/courses/assignments/submissions/${gradingId}/grade`, t, {
                method: 'PATCH',
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify({ grade, feedbackHtml: feedbackValue, status: 'graded' }),
            });
            toast.success('Graded!');
            setGradingId(null);
            onGraded();
        } catch (e: any) {
            toast.error(e.message || 'Failed to save grade');
        } finally {
            setSaving(false);
        }
    };

    if (submissions.length === 0) {
        return (
            <div className="p-16 text-center text-zinc-400 bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                <ClipboardList size={36} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">No assignment submissions yet.</p>
                <p className="text-xs text-zinc-400 mt-1">Submissions will appear here when students submit their work.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Filter bar */}
            <div className="flex items-center gap-2">
                {(['submitted', 'graded', 'all'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={cn(
                            "px-3 py-1.5 text-sm rounded-lg font-medium capitalize transition",
                            filter === f
                                ? "bg-indigo-600 text-white"
                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                        )}
                    >
                        {f === 'submitted' ? `Needs Grading (${submissions.filter(s => s.status === 'submitted').length})` : f === 'graded' ? `Graded (${submissions.filter(s => s.status === 'graded').length})` : `All (${submissions.length})`}
                    </button>
                ))}
            </div>

            {filtered.length === 0 && (
                <p className="text-center text-zinc-400 py-8 text-sm">No submissions matching this filter.</p>
            )}

            {filtered.map((s: any) => (
                <Card key={s.id}>
                    <CardContent className="p-5">
                        <div className="flex items-start gap-4">
                            <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 text-sm font-bold flex-shrink-0">
                                {s.userId?.[0]?.toUpperCase() ?? '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold text-sm truncate">{s.userId}</span>
                                    <span className={cn(
                                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                                        s.status === 'submitted' ? "bg-orange-100 text-orange-700" :
                                            s.status === 'graded' ? "bg-green-100 text-green-700" :
                                                "bg-zinc-100 text-zinc-600"
                                    )}>{s.status}</span>
                                    {s.assignment?.title && (
                                        <span className="text-xs text-zinc-400 truncate">&middot; {s.assignment.title}</span>
                                    )}
                                </div>
                                {s.content && (
                                    <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3 mb-2 bg-zinc-50 dark:bg-zinc-800 p-3 rounded-lg">
                                        {s.content}
                                    </p>
                                )}
                                {s.grade != null && (
                                    <p className="text-sm font-medium text-green-700 dark:text-green-400">
                                        Grade: {s.grade} / {s.assignment?.pointsAvailable ?? 100} pts
                                    </p>
                                )}
                                <p className="text-[11px] text-zinc-400 mt-1">
                                    Submitted {s.submittedAt ? new Date(typeof s.submittedAt === 'number' ? s.submittedAt * 1000 : s.submittedAt).toLocaleString() : '—'}
                                </p>
                            </div>
                            <button
                                onClick={() => openGrading(s)}
                                className="flex-shrink-0 px-3 py-1.5 text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
                            >
                                {s.grade != null ? 'Re-grade' : 'Grade'}
                            </button>
                        </div>
                    </CardContent>
                </Card>
            ))}

            {/* Grading Modal */}
            <Modal isOpen={!!gradingId} onClose={() => setGradingId(null)} title="Grade Submission">
                <div className="space-y-4 p-1">
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Grade (points)</label>
                        <input
                            type="number"
                            min="0"
                            value={gradeValue}
                            onChange={e => setGradeValue(e.target.value)}
                            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="e.g. 85"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Feedback (optional HTML or plain text)</label>
                        <textarea
                            rows={5}
                            value={feedbackValue}
                            onChange={e => setFeedbackValue(e.target.value)}
                            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                            placeholder="Great work! Consider…"
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" onClick={() => setGradingId(null)}>Cancel</Button>
                        <Button onClick={handleGrade} disabled={saving}>
                            {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                            Save Grade
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

// ── Main Editor ───────────────────────────────────────────────────────────────

export default function CourseEditorPage() {
    const { slug, id } = useParams();
    const { token: contextToken } = useOutletContext<any>() || {};
    const { getToken } = useAuth();
    const queryClient = useQueryClient();

    const { data: course, isLoading } = useCourse(slug!, id!, contextToken);
    const { data: courseList = [] } = useCourses(slug!, { status: 'active' }, contextToken);

    // Local form state (C3: dirty state + explicit save)
    const [formData, setFormData] = useState<any>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showCourseImage, setShowCourseImage] = useState(false);
    const [courseImageBlob, setCourseImageBlob] = useState<Blob | null>(null);
    const [uploadingCourseImage, setUploadingCourseImage] = useState(false);

    // Curriculum state
    const [curriculum, setCurriculum] = useState<any[]>([]);
    const [addModal, setAddModal] = useState<'video' | 'quiz' | 'article' | 'assignment' | null>(null);

    // Analytics (C4) — use getToken() fallback to avoid 401 when contextToken is briefly undefined
    const { data: analytics, isLoading: isLoadingAnalytics } = useQuery({
        queryKey: ['course-analytics', slug, id, contextToken],
        queryFn: async () => {
            const token = contextToken || await getToken();
            if (!token) throw new Error("No token");
            return apiRequest(`/courses/${id}/analytics`, token, { headers: { 'X-Tenant-Slug': slug! } });
        },
        enabled: !!id && !!slug && (!!contextToken || !!id),
        refetchInterval: 60000
    });

    // Grading — all assignment submissions for this course
    const { data: allSubmissions = [], refetch: refetchSubmissions } = useQuery({
        queryKey: ['course-submissions', slug, id, contextToken],
        queryFn: async () => {
            const token = contextToken || await getToken();
            if (!token) return [];
            return apiRequest(`/courses/${id}/all-submissions`, token, { headers: { 'X-Tenant-Slug': slug! } });
        },
        enabled: !!id && !!slug && (!!contextToken || !!id),
    });

    const [activeTab, setActiveTab] = useState("curriculum");

    // Sync course data to local state
    useEffect(() => {
        if (course && !formData) {
            setFormData({
                title: course.title,
                description: course.description || '',
                slug: course.slug,
                status: course.status,
                isPublic: course.isPublic,
                price: course.price,
                memberPrice: course.memberPrice,
                deliveryMode: course.deliveryMode || 'self_paced',
                cohortStartDate: course.cohortStartDate,
                cohortEndDate: course.cohortEndDate,
                prerequisiteIds: course.prerequisiteIds || []
            });
            setCurriculum(course.curriculum || []);
        }
    }, [course]);

    const handleFieldChange = (field: string, val: any) => {
        setFormData((prev: any) => ({ ...prev, [field]: val }));
        setIsDirty(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const token = await getToken();

            // Upload course image if present
            let thumbnailUrl = formData.thumbnailUrl;
            if (courseImageBlob) {
                setUploadingCourseImage(true);
                const imgFormData = new FormData();
                const file = new File([courseImageBlob], 'course-card.jpg', { type: 'image/jpeg' });
                imgFormData.append('file', file);

                const apiUrl = import.meta.env.VITE_API_URL || 'https://studio-platform-api.slichti.workers.dev';
                const uploadRes = await fetch(`${apiUrl}/uploads/r2-image`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'X-Tenant-Slug': slug!,
                    },
                    body: imgFormData,
                });
                if (uploadRes.ok) {
                    const uploadData = await uploadRes.json() as { url: string };
                    thumbnailUrl = uploadData.url;
                }
                setUploadingCourseImage(false);
                setCourseImageBlob(null);
            }

            await apiRequest(`/courses/${id}`, token, {
                method: 'PATCH',
                headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify({ ...formData, thumbnailUrl })
            });
            queryClient.invalidateQueries({ queryKey: ['course', slug, id] });
            setIsDirty(false);
            toast.success("Course saved");
        } catch (e: any) {
            toast.error(e.message || "Save failed");
        } finally {
            setSaving(false);
        }
    };

    const handlePublish = async () => {
        const newStatus = formData?.status === 'active' ? 'draft' : 'active';
        setFormData((prev: any) => ({ ...prev, status: newStatus }));
        setIsDirty(true);
        toast.info(`Status set to ${newStatus}. Click Save to apply.`);
    };

    const handleRemoveCurriculumItem = useCallback(async (itemId: string) => {
        try {
            const token = await getToken();
            await apiRequest(`/courses/${id}/curriculum/${itemId}`, token, {
                method: 'DELETE',
                headers: { 'X-Tenant-Slug': slug! }
            });
            setCurriculum(prev => prev.filter(item => item.id !== itemId));
            toast.success("Item removed");
        } catch (e: any) {
            toast.error(e.message || 'Failed to remove item');
        }
    }, [id, slug, getToken]);

    const handleMove = useCallback(async (index: number, direction: 'up' | 'down') => {
        const newCurriculum = [...curriculum];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        [newCurriculum[index], newCurriculum[swapIndex]] = [newCurriculum[swapIndex], newCurriculum[index]];
        setCurriculum(newCurriculum);
        try {
            const token = await getToken();
            await apiRequest(`/courses/${id}/curriculum/reorder`, token, {
                method: 'PATCH',
                headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify({ orderedIds: newCurriculum.map(i => i.id) })
            });
        } catch {
            setCurriculum(curriculum); // revert on error
        }
    }, [curriculum, id, slug, getToken]);

    const handleCurriculumAdded = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['course', slug, id] });
        // Re-fetch curriculum (next load picks it up from cache)
        apiRequest(`/courses/${id}`, contextToken, { headers: { 'X-Tenant-Slug': slug! } })
            .then((c: any) => setCurriculum(c.curriculum || []));
    }, [id, slug, contextToken, queryClient]);

    if (isLoading || !formData) return <div className="p-8"><SkeletonLoader type="card" count={1} /></div>;
    if (!course) return <div className="p-8 text-center text-red-500">Course not found.</div>;

    const sessions = course.sessions || [];
    const stats = analytics as any;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-4">
                    <Link
                        to={`/studio/${slug}/courses`}
                        className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition"
                    >
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold">{course.title}</h1>
                            <Badge variant={formData.status === 'active' ? 'success' : 'secondary'}>
                                {formData.status}
                            </Badge>
                            {isDirty && <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Unsaved changes</Badge>}
                        </div>
                        <p className="text-sm text-zinc-500 font-mono">/{course.slug}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => window.open(`/portal/${slug}/courses/${course.slug}`, '_blank')}>
                        <Globe size={16} className="mr-2" /> View Public Page
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handlePublish}
                        className={formData.status === 'active' ? 'text-amber-600 border-amber-300' : 'text-green-600 border-green-300'}
                    >
                        {formData.status === 'active' ? 'Unpublish' : 'Publish'}
                    </Button>
                    <Button
                        className="bg-blue-600 hover:bg-blue-700 text-white min-w-[90px]"
                        disabled={!isDirty || saving}
                        onClick={handleSave}
                    >
                        {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
                        Save
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                    <TabsTrigger value="curriculum" className="flex items-center gap-2">
                        <LayoutDashboard size={14} /> Curriculum
                    </TabsTrigger>
                    <TabsTrigger value="details" className="flex items-center gap-2">
                        <Settings size={14} /> Course Settings
                    </TabsTrigger>
                    <TabsTrigger value="students" className="flex items-center gap-2">
                        <Users size={14} /> Analytics & Students
                    </TabsTrigger>
                    <TabsTrigger value="grading" className="flex items-center gap-2">
                        <ClipboardList size={14} /> Grading
                        {(allSubmissions as any[]).filter((s: any) => s.status === 'submitted').length > 0 && (
                            <span className="ml-1 bg-orange-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                                {(allSubmissions as any[]).filter((s: any) => s.status === 'submitted').length}
                            </span>
                        )}
                    </TabsTrigger>
                </TabsList>

                {/* ── Curriculum Tab ── */}
                <TabsContent value="curriculum" className="pt-6 space-y-8">
                    {/* Live Sessions */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    <Calendar className="text-blue-600" size={20} />
                                    Live Sessions & Workshops
                                </h3>
                                <p className="text-sm text-zinc-500">Scheduled events linked to this course.</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => window.open(`/studio/${slug}/schedule`, '_blank')}>
                                <Plus size={14} className="mr-1" /> Schedule Session
                            </Button>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            {sessions.map((session: any) => (
                                <div key={session.id} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:shadow-sm transition">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center text-blue-600">
                                            <Calendar size={20} />
                                        </div>
                                        <div>
                                            <div className="font-semibold">{session.title}</div>
                                            <div className="text-xs text-zinc-500">
                                                {new Date(session.startTime).toLocaleDateString()} at {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                    <Link to={`/studio/${slug}/schedule`}>
                                        <ChevronRight size={18} className="text-zinc-400" />
                                    </Link>
                                </div>
                            ))}
                            {sessions.length === 0 && (
                                <div className="p-6 text-center bg-zinc-50 dark:bg-zinc-800/20 border border-dashed rounded-xl text-zinc-400 text-sm">
                                    No live sessions linked to this course. Schedule a class and assign it to this course.
                                </div>
                            )}
                        </div>
                    </section>

                    {/* On-Demand Content */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    <Video className="text-purple-600" size={20} />
                                    On-Demand & Content
                                </h3>
                                <p className="text-sm text-zinc-500">Pre-recorded videos and quizzes for self-paced learning.</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" onClick={() => setAddModal('video')}>
                                    <Plus size={14} className="mr-1" /> Add Video
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setAddModal('quiz')}>
                                    <Plus size={14} className="mr-1" /> Add Quiz
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setAddModal('article')}>
                                    <Plus size={14} className="mr-1" /> Add Article
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setAddModal('assignment')}>
                                    <Plus size={14} className="mr-1" /> Add Assignment
                                </Button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                            {curriculum.map((item: any, index: number) => (
                                <CurriculumItem
                                    key={item.id}
                                    item={item}
                                    index={index}
                                    onRemove={handleRemoveCurriculumItem}
                                    onMoveUp={(i) => handleMove(i, 'up')}
                                    onMoveDown={(i) => handleMove(i, 'down')}
                                    isFirst={index === 0}
                                    isLast={index === curriculum.length - 1}
                                />
                            ))}
                            {curriculum.length === 0 && (
                                <div className="p-10 text-center bg-zinc-50 dark:bg-zinc-800/20 border border-dashed rounded-xl text-zinc-400">
                                    <BookOpen size={32} className="mx-auto mb-3 opacity-40" />
                                    <p className="text-sm font-medium">No content added yet.</p>
                                    <p className="text-xs mt-1">Add videos and quizzes from your media library above.</p>
                                </div>
                            )}
                        </div>
                    </section>
                </TabsContent>

                {/* ── Settings Tab (C3: explicit save) ── */}
                <TabsContent value="details" className="pt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Course Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <label className="text-sm font-semibold">Course Title</label>
                                    <input
                                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                        value={formData.title}
                                        onChange={e => handleFieldChange('title', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-semibold">Slug</label>
                                    <input
                                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                        value={formData.slug}
                                        onChange={e => handleFieldChange('slug', e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-semibold">Description</label>
                                <textarea
                                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
                                    value={formData.description}
                                    onChange={e => handleFieldChange('description', e.target.value)}
                                />
                            </div>

                            {/* Cover Image */}
                            <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setShowCourseImage(!showCourseImage)}
                                    className="w-full flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-750 transition-colors text-left"
                                >
                                    <span className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                        <ImageIcon className="w-4 h-4" />
                                        Cover Image
                                        {(course.thumbnailUrl || courseImageBlob) && <span className="text-green-600 text-xs">(Set)</span>}
                                    </span>
                                    {showCourseImage ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
                                </button>
                                {showCourseImage && (
                                    <div className="p-4 border-t border-zinc-200 dark:border-zinc-700">
                                        <CardCreator
                                            initialImage={course.thumbnailUrl || undefined}
                                            onChange={(data) => {
                                                setCourseImageBlob(data.image);
                                                setIsDirty(true);
                                            }}
                                        />
                                        <p className="text-xs text-zinc-500 mt-2">
                                            Upload or generate a 600×450 (4:3) thumbnail. Click Save to apply.
                                        </p>
                                        {uploadingCourseImage && (
                                            <div className="flex items-center gap-2 text-sm text-indigo-600 mt-2">
                                                <div className="h-4 w-4 animate-spin rounded-full border-t-2 border-indigo-600 border-r-2" />
                                                Uploading...
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <label className="text-sm font-semibold">Price ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                        value={(formData.price / 100).toFixed(2)}
                                        onChange={e => handleFieldChange('price', Math.round(parseFloat(e.target.value) * 100))}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-semibold">Member Price ($) <span className="text-zinc-400 font-normal">optional</span></label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                        value={formData.memberPrice != null ? (formData.memberPrice / 100).toFixed(2) : ''}
                                        placeholder="Same as regular price"
                                        onChange={e => handleFieldChange('memberPrice', e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null)}
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-2 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-100 dark:border-zinc-800">
                                <input
                                    type="checkbox"
                                    id="isPublic"
                                    checked={formData.isPublic}
                                    onChange={e => handleFieldChange('isPublic', e.target.checked)}
                                    className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                                />
                                <label htmlFor="isPublic" className="text-sm font-medium cursor-pointer">
                                    Publicly visible in studio portal
                                </label>
                            </div>
                            {/* H3: Cohort Mode */}
                            <div className="space-y-3 p-4 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                <div className="text-sm font-semibold">Delivery Mode</div>
                                <div className="flex gap-4">
                                    {(['self_paced', 'cohort'] as const).map(mode => (
                                        <label key={mode} className="flex items-center gap-2 cursor-pointer group">
                                            <input
                                                type="radio"
                                                name="deliveryMode"
                                                value={mode}
                                                checked={formData.deliveryMode === mode}
                                                onChange={() => handleFieldChange('deliveryMode', mode)}
                                                className="text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-sm capitalize group-hover:text-blue-600 transition">
                                                {mode === 'self_paced' ? '🔓 Self-Paced' : '👥 Cohort'}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                                {formData.deliveryMode === 'cohort' && (
                                    <div className="grid grid-cols-2 gap-4 pt-1">
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Cohort Start Date</label>
                                            <DateTimePicker
                                                value={formData.cohortStartDate || ""}
                                                onChange={(iso: string) => handleFieldChange('cohortStartDate', iso || null)}
                                                placeholder="Select start date"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Cohort End Date (Optional)</label>
                                            <DateTimePicker
                                                value={formData.cohortEndDate || ""}
                                                onChange={(iso: string) => handleFieldChange('cohortEndDate', iso || null)}
                                                placeholder="Select end date"
                                            />
                                        </div>
                                        <p className="text-xs text-zinc-400 col-span-2">In cohort mode, students start drip content on the start date. End date is for reference (e.g. academic term).</p>
                                    </div>
                                )}
                            </div>

                            {/* N3: Prerequisite Gating */}
                            <div className="space-y-3 p-4 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                <div className="text-sm font-semibold mb-1">Prerequisites</div>
                                <p className="text-xs text-zinc-500 mb-3">Students must complete the selected courses before they can enroll in this one.</p>
                                <Suspense fallback={<div className="h-[38px] bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />}>
                                    <Select
                                        isMulti
                                        options={courseList.filter((c: any) => c.id !== course.id).map((c: any) => ({ value: c.id, label: c.title }))}
                                        value={formData.prerequisiteIds?.map((id: string) => {
                                            const c = courseList.find((c: any) => c.id === id);
                                            return c ? { value: c.id, label: c.title } : null;
                                        }).filter(Boolean) || []}
                                        onChange={(selected: any) => handleFieldChange('prerequisiteIds', selected.map((s: any) => s.value))}
                                        className="text-sm border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Select prerequisite courses..."
                                        styles={{
                                            control: (baseStyles: any) => ({
                                                ...baseStyles,
                                                backgroundColor: 'var(--zinc-50)',
                                                borderColor: 'var(--zinc-200)',
                                                borderRadius: '0.5rem',
                                                padding: '0.125rem'
                                            }),
                                            menu: (baseStyles: any) => ({
                                                ...baseStyles,
                                                zIndex: 50
                                            })
                                        }}
                                    />
                                </Suspense>
                            </div>

                            <div className="flex justify-end pt-2">
                                <Button
                                    className="bg-blue-600 hover:bg-blue-700 text-white min-w-[100px]"
                                    disabled={!isDirty || saving}
                                    onClick={handleSave}
                                >
                                    {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
                                    Save Changes
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Analytics Tab (C4: real data) ── */}
                <TabsContent value="students" className="pt-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {[
                            { label: 'Total Students', value: stats?.totalStudents ?? '—', color: 'text-blue-600', icon: Users },
                            { label: 'Completed', value: stats?.completed ?? '—', color: 'text-green-600', icon: GraduationCap },
                            { label: 'Avg. Progress', value: stats ? `${stats.avgProgress}%` : '—', color: 'text-purple-600', icon: TrendingUp },
                            { label: 'Est. Revenue', value: stats ? `$${((stats.totalRevenue ?? 0) / 100).toFixed(2)}` : '—', color: 'text-emerald-600', icon: BookOpen },
                        ].map(({ label, value, color, icon: Icon }) => (
                            <Card key={label}>
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="text-zinc-500 text-sm font-medium">{label}</div>
                                        <Icon size={16} className={cn("opacity-60", color)} />
                                    </div>
                                    <div className={cn("text-3xl font-bold italic tracking-tight", color)}>{value}</div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Enrollment list */}
                    {stats?.enrollments?.length > 0 && (
                        <Card>
                            <CardHeader><CardTitle>Enrolled Students</CardTitle></CardHeader>
                            <CardContent>
                                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                    {stats.enrollments.map((e: any) => (
                                        <div key={e.id} className="flex items-center gap-4 py-3">
                                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">
                                                {e.userId?.[0]?.toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium truncate">{e.userId}</div>
                                                <div className="text-xs text-zinc-400">{e.status}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-24 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${e.progress ?? 0}%` }} />
                                                </div>
                                                <span className="text-xs text-zinc-500 w-8 text-right">{e.progress ?? 0}%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                    {(!stats || stats.enrollments?.length === 0) && (
                        <div className="p-10 text-center text-zinc-400 bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                            <Users size={32} className="mx-auto mb-3 opacity-40" />
                            <p className="text-sm font-medium">No students enrolled yet.</p>
                        </div>
                    )}
                </TabsContent>

                {/* ── Grading Tab ── */}
                <TabsContent value="grading" className="pt-6 space-y-4">
                    <GradingTab
                        submissions={allSubmissions as any[]}
                        onGraded={refetchSubmissions}
                        token={contextToken}
                        slug={slug!}
                        getToken={getToken}
                    />
                </TabsContent>
            </Tabs>

            {/* Content Picker Modals */}
            {(addModal === 'video' || addModal === 'quiz') && (
                <AddContentModal
                    isOpen={true}
                    onClose={() => setAddModal(null)}
                    contentType={addModal}
                    slug={slug!}
                    courseId={id!}
                    token={contextToken}
                    onAdded={handleCurriculumAdded}
                />
            )}
            {(addModal === 'article' || addModal === 'assignment') && (
                <CreateContentModal
                    isOpen={true}
                    onClose={() => setAddModal(null)}
                    contentType={addModal}
                    slug={slug!}
                    courseId={id!}
                    token={contextToken}
                    onAdded={handleCurriculumAdded}
                />
            )}
        </div>
    );
}
