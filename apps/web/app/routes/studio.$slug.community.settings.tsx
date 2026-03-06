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
    Users
} from "lucide-react";

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
