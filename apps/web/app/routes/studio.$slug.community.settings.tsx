import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
    X,
    BookOpen,
    CreditCard,
    UserPlus,
    Search,
    Minus
} from "lucide-react";
import { useCommunityTopics, useTopicDetails, useTopicRules, useTopicMembers } from "../hooks/useCommunity";
import { useMembers } from "../hooks/useMembers";
import { useCourses } from "../hooks/useCourses";
import { usePlans } from "../hooks/useMemberships";
import { Badge } from "../components/ui/Badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Select } from "../components/ui/select";
import { Button } from "../components/ui/button";

function ManageAccessModal({ slug, topicId, isOpen, onClose }: { slug: string, topicId: string | null, isOpen: boolean, onClose: () => void }) {
    const { data: topic } = useTopicDetails(slug, topicId);
    const { data: courses } = useCourses(slug);
    const { data: plans } = usePlans(slug);
    const { addRule, removeRule } = useTopicRules(slug, topicId!);
    const { addMember } = useTopicMembers(slug, topicId!);

    const [newRule, setNewRule] = useState<{ type: 'course' | 'membership_plan'; targetId: string }>({ type: 'course', targetId: '' });
    const [memberSearch, setMemberSearch] = useState('');
    const { data: membersData } = useMembers(slug, { search: memberSearch, limit: 5 }) as { data: any };
    const queryClient = useQueryClient();

    const handleAddRule = async () => {
        if (!newRule.targetId) return;
        try {
            await addRule.mutateAsync(newRule);
            setNewRule(prev => ({ ...prev, targetId: '' }));
            toast.success("Access rule added");
        } catch (e) {
            toast.error("Failed to add rule");
        }
    };

    const handleAddMember = async (memberId: string) => {
        try {
            await addMember.mutateAsync({ memberId });
            setMemberSearch('');
            toast.success("Member added to topic");
        } catch (e) {
            toast.error("Failed to add member");
        }
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Lock size={18} className="text-zinc-600" />
                        Manage Access: {topic?.name}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-8 py-4">
                    {/* Active Rules Section */}
                    <div>
                        <h4 className="text-sm font-bold mb-3 text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            <Shield size={14} className="text-zinc-400" /> Access Control
                        </h4>
                        <div className="space-y-2">
                            {topic?.rules?.length === 0 && (
                                <p className="text-xs text-zinc-500 italic px-2">No dynamic rules defined.</p>
                            )}
                            {topic?.rules?.map((rule: any) => (
                                <div key={rule.id} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
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

                        <div className="mt-4 p-4 bg-zinc-50 dark:bg-zinc-800/30 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                            <div className="grid grid-cols-1 gap-3">
                                <Select
                                    value={newRule.type}
                                    onChange={(e: any) => setNewRule({ type: e.target.value as any, targetId: '' })}
                                    className="h-9 text-xs"
                                >
                                    <option value="course">Access via Course Enrollment</option>
                                    <option value="membership_plan">Access via Membership Plan</option>
                                </Select>

                                <Select
                                    value={newRule.targetId}
                                    onChange={(e: any) => setNewRule({ ...newRule, targetId: e.target.value })}
                                    className="h-9 text-xs"
                                >
                                    <option value="">Select Target...</option>
                                    {newRule.type === 'course' ? (
                                        courses?.map((c: any) => <option key={c.id} value={c.id}>{c.title}</option>)
                                    ) : (
                                        plans?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)
                                    )}
                                </Select>

                                <Button
                                    size="sm"
                                    className="w-full"
                                    disabled={!newRule.targetId || addRule.isPending}
                                    onClick={handleAddRule}
                                >
                                    <Plus size={14} className="mr-2" /> Add Access Rule
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Manual Members Section */}
                    <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800">
                        <h4 className="text-sm font-bold mb-3 text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            <UserPlus size={14} className="text-zinc-400" /> Manual Invitations
                        </h4>

                        <div className="relative mb-4">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                            <input
                                type="text"
                                placeholder="Search students by name or email..."
                                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                                value={memberSearch}
                                onChange={(e) => setMemberSearch(e.target.value)}
                            />

                            {memberSearch && membersData && membersData.members.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-10 overflow-hidden">
                                    {membersData.members.map((m: any) => (
                                        <button
                                            key={m.id}
                                            onClick={() => handleAddMember(m.id)}
                                            className="w-full flex items-center gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-left"
                                        >
                                            <div className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-bold">
                                                {m.profile?.firstName?.[0]}{m.profile?.lastName?.[0]}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                                    {m.profile?.firstName} {m.profile?.lastName}
                                                </p>
                                                <p className="text-[10px] text-zinc-500 truncate">{m.user?.email}</p>
                                            </div>
                                            <Plus size={14} className="ml-auto text-zinc-400" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            {topic?.memberships?.length === 0 && (
                                <p className="text-xs text-zinc-500 italic px-2">No manual members added.</p>
                            )}
                            {topic?.memberships?.map((membership: any) => (
                                <div key={membership.id} className="flex items-center justify-between p-2 pl-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="h-6 w-6 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-[8px] font-bold">
                                            {membership.member?.profile?.firstName?.[0]}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                                {membership.member?.profile?.firstName} {membership.member?.profile?.lastName}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            const token = await (window as any).Clerk?.session?.getToken();
                                            await apiRequest(`/community/topics/members/${membership.id}`, token, {
                                                method: 'DELETE',
                                                headers: { 'x-tenant-slug': slug }
                                            });
                                            toast.success("Member removed");
                                            queryClient.invalidateQueries({ queryKey: ['community', 'topic', slug, topicId] });
                                        }}
                                        className="p-1 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-zinc-400 hover:text-rose-500 rounded-lg transition-colors"
                                    >
                                        <Minus size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <Button
                            variant="default"
                            className="px-8 rounded-xl"
                            onClick={onClose}
                        >
                            Done
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function TopicConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText,
    variant = "default"
}: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText: string;
    variant?: "default" | "destructive" | "secondary" | "outline" | "ghost" | "link";
}) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription className="pt-2 text-zinc-500 text-xs">
                        {message}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex items-center justify-end gap-3 mt-6">
                    <Button variant="ghost" size="sm" onClick={onClose} className="rounded-xl">Cancel</Button>
                    <Button
                        variant={variant}
                        size="sm"
                        className="rounded-xl px-6"
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                    >
                        {confirmText}
                    </Button>
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

    const { topics, updateTopic, deleteTopic, removeRule, removeMember } = useCommunityTopics(slug!, { includeArchived: true });
    const { data: courses } = useCourses(slug!);
    const { data: plans } = usePlans(slug!);
    const [accessModalTopicId, setAccessModalTopicId] = useState<string | null>(null);
    const [confirmAction, setConfirmAction] = useState<{
        type: 'archive' | 'unarchive' | 'delete' | 'remove_rule' | 'remove_member',
        id: string,
        name: string
    } | null>(null);

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
                            <div key={topic.id} className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800/50 transition-all hover:bg-zinc-100/50 dark:hover:bg-zinc-800/80">
                                <div className="flex items-center justify-between gap-4">
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
                                                <Users size={14} /> Access Control
                                            </Button>
                                        )}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 text-xs gap-2 rounded-lg"
                                            onClick={() => setConfirmAction({
                                                type: topic.isArchived ? 'unarchive' : 'archive',
                                                id: topic.id,
                                                name: topic.name
                                            })}
                                        >
                                            {topic.isArchived ? <><Plus size={14} /> Unarchive</> : <><Archive size={14} /> Archive</>}
                                        </Button>

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-zinc-400 hover:text-rose-600 rounded-lg"
                                            onClick={() => setConfirmAction({
                                                type: 'delete',
                                                id: topic.id,
                                                name: topic.name
                                            })}
                                        >
                                            <Trash2 size={14} />
                                        </Button>

                                        <Select
                                            className="h-8 text-[10px] w-28 rounded-lg outline-none"
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

                                { /* Rules & Members Info Section (Moved below and organized into columns) */}
                                {(topic.rules?.length > 0 || topic.memberships?.length > 0) && (
                                    <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
                                            {/* Column 1: Memberships (Plans) */}
                                            <div className="space-y-2">
                                                <h4 className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider flex items-center gap-1.5">
                                                    <CreditCard size={10} /> Memberships
                                                </h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {topic.rules?.filter((r: any) => r.type === 'membership_plan').map((rule: any) => (
                                                        <div key={rule.id} className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-[10px] font-medium text-blue-700 dark:text-blue-300 rounded-lg border border-blue-100 dark:border-blue-800/50">
                                                            <span className="font-bold">
                                                                {plans?.find((p: any) => p.id === rule.targetId)?.name || rule.targetId}
                                                            </span>
                                                            <button
                                                                onClick={() => setConfirmAction({
                                                                    type: 'remove_rule',
                                                                    id: rule.id,
                                                                    name: `the ${plans?.find((p: any) => p.id === rule.targetId)?.name || 'plan'} rule`
                                                                })}
                                                                className="ml-1 p-0.5 hover:bg-blue-100 dark:hover:bg-blue-800/50 rounded-md transition-colors"
                                                            >
                                                                <X size={10} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    {topic.rules?.filter((r: any) => r.type === 'membership_plan').length === 0 && (
                                                        <span className="text-[10px] text-zinc-400 italic">No plan rules</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Column 2: Courses */}
                                            <div className="space-y-2">
                                                <h4 className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider flex items-center gap-1.5">
                                                    <BookOpen size={10} /> Courses
                                                </h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {topic.rules?.filter((r: any) => r.type === 'course').map((rule: any) => (
                                                        <div key={rule.id} className="inline-flex items-center gap-1.5 px-2 py-1 bg-purple-50 dark:bg-purple-900/20 text-[10px] font-medium text-purple-700 dark:text-purple-300 rounded-lg border border-purple-100 dark:border-purple-800/50">
                                                            <span className="font-bold">
                                                                {courses?.find((c: any) => c.id === rule.targetId)?.title || rule.targetId}
                                                            </span>
                                                            <button
                                                                onClick={() => setConfirmAction({
                                                                    type: 'remove_rule',
                                                                    id: rule.id,
                                                                    name: `the ${courses?.find((c: any) => c.id === rule.targetId)?.title || 'course'} rule`
                                                                })}
                                                                className="ml-1 p-0.5 hover:bg-purple-100 dark:hover:bg-purple-800/50 rounded-md transition-colors"
                                                            >
                                                                <X size={10} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    {topic.rules?.filter((r: any) => r.type === 'course').length === 0 && (
                                                        <span className="text-[10px] text-zinc-400 italic">No course rules</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Column 3: Individual Members */}
                                            <div className="space-y-2">
                                                <h4 className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider flex items-center gap-1.5">
                                                    <Users size={10} /> Members
                                                </h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {topic.memberships?.map((m: any) => (
                                                        <div key={m.id} className="inline-flex items-center gap-2 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-[10px] font-medium text-blue-700 dark:text-blue-300 rounded-lg border border-blue-100 dark:border-blue-800/50">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold">
                                                                    {m.member?.user?.profile?.firstName} {m.member?.user?.profile?.lastName}
                                                                </span>
                                                                <span className="text-[9px] opacity-70 leading-none mt-0.5">
                                                                    {m.member?.user?.email}
                                                                </span>
                                                            </div>
                                                            <button
                                                                onClick={() => setConfirmAction({
                                                                    type: 'remove_member',
                                                                    id: m.id,
                                                                    name: `${m.member?.user?.profile?.firstName} ${m.member?.user?.profile?.lastName} (${m.member?.user?.email})`
                                                                })}
                                                                className="ml-1 p-0.5 hover:bg-blue-100 dark:hover:bg-blue-800/50 rounded-md transition-colors"
                                                            >
                                                                <X size={10} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    {topic.memberships?.length === 0 && (
                                                        <span className="text-[10px] text-zinc-400 italic">No manual members</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
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

                <TopicConfirmModal
                    isOpen={!!confirmAction}
                    onClose={() => setConfirmAction(null)}
                    title={
                        confirmAction?.type === 'delete' ? "Delete Topic" :
                            confirmAction?.type === 'archive' ? "Archive Topic" :
                                confirmAction?.type === 'unarchive' ? "Unarchive Topic" :
                                    confirmAction?.type === 'remove_rule' ? "Remove Access Control" : "Remove Member"
                    }
                    message={
                        confirmAction?.type === 'delete' ? `Are you sure you want to permanently delete "${confirmAction?.name || ''}"? This action cannot be undone.` :
                            confirmAction?.type === 'archive' ? `Are you sure you want to archive "${confirmAction?.name || ''}"? It will be hidden from the community hub.` :
                                confirmAction?.type === 'unarchive' ? `Are you sure you want to restore "${confirmAction?.name || ''}" to the community hub?` :
                                    confirmAction?.type === 'remove_rule' ? `Are you sure you want to remove ${confirmAction?.name || ''}?` :
                                        `Are you sure you want to remove ${confirmAction?.name || ''} from this topic?`
                    }
                    confirmText={
                        confirmAction?.type === 'delete' ? "Delete Permanently" :
                            confirmAction?.type === 'archive' ? "Archive Topic" :
                                confirmAction?.type === 'unarchive' ? "Unarchive Topic" : "Remove Access"
                    }
                    variant={confirmAction?.type === 'delete' || confirmAction?.type === 'remove_rule' || confirmAction?.type === 'remove_member' ? "destructive" : "default"}
                    onConfirm={() => {
                        if (!confirmAction) return;
                        if (confirmAction.type === 'delete') {
                            deleteTopic.mutate(confirmAction.id);
                        } else if (confirmAction.type === 'archive' || confirmAction.type === 'unarchive') {
                            updateTopic.mutate({
                                id: confirmAction.id,
                                data: { isArchived: confirmAction.type === 'archive' }
                            });
                        } else if (confirmAction.type === 'remove_rule') {
                            removeRule.mutate(confirmAction.id);
                        } else if (confirmAction.type === 'remove_member') {
                            removeMember.mutate(confirmAction.id);
                        }
                    }}
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
