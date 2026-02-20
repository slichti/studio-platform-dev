import { useParams, useOutletContext, Link } from "react-router";
import { useState, useCallback, useEffect } from "react";
import {
    ArrowLeft, Save, Plus, Trash2, Calendar, GripVertical,
    Video, BookOpen, ChevronRight, Settings, CheckSquare,
    LayoutDashboard, GraduationCap, Globe, Users, TrendingUp,
    ArrowUpDown, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react-router";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { Badge } from "~/components/ui/Badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ComponentErrorBoundary } from "~/components/ErrorBoundary";
import { SkeletonLoader } from "~/components/ui/SkeletonLoader";
import { Modal } from "~/components/Modal";

import { useCourse } from "~/hooks/useCourses";
import { apiRequest } from "~/utils/api";
import { cn } from "~/lib/utils";

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
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                isVideo ? "bg-purple-50 dark:bg-purple-900/20 text-purple-600" : "bg-green-50 dark:bg-green-900/20 text-green-600"
            )}>
                {isVideo ? <Video size={18} /> : <CheckSquare size={18} />}
            </div>
            {/* Title */}
            <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">
                    {item.video?.title || item.quiz?.title || 'Untitled'}
                </div>
                <div className="text-xs text-zinc-400 uppercase tracking-wider font-bold">
                    {isVideo ? 'Video' : 'Quiz'}
                    {item.video?.duration && ` · ${Math.round(item.video.duration / 60)} min`}
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

// ── Main Editor ───────────────────────────────────────────────────────────────

export default function CourseEditorPage() {
    const { slug, id } = useParams();
    const { token: contextToken } = useOutletContext<any>() || {};
    const { getToken } = useAuth();
    const queryClient = useQueryClient();

    const { data: course, isLoading } = useCourse(slug!, id!, contextToken);

    // Local form state (C3: dirty state + explicit save)
    const [formData, setFormData] = useState<any>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [saving, setSaving] = useState(false);

    // Curriculum state
    const [curriculum, setCurriculum] = useState<any[]>([]);
    const [addModal, setAddModal] = useState<'video' | 'quiz' | null>(null);

    // Analytics (C4)
    const { data: analytics } = useQuery({
        queryKey: ['course-analytics', slug, id],
        queryFn: () => apiRequest(`/courses/${id}/analytics`, contextToken, { headers: { 'X-Tenant-Slug': slug! } }),
        enabled: !!id && !!slug && !!contextToken,
        refetchInterval: 60000
    });

    const [activeTab, setActiveTab] = useState("curriculum");

    // Sync course data to local state
    useEffect(() => {
        if (course && !formData) {
            setFormData({ title: course.title, description: course.description || '', slug: course.slug, status: course.status, isPublic: course.isPublic, price: course.price, memberPrice: course.memberPrice });
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
            await apiRequest(`/courses/${id}`, token, {
                method: 'PATCH',
                headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify(formData)
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
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => setAddModal('video')}>
                                    <Plus size={14} className="mr-1" /> Add Video
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setAddModal('quiz')}>
                                    <Plus size={14} className="mr-1" /> Add Quiz
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
                                    <div className="space-y-1 pt-1">
                                        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Cohort Start Date</label>
                                        <input
                                            type="datetime-local"
                                            className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                            value={formData.cohortStartDate ? new Date(formData.cohortStartDate).toISOString().slice(0, 16) : ''}
                                            onChange={e => handleFieldChange('cohortStartDate', e.target.value ? new Date(e.target.value).toISOString() : null)}
                                        />
                                        <p className="text-xs text-zinc-400">In cohort mode, all students start drip content on this date.</p>
                                    </div>
                                )}
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
        </div>
    );
}
