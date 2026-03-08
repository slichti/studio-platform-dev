import { useState } from "react";
import { useLoaderData, useRevalidator, useParams } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { useAuth } from "@clerk/react-router";
import { toast } from "sonner";
import {
    MessagesSquare,
    Bell,
    Mail,
    MessageSquare,
    ChevronLeft,
    Save,
    Shield,
    Heart,
    Trophy,
    Users,
    Settings2,
    Lock,
    Globe,
    Archive,
    Trash2,
    Plus,
    X as CloseIcon
} from "lucide-react";
import { useCommunityTopics, useTopicDetails, useTopicRules, useTopicMembers } from "../hooks/useCommunity";
import { useCourses } from "../hooks/useCourses";
import { usePlans } from "../hooks/useMemberships";
import { Badge } from "../components/ui/Badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Select } from "../components/ui/select";
import { Button } from "../components/ui/button";

function ManageAccessModal({ slug, topicId, isOpen, onClose }: { slug: string, topicId: string | null, isOpen: boolean, onClose: () => void }) {
    const { data: topic, isLoading } = useTopicDetails(slug, topicId);
    const { data: courses } = useCourses(slug);
    const { data: plans } = usePlans(slug);
    const { addRule, removeRule } = useTopicRules(slug, topicId!);
    const [newRule, setNewRule] = useState<{ type: 'course' | 'membership_plan'; targetId: string }>({ type: 'course', targetId: '' });

    if (!isOpen) return null;

    const handleAddRule = async () => {
        if (!newRule.targetId) return;
        try {
            await addRule.mutateAsync(newRule);
            setNewRule({ type: 'course', targetId: '' });
            toast.success("Access rule added");
        } catch (e) {
            toast.error("Failed to add rule");
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Manage Access: {topic?.name}</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div>
                        <h4 className="text-sm font-bold mb-3 text-zinc-900 dark:text-zinc-100">Active Rules</h4>
                        <div className="space-y-2">
                            {topic?.rules?.length === 0 && (
                                <p className="text-xs text-zinc-500 italic">No access rules defined. Only manual members can access this private topic.</p>
                            )}
                            {topic?.rules?.map((rule: any) => (
                                <div key={rule.id} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center">
                                            {rule.type === 'course' ? <Trophy size={14} className="text-blue-500" /> : <Shield size={14} className="text-purple-500" />}
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                                                {rule.type === 'course' ? 'Course Enrollment' : 'Membership Plan'}
                                            </p>
                                            <p className="text-[10px] text-zinc-500 truncate max-w-[180px]">
                                                {rule.type === 'course'
                                                    ? courses?.find((c: any) => c.id === rule.targetId)?.title || rule.targetId
                                                    : plans?.find((p: any) => p.id === rule.targetId)?.name || rule.targetId}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => removeRule.mutate(rule.id)}
                                        className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-zinc-400 hover:text-rose-500 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                        <h4 className="text-sm font-bold mb-3 text-zinc-900 dark:text-zinc-100">Add New Rule</h4>
                        <div className="grid grid-cols-1 gap-3">
                            <Select
                                value={newRule.type}
                                onChange={(e: any) => setNewRule({ type: e.target.value, targetId: '' })}
                            >
                                <option value="course">Course Enrollment</option>
                                <option value="membership_plan">Membership Plan</option>
                            </Select>

                            <Select
                                value={newRule.targetId}
                                onChange={(e: any) => setNewRule({ ...newRule, targetId: e.target.value })}
                            >
                                <option value="">Select Target...</option>
                                {newRule.type === 'course' ? (
                                    courses?.map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)
                                ) : (
                                    plans?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)
                                )}
                            </Select>

                            <Button
                                className="w-full mt-2"
                                disabled={!newRule.targetId || addRule.isPending}
                                onClick={handleAddRule}
                            >
                                <Plus size={16} className="mr-2" /> Add Rule
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export const loader = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const { slug } = args.params;
    try {
        const settings = await apiRequest<any>(`/community/settings`, token, {
            headers: { 'x-tenant-slug': slug }
        });
        return { settings, error: null };
    } catch (e: any) {
        return { settings: null, error: e.message };
    }
};

export default function TenantCommunitySettings() {
    const { settings, error } = useLoaderData<any>();
    const { slug } = useParams();
    const { getToken } = useAuth();
    const revalidator = useRevalidator();
    const [updating, setUpdating] = useState(false);

    const [form, setForm] = useState({
        emailEnabled: settings?.emailEnabled ?? false,
        smsEnabled: settings?.smsEnabled ?? false,
        reactionsEnabled: settings?.reactionsEnabled ?? true,
        milestonesEnabled: settings?.milestonesEnabled ?? true,
        profilePreviewsEnabled: settings?.profilePreviewsEnabled ?? true,
    });

    const { topics, updateTopic } = useCommunityTopics(slug!, { includeArchived: true });
    const [accessModalTopicId, setAccessModalTopicId] = useState<string | null>(null);

    if (error) return <div className="p-8 text-rose-600 font-medium">Error loading settings: {error}</div>;

    const handleSave = async () => {
        setUpdating(true);
        try {
            const token = await getToken();
            await apiRequest(`/community/settings`, token, {
                method: "PATCH",
                headers: { 'x-tenant-slug': slug! },
                body: JSON.stringify(form)
            });
            toast.success("Community notification settings updated");
            revalidator.revalidate();
        } catch (e) {
            toast.error("Failed to update settings");
        } finally {
            setUpdating(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
            <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <a
                        href={`/studio/${slug}/community`}
                        className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 transition-colors"
                    >
                        <ChevronLeft size={20} />
                    </a>
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">Community Settings</h1>
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Configure how your studio interacts with the community hub.</p>
                    </div>
                </div>
                <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl">
                    <MessagesSquare size={24} className="text-zinc-600 dark:text-zinc-400" />
                </div>
            </div>

            <div className="space-y-6">
                <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                            <Bell size={18} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Notification Preferences</h2>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800/50 transition-all hover:bg-zinc-100/50 dark:hover:bg-zinc-800/80">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
                                    <Mail size={18} className="text-zinc-500" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-zinc-900 dark:text-zinc-50">New Post Email Alerts</h3>
                                    <p className="text-xs text-zinc-500 mt-1">Send an automated email to all community members when you make a new post.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setForm(f => ({ ...f, emailEnabled: !f.emailEnabled }))}
                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-1 dark:focus:ring-offset-zinc-900 ${form.emailEnabled ? 'bg-blue-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                            >
                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${form.emailEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800/50 transition-all hover:bg-zinc-100/50 dark:hover:bg-zinc-800/80">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
                                    <MessageSquare size={18} className="text-zinc-500" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-zinc-900 dark:text-zinc-50">New Post SMS Alerts</h3>
                                    <p className="text-xs text-zinc-500 mt-1">Send a push/text notification when a new post is published in your hub.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setForm(f => ({ ...f, smsEnabled: !f.smsEnabled }))}
                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-1 dark:focus:ring-offset-zinc-900 ${form.smsEnabled ? 'bg-blue-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                            >
                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${form.smsEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-xl">
                            <Shield size={18} className="text-purple-600 dark:text-purple-400" />
                        </div>
                        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Feature Controls</h2>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800/50 transition-all hover:bg-zinc-100/50 dark:hover:bg-zinc-800/80">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
                                    <Heart size={18} className="text-pink-500" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-zinc-900 dark:text-zinc-50">Multi-Emoji Reactions</h3>
                                    <p className="text-xs text-zinc-500 mt-1">Allow members to react with Heart, Celebrate, and Fire emojis.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setForm(f => ({ ...f, reactionsEnabled: !f.reactionsEnabled }))}
                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-1 dark:focus:ring-offset-zinc-900 ${form.reactionsEnabled ? 'bg-blue-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                            >
                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${form.reactionsEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800/50 transition-all hover:bg-zinc-100/50 dark:hover:bg-zinc-800/80">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
                                    <Trophy size={18} className="text-yellow-500" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-zinc-900 dark:text-zinc-50">Milestone Auto-Posts</h3>
                                    <p className="text-xs text-zinc-500 mt-1">Automatically announce when members hit 10, 50, or 100 classes.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setForm(f => ({ ...f, milestonesEnabled: !f.milestonesEnabled }))}
                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-1 dark:focus:ring-offset-zinc-900 ${form.milestonesEnabled ? 'bg-blue-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                            >
                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${form.milestonesEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800/50 transition-all hover:bg-zinc-100/50 dark:hover:bg-zinc-800/80">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
                                    <Users size={18} className="text-blue-500" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-zinc-900 dark:text-zinc-50">Member Profile Previews</h3>
                                    <p className="text-xs text-zinc-500 mt-1">Show a popover with class counts and join date when hovering over an avatar.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setForm(f => ({ ...f, profilePreviewsEnabled: !f.profilePreviewsEnabled }))}
                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-1 dark:focus:ring-offset-zinc-900 ${form.profilePreviewsEnabled ? 'bg-blue-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                            >
                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${form.profilePreviewsEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                            <Settings2 size={18} className="text-zinc-600 dark:text-zinc-400" />
                        </div>
                        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Topic Management</h2>
                    </div>

                    <div className="space-y-3">
                        {topics?.map((topic: any) => (
                            <div key={topic.id} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800/50 transition-all hover:bg-zinc-100/50 dark:hover:bg-zinc-800/80">
                                <div className="flex items-center gap-4 overflow-hidden">
                                    <div className="h-10 w-10 flex-shrink-0 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-xl shadow-sm">
                                        {topic.icon === 'Hash' ? '#' : topic.icon}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-zinc-900 dark:text-zinc-50 truncate">{topic.name}</h3>
                                            {topic.isArchived && <Badge variant="secondary" className="bg-zinc-200 text-zinc-600 text-[10px] px-1.5 h-4 uppercase">Archived</Badge>}
                                            <Badge variant="outline" className="text-[10px] px-1.5 h-4 uppercase flex items-center gap-1">
                                                {topic.visibility === 'public' ? <Globe size={10} /> : <Lock size={10} />}
                                                {topic.visibility}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-[240px]">{topic.description || 'No description'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {topic.visibility === 'private' && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 text-xs gap-2 rounded-lg"
                                            onClick={() => setAccessModalTopicId(topic.id)}
                                        >
                                            <Users size={14} /> Rules
                                        </Button>
                                    )}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 text-xs gap-2 rounded-lg"
                                        onClick={() => updateTopic.mutate({
                                            id: topic.id,
                                            data: { isArchived: !topic.isArchived }
                                        })}
                                    >
                                        {topic.isArchived ? <><Plus size={14} /> Unarchive</> : <><Archive size={14} /> Archive</>}
                                    </Button>
                                    <Select
                                        className="h-8 text-[10px] w-28 rounded-lg"
                                        value={topic.visibility}
                                        onChange={(e: any) => updateTopic.mutate({
                                            id: topic.id,
                                            data: { visibility: e.target.value }
                                        })}
                                    >
                                        <option value="public">Public Topic</option>
                                        <option value="private">Private Topic</option>
                                    </Select>
                                </div>
                            </div>
                        ))}
                    </div>

                    <p className="text-[10px] text-zinc-500 mt-6 flex items-center gap-1.5 px-2">
                        <Lock size={10} className="text-zinc-400" /> Private topics are only visible to members who meet specific enrollment rules or were added manually.
                    </p>
                </div>

                <ManageAccessModal
                    slug={slug!}
                    topicId={accessModalTopicId}
                    isOpen={!!accessModalTopicId}
                    onClose={() => setAccessModalTopicId(null)}
                />

                <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl flex items-start gap-4">
                    <Shield size={20} className="text-zinc-400 mt-0.5" />
                    <div className="flex-1">
                        <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Platform Override</h4>
                        <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                            Note: Global platform administrators can disable these alerts across all studios for compliance or system maintenance. If alerts are disabled globally, your settings will be temporarily ignored.
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4">
                    <button
                        onClick={() => revalidator.revalidate()}
                        className="px-6 py-2.5 rounded-xl font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all text-sm"
                    >
                        Discard changes
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={updating}
                        className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50 text-sm"
                    >
                        {updating ? "Saving..." : <><Save size={16} /> Save settings</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
