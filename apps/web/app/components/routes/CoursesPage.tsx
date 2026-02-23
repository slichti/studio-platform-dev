import { useParams, useOutletContext, useSearchParams, Link, useNavigate } from "react-router";
import { useState } from "react";
import { Plus, BookOpen, Clock, Users, ChevronRight, GraduationCap, DollarSign, Globe } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react-router";
import React, { Suspense } from "react";
const Select = React.lazy(() => import("react-select"));

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/Card";
import { Badge } from "~/components/ui/Badge";
import { ComponentErrorBoundary } from "~/components/ErrorBoundary";
import { SkeletonLoader } from "~/components/ui/SkeletonLoader";
import { Modal } from "../Modal";

import { useCourses } from "~/hooks/useCourses";
import { apiRequest } from "~/utils/api";
import { cn } from "~/lib/utils";

export default function CoursesPage() {
    const { slug } = useParams();
    const { roles, tenant, token: contextToken, isStudentView } = useOutletContext<any>() || {};
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const isAdmin = !isStudentView && (roles?.includes('owner') || roles?.includes('admin') || roles?.includes('instructor'));
    const statusFilter = searchParams.get("status") || "active";

    const { data: courses = [], isLoading } = useCourses(slug!, { status: statusFilter as any }, contextToken);

    const [isCreateOpen, setIsCreateOpen] = useState(false);

    const handleCreateSuccess = (courseId?: string) => {
        queryClient.invalidateQueries({ queryKey: ['courses', slug] });
        setIsCreateOpen(false);
        if (courseId) {
            navigate(`/studio/${slug}/courses/${courseId}`);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                        <GraduationCap className="h-6 w-6 text-blue-600" />
                        {isStudentView ? "Courses" : "Course Management"}
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400">
                        {isStudentView
                            ? "Browse and open your courses."
                            : "Design and sell premium standalone courses with hybrid curriculum."}
                    </p>
                </div>
                {isAdmin && (
                    <Button onClick={() => setIsCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                        <Plus className="h-4 w-4 mr-2" /> New Course
                    </Button>
                )}
            </div>

            <ComponentErrorBoundary>
                <div className="space-y-4">
                    {isLoading ? (
                        <SkeletonLoader type="card" count={3} />
                    ) : courses.length === 0 ? (
                        <div className="p-12 text-center text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
                            <div className="mx-auto w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4 text-zinc-400">
                                <BookOpen size={24} />
                            </div>
                            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-1">No courses found</h3>
                            <p className="text-sm mb-6">Start by creating your first premium course curriculum.</p>
                            {isAdmin && (
                                <Button onClick={() => setIsCreateOpen(true)} variant="outline">
                                    Create First Course
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {courses.map((course: any) => {
                                const href = isStudentView
                                    ? `/portal/${slug}/courses/${course.slug || course.id}`
                                    : `/studio/${slug}/courses/${course.id}`;
                                const actionLabel = isStudentView ? "View" : "Manage";
                                return (
                                    <Link
                                        key={course.id}
                                        to={href}
                                        className="group block"
                                    >
                                        <Card className="h-full overflow-hidden transition-all hover:shadow-xl hover:border-blue-500/50 dark:hover:border-blue-500/30">
                                            <div className="aspect-video w-full bg-zinc-100 dark:bg-zinc-800 relative">
                                                {course.thumbnailUrl ? (
                                                    <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-zinc-300 dark:text-zinc-700">
                                                        <BookOpen size={48} />
                                                    </div>
                                                )}
                                                <div className="absolute top-3 right-3 flex gap-2">
                                                    <Badge className={cn(
                                                        "px-2 py-0.5 text-[10px] uppercase font-bold",
                                                        course.status === 'active' ? "bg-green-500" : "bg-zinc-500"
                                                    )}>
                                                        {course.status}
                                                    </Badge>
                                                    {course.isPublic && (
                                                        <Badge variant="secondary" className="px-2 py-0.5 text-[10px] uppercase font-bold bg-blue-500 text-white border-0">
                                                            <Globe size={10} className="mr-1" /> Public
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <CardContent className="p-5 flex flex-col gap-4">
                                                <div className="space-y-1">
                                                    <h3 className="font-bold text-lg leading-tight group-hover:text-blue-600 transition-colors">{course.title}</h3>
                                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 min-h-[40px]">
                                                        {course.description || "No description provided."}
                                                    </p>
                                                </div>

                                                <div className="flex items-center justify-between mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-800">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] uppercase text-zinc-400 dark:text-zinc-500 font-bold tracking-wider">Price</span>
                                                        <span className="font-bold text-blue-600 dark:text-blue-400">
                                                            ${(course.price / 100).toFixed(2)}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-zinc-400 group-hover:text-blue-600 transition-colors">
                                                        <span className="text-sm font-medium">{actionLabel}</span>
                                                        <ChevronRight size={16} />
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </ComponentErrorBoundary>

            <CreateCourseModal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                onSuccess={handleCreateSuccess}
                courseList={courses}
            />
        </div>
    );
}

function CreateCourseModal({ isOpen, onClose, onSuccess, courseList }: { isOpen: boolean, onClose: () => void, onSuccess: (id?: string) => void, courseList: any[] }) {
    const { getToken } = useAuth();
    const { slug } = useParams();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        price: "0",
        isPublic: true,
        status: 'draft' as const,
        deliveryMode: 'self_paced',
        cohortStartDate: '',
        prerequisiteIds: [] as string[]
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const token = await getToken();
            const res: any = await apiRequest("/courses", token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify({
                    ...formData,
                    price: Math.round(parseFloat(formData.price) * 100),
                    cohortStartDate: formData.deliveryMode === 'cohort' && formData.cohortStartDate
                        ? new Date(formData.cohortStartDate).toISOString()
                        : null
                })
            });

            if (res.error) toast.error(res.error);
            else {
                toast.success("Course created! Redirecting to curriculum builder...");
                onSuccess(res.id);
            }
        } catch (e: any) {
            toast.error(e.message || "Failed to create course");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create New Course">
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="space-y-1">
                    <label className="text-sm font-semibold">Course Title</label>
                    <input
                        required
                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. Masterclass in Advanced Yoga"
                        value={formData.title}
                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-semibold">Description</label>
                    <textarea
                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                        placeholder="Explain what students will learn..."
                        value={formData.description}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-sm font-semibold flex items-center gap-1">
                            <DollarSign size={14} /> Price ($)
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            required
                            className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.price}
                            onChange={e => setFormData({ ...formData, price: e.target.value })}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-semibold">Initial Status</label>
                        <select
                            className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.status}
                            onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                        >
                            <option value="draft">Draft (Hidden)</option>
                            <option value="active">Active (Visible)</option>
                        </select>
                    </div>
                </div>

                <div className="space-y-3 p-3 bg-zinc-50 dark:bg-zinc-800/30 rounded-lg border border-zinc-200 dark:border-zinc-700">
                    <label className="text-sm font-semibold flex items-center gap-2">
                        Delivery Mode
                    </label>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                                type="radio"
                                name="deliveryMode"
                                value="self_paced"
                                checked={formData.deliveryMode === 'self_paced'}
                                onChange={e => setFormData({ ...formData, deliveryMode: e.target.value })}
                                className="text-blue-600 focus:ring-blue-500"
                            />
                            Self-Paced
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                                type="radio"
                                name="deliveryMode"
                                value="cohort"
                                checked={formData.deliveryMode === 'cohort'}
                                onChange={e => setFormData({ ...formData, deliveryMode: e.target.value })}
                                className="text-blue-600 focus:ring-blue-500"
                            />
                            Scheduled / Cohort
                        </label>
                    </div>

                    {formData.deliveryMode === 'cohort' && (
                        <div className="pt-2">
                            <label className="text-xs font-semibold text-zinc-500 block mb-1">
                                Course Start Date
                            </label>
                            <input
                                type="date"
                                required={formData.deliveryMode === 'cohort'}
                                className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md outline-none focus:ring-2 focus:ring-blue-500"
                                value={formData.cohortStartDate}
                                onChange={e => setFormData({ ...formData, cohortStartDate: e.target.value })}
                            />
                            <p className="text-[10px] text-zinc-500 mt-1">
                                Students can enroll now but curriculum won't unlock until this date.
                            </p>
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
                            options={courseList.map(c => ({ value: c.id, label: c.title }))}
                            value={formData.prerequisiteIds?.map(id => {
                                const c = courseList.find(c => c.id === id);
                                return c ? { value: c.id, label: c.title } : null;
                            }).filter(Boolean) || []}
                            onChange={(selected: any) => setFormData({ ...formData, prerequisiteIds: selected.map((s: any) => s.value) })}
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
                                    zIndex: 100
                                })
                            }}
                        />
                    </Suspense>
                </div>

                <div className="flex items-center gap-2 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-100 dark:border-zinc-800">
                    <input
                        type="checkbox"
                        id="isPublic"
                        checked={formData.isPublic}
                        onChange={e => setFormData({ ...formData, isPublic: e.target.checked })}
                        className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <label htmlFor="isPublic" className="text-sm font-medium cursor-pointer">
                        Publicly visible in your studio portal
                    </label>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                    <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]">
                        {loading ? "Creating..." : "Create Course"}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

