import { useParams, useOutletContext, Link } from "react-router";
import { useState } from "react";
import {
    ArrowLeft, Save, Plus, Trash2, Calendar,
    Video, BookOpen, ChevronRight, Settings,
    LayoutDashboard, GraduationCap, Globe, Users
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react-router";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { Badge } from "~/components/ui/Badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ComponentErrorBoundary } from "~/components/ErrorBoundary";
import { SkeletonLoader } from "~/components/ui/SkeletonLoader";
import { ConfirmationDialog } from "~/components/Dialogs";

import { useCourse } from "~/hooks/useCourses";
import { apiRequest } from "~/utils/api";
import { cn } from "~/lib/utils";

export default function CourseEditorPage() {
    const { slug, id } = useParams();
    const { token: contextToken } = useOutletContext<any>() || {};
    const { getToken } = useAuth();
    const queryClient = useQueryClient();

    const { data: course, isLoading } = useCourse(slug!, id!, contextToken);

    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("curriculum");

    if (isLoading) return <div className="p-8"><SkeletonLoader type="card" count={1} /></div>;
    if (!course) return <div className="p-8 text-center text-red-500">Course not found.</div>;

    const handleUpdate = async (data: any) => {
        setLoading(true);
        try {
            const token = await getToken();
            await apiRequest(`/courses/${id}`, token, {
                method: 'PATCH',
                headers: { 'X-Tenant-Slug': slug! },
                body: JSON.stringify(data)
            });
            queryClient.invalidateQueries({ queryKey: ['course', slug, id] });
            toast.success("Course updated");
        } catch (e: any) {
            toast.error(e.message || "Update failed");
        } finally {
            setLoading(false);
        }
    };

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
                            <Badge variant={course.status === 'active' ? 'success' : 'secondary'}>
                                {course.status}
                            </Badge>
                        </div>
                        <p className="text-sm text-zinc-500 font-mono">/{course.slug}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => window.open(`/portal/${slug}/courses/${course.slug}`, '_blank')}>
                        <Globe size={16} className="mr-2" /> View Public Page
                    </Button>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white" disabled={loading} onClick={() => toast.info("Build logic coming soon")}>
                        <Save size={16} className="mr-2" /> Publish Changes
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

                <TabsContent value="curriculum" className="pt-6 space-y-8">
                    {/* Live Sessions Section */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    <Calendar className="text-blue-600" size={20} />
                                    Live Sessions & Workshops
                                </h3>
                                <p className="text-sm text-zinc-500">Scheduled events that students can attend live or virtually.</p>
                            </div>
                            <Button variant="outline" size="sm">
                                <Plus size={14} className="mr-1" /> Add Session
                            </Button>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            {course.sessions?.map((session: any) => (
                                <div key={session.id} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:shadow-sm transition group">
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
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-8 w-8"><Trash2 size={14} className="text-red-500" /></Button>
                                        <ChevronRight size={18} className="text-zinc-400" />
                                    </div>
                                </div>
                            ))}
                            {course.sessions?.length === 0 && (
                                <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-800/20 border border-dashed rounded-xl text-zinc-500">
                                    No live sessions linked to this course.
                                </div>
                            )}
                        </div>
                    </section>

                    {/* VOD & Assignments Section */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold flex items-center gap-2">
                                    <Video className="text-purple-600" size={20} />
                                    On-Demand & Content
                                </h3>
                                <p className="text-sm text-zinc-500">Pre-recorded videos, resources, and quizzes for self-paced learning.</p>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm">
                                    <Plus size={14} className="mr-1" /> Add Video
                                </Button>
                                <Button variant="outline" size="sm">
                                    <Plus size={14} className="mr-1" /> Add Quiz
                                </Button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            {course.curriculum?.map((item: any) => (
                                <div key={item.id} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:shadow-sm transition group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/20 rounded-lg flex items-center justify-center text-purple-600">
                                            <Video size={20} />
                                        </div>
                                        <div>
                                            <div className="font-semibold">{item.video?.title || "Untitled Video"}</div>
                                            <div className="text-xs text-zinc-500 uppercase tracking-wider font-bold">Video Content</div>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100"><Trash2 size={14} className="text-red-500" /></Button>
                                </div>
                            ))}
                            {course.curriculum?.length === 0 && (
                                <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-800/20 border border-dashed rounded-xl text-zinc-500">
                                    No self-paced content added yet.
                                </div>
                            )}
                        </div>
                    </section>
                </TabsContent>

                <TabsContent value="details" className="pt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Course Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <label className="text-sm font-semibold">Course Title</label>
                                    <input
                                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none"
                                        value={course.title}
                                        onChange={e => handleUpdate({ title: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-semibold">Slug</label>
                                    <input
                                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none font-mono"
                                        value={course.slug}
                                        onChange={e => handleUpdate({ slug: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-semibold">Description</label>
                                <textarea
                                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg outline-none min-h-[150px]"
                                    defaultValue={course.description || ""}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="students" className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card>
                            <CardContent className="p-6">
                                <div className="text-zinc-500 text-sm font-medium mb-1">Total Students</div>
                                <div className="text-3xl font-bold italic tracking-tight text-blue-600">0</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-6">
                                <div className="text-zinc-500 text-sm font-medium mb-1">Total Revenue</div>
                                <div className="text-3xl font-bold italic tracking-tight text-green-600">$0.00</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-6">
                                <div className="text-zinc-500 text-sm font-medium mb-1">Avg. Progress</div>
                                <div className="text-3xl font-bold italic tracking-tight text-purple-600">0%</div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
