
import { useState, useRef } from "react";
import { Link, useParams } from "react-router";
import {
    MessageSquare,
    Heart,
    Share2,
    MoreVertical,
    Send,
    Settings,
    Image as ImageIcon,
    Video,
    Music,
    Smile,
    Sparkles,
    Pin,
    Flame,
    Trophy,
    Calendar,
    Users,
    X,
    Hash,
    ChevronDown,
    ChevronRight,
    Search,
    PlusCircle,
    LayoutGrid,
    Trash2,
    Archive,
    Pencil,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "~/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { Input } from "~/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/Avatar";
import { Badge } from "~/components/ui/Badge";
import { Label } from "~/components/ui/label";
import { useCommunity, useCommunityTopics, useCommunityComments, useMemberPreview } from "~/hooks/useCommunity";
import { cn } from "~/lib/utils";
import { apiRequest } from "~/utils/api";
import { useAuth, useUser } from "@clerk/react-router";

export default function CommunityHub({ slug: propsSlug }: { slug?: string }) {
    const { slug: paramsSlug } = useParams();
    const slug = propsSlug || paramsSlug;
    const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
    const { posts, isLoading, createPost, reactToPost, commentOnPost, generateAIContent } = useCommunity(slug!, { topicId: selectedTopicId || undefined });
    const { topics, isLoading: isLoadingTopics, createTopic, deleteTopic, updateTopic } = useCommunityTopics(slug!);

    const { getToken } = useAuth();
    const { user } = useUser();

    // Get user initials for avatar fallback
    const initials = user
        ? `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`.toUpperCase() || user.emailAddresses[0]?.emailAddress?.charAt(0).toUpperCase()
        : "??";

    const [newPostContent, setNewPostContent] = useState("");
    const [selectedPostTopicId, setSelectedPostTopicId] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
    const [commentText, setCommentText] = useState("");
    const [previewMemberId, setPreviewMemberId] = useState<string | null>(null);
    const [selectedMedia, setSelectedMedia] = useState<{ url: string; type: 'image' | 'video' }[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isCreateTopicOpen, setIsCreateTopicOpen] = useState(false);
    const [isEditTopicOpen, setIsEditTopicOpen] = useState(false);
    const [editingTopic, setEditingTopic] = useState<any>(null);
    const [newTopic, setNewTopic] = useState({ name: '', description: '', icon: 'Hash', color: '#3b82f6' });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);

    const REACTION_TYPES = [
        { type: 'like', icon: Heart, label: 'Like', color: 'text-red-500', bg: 'hover:bg-red-50', fill: 'fill-red-500' },
        { type: 'heart', icon: Heart, label: 'Love', color: 'text-pink-500', bg: 'hover:bg-pink-50', fill: 'fill-pink-500' },
        { type: 'celebrate', icon: Sparkles, label: 'Celebrate', color: 'text-yellow-500', bg: 'hover:bg-yellow-50', fill: 'fill-yellow-500' },
        { type: 'fire', icon: Flame, label: 'Fire', color: 'text-orange-500', bg: 'hover:bg-orange-50', fill: 'fill-orange-500' },
    ] as const;

    const EMOJIS = ["✨", "🔥", "💪", "🧘‍♀️", "🧘‍♂️", "🤍", "🙌", "🎉", "🙏", "🚀", "💡", "🌈", "❤️", "😊", "👋"];

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const token = await getToken();
            const formData = new FormData();
            formData.append('file', file);

            const res = await apiRequest(`/uploads`, token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': slug! },
                body: formData
            });

            setSelectedMedia(prev => [...prev, { url: res.url, type }]);
            toast.success(`${type === 'image' ? 'Photo' : 'Video'} attached: ${file.name}`);
        } catch (err: any) {
            console.error("Upload failed:", err);
            toast.error(err.message || "Failed to upload file");
        } finally {
            setIsUploading(false);
            if (e.target) e.target.value = '';
        }
    };

    const handleCreatePost = async () => {
        if (!newPostContent.trim() && selectedMedia.length === 0) return;
        try {
            await createPost.mutateAsync({
                content: newPostContent,
                media: selectedMedia.length > 0 ? selectedMedia : undefined,
                topicId: selectedPostTopicId || undefined
            });
            setNewPostContent("");
            setSelectedMedia([]);
            setSelectedPostTopicId(null);
            toast.success("Post shared with the community!");
        } catch (e) {
            toast.error("Failed to share post");
        }
    };

    const handleAiAssist = async () => {
        if (!newPostContent.trim()) {
            toast.info("Enter a brief idea first, then click AI Assist");
            return;
        }
        setIsGenerating(true);
        try {
            const res = await generateAIContent.mutateAsync(newPostContent);
            if (res.content) {
                setNewPostContent(res.content);
                toast.success("AI helper active! ✨");
            } else {
                throw new Error("AI returned empty content");
            }
        } catch (e: any) {
            console.error("AI Assist failed:", e);
            toast.error("AI was unable to help this time.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleReact = (postId: string, type: 'like' | 'heart' | 'celebrate' | 'fire' = 'like') => {
        reactToPost.mutate({ postId, type });
    };

    const handleComment = async (postId: string, parentId?: string) => {
        if (!commentText.trim()) return;
        try {
            await commentOnPost.mutateAsync({ postId, content: commentText, parentId });
            setCommentText("");
            toast.success("Comment added");
        } catch (e) {
            toast.error("Failed to add comment");
        }
    };

    const handleCreateTopic = async () => {
        if (!newTopic.name.trim()) return;
        try {
            await createTopic.mutateAsync(newTopic);
            setNewTopic({ name: '', description: '', icon: 'Hash', color: '#3b82f6' });
            setIsCreateTopicOpen(false);
            toast.success("Topic created!");
        } catch (e: any) {
            toast.error(e.message || "Failed to create topic");
        }
    };

    const handleDeleteTopic = async (topicId: string) => {
        if (!confirm("Are you sure you want to delete this topic? All posts in this topic will be removed.")) return;
        try {
            await deleteTopic.mutateAsync(topicId);
            if (selectedTopicId === topicId) setSelectedTopicId(null);
            toast.success("Topic deleted");
        } catch (e) {
            toast.error("Failed to delete topic");
        }
    };

    const handleArchiveTopic = async (topicId: string) => {
        try {
            await updateTopic.mutateAsync({ id: topicId, data: { isArchived: true } });
            if (selectedTopicId === topicId) setSelectedTopicId(null);
            toast.success("Topic archived");
        } catch (e) {
            toast.error("Failed to archive topic");
        }
    };

    const handleEditTopic = async () => {
        if (!editingTopic || !editingTopic.name.trim()) return;
        try {
            await updateTopic.mutateAsync({
                id: editingTopic.id,
                data: {
                    name: editingTopic.name,
                    description: editingTopic.description,
                    visibility: editingTopic.visibility
                }
            });
            setIsEditTopicOpen(false);
            setEditingTopic(null);
            toast.success("Topic updated");
        } catch (e: any) {
            toast.error(e.message || "Failed to update topic");
        }
    };

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="text-muted-foreground animate-pulse">Gathering community updates...</p>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-8">
            <header className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Community Hub</h1>
                    <p className="text-muted-foreground">Connect and grow with your studio family.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="md:hidden">
                        <Users size={20} />
                    </Button>
                    <Link
                        to={`/studio/${slug}/community/settings`}
                        className="p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all text-zinc-500"
                    >
                        <Settings size={20} />
                    </Link>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Left Sidebar: Topics */}
                <aside className="hidden lg:block space-y-6">
                    <Card className="border-none shadow-md bg-muted/20">
                        <CardHeader className="p-4 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <LayoutGrid size={16} /> Topics
                            </CardTitle>
                            {/* Only admins can manage topics? For now generic marketing permission */}
                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => setIsCreateTopicOpen(true)}>
                                <PlusCircle size={14} />
                            </Button>
                        </CardHeader>
                        <CardContent className="p-2 space-y-1">
                            <button
                                onClick={() => setSelectedTopicId(null)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-medium text-sm",
                                    !selectedTopicId ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "hover:bg-muted text-muted-foreground"
                                )}
                            >
                                <Users size={18} />
                                Everyone
                            </button>
                            {topics.map((topic: any) => (
                                <div key={topic.id} className="group relative">
                                    <button
                                        onClick={() => setSelectedTopicId(topic.id)}
                                        className={cn(
                                            "w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all font-medium text-sm",
                                            selectedTopicId === topic.id ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "hover:bg-muted text-muted-foreground"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Hash size={18} className={cn(selectedTopicId === topic.id ? "text-primary-foreground" : "text-primary")} />
                                            {topic.name}
                                        </div>
                                        {topic.isNew && <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
                                    </button>

                                    {/* Admin Controls */}
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 rounded-full hover:bg-background/20 text-current"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingTopic(topic);
                                                setIsEditTopicOpen(true);
                                            }}
                                            title="Edit Topic"
                                        >
                                            <Pencil size={12} />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 rounded-full hover:bg-background/20 text-current"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleArchiveTopic(topic.id);
                                            }}
                                            title="Archive Topic"
                                        >
                                            <Archive size={12} />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 rounded-full hover:bg-destructive/10 text-destructive"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteTopic(topic.id);
                                            }}
                                            title="Delete Topic"
                                        >
                                            <Trash2 size={12} />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                            {topics.length === 0 && (
                                <div className="p-4 text-center space-y-2 opacity-50">
                                    <p className="text-xs">No specific topics created yet.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-md bg-gradient-to-br from-indigo-500/10 to-purple-500/10">
                        <CardContent className="p-6 text-center space-y-3">
                            <div className="h-10 w-10 bg-indigo-500 rounded-xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/20">
                                <Trophy className="text-white" size={20} />
                            </div>
                            <h3 className="font-bold text-sm">Community Goals</h3>
                            <p className="text-xs text-muted-foreground">We've completed 450 classes together this month!</p>
                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 w-[65%]" />
                            </div>
                        </CardContent>
                    </Card>
                </aside>

                {/* Main Feed */}
                <main className="lg:col-span-3 space-y-8">
                    {/* Create Post Card */}
                    <Card className="border-none shadow-xl bg-gradient-to-br from-background to-muted/30 overflow-hidden ring-1 ring-border/50">
                        <CardContent className="p-6">
                            <div className="flex gap-4">
                                <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                                    {user?.imageUrl && <AvatarImage src={user.imageUrl} />}
                                    <AvatarFallback>{initials}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 space-y-4">
                                    <textarea
                                        placeholder="What's on your mind? Share a thought, photo, or update..."
                                        className="w-full bg-transparent border-none focus:ring-0 resize-none text-lg min-h-[100px]"
                                        value={newPostContent}
                                        onChange={(e) => setNewPostContent(e.target.value)}
                                    />

                                    {/* Topic Selector */}
                                    <div className="flex flex-wrap gap-2">
                                        {topics.map((topic: any) => (
                                            <button
                                                key={topic.id}
                                                onClick={() => setSelectedPostTopicId(selectedPostTopicId === topic.id ? null : topic.id)}
                                                className={cn(
                                                    "px-3 py-1.5 rounded-full text-xs font-semibold transition-all border",
                                                    selectedPostTopicId === topic.id
                                                        ? "bg-primary border-primary text-primary-foreground shadow-md"
                                                        : "bg-background border-border text-muted-foreground hover:border-primary/50"
                                                )}
                                            >
                                                # {topic.name}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Media Previews */}
                                    {selectedMedia.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {selectedMedia.map((media, idx) => (
                                                <div key={idx} className="relative h-20 w-20 rounded-lg overflow-hidden border group">
                                                    {media.type === 'image' ? (
                                                        <img src={media.url} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <div className="h-full w-full bg-muted flex items-center justify-center">
                                                            <Video className="h-6 w-6 text-muted-foreground" />
                                                        </div>
                                                    )}
                                                    <button
                                                        onClick={() => setSelectedMedia(prev => prev.filter((_, i) => i !== idx))}
                                                        className="absolute top-1 right-1 p-0.5 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between border-t pt-4">
                                        <div className="flex items-center gap-2">
                                            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={(e) => handleFileUpload(e, 'image')} />
                                            <input type="file" accept="video/*" className="hidden" ref={videoInputRef} onChange={(e) => handleFileUpload(e, 'video')} />
                                            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary transition-colors" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                                                <ImageIcon className="h-5 w-5" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary transition-colors" onClick={() => videoInputRef.current?.click()} disabled={isUploading}>
                                                <Video className="h-5 w-5" />
                                            </Button>

                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary transition-colors">
                                                        <Smile className="h-5 w-5" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-64 p-2">
                                                    <div className="grid grid-cols-5 gap-1">
                                                        {EMOJIS.map(emoji => (
                                                            <button key={emoji} onClick={() => setNewPostContent(prev => prev + emoji)} className="h-10 text-xl hover:bg-muted rounded-md transition-colors">
                                                                {emoji}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="gap-2 border-primary/20 hover:bg-primary/5 text-primary"
                                                onClick={handleAiAssist}
                                                disabled={isGenerating || !newPostContent.trim()}
                                            >
                                                <Sparkles className={cn("h-4 w-4", isGenerating && "animate-pulse")} />
                                                {isGenerating ? "Thinking..." : "AI Assist"}
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="gap-2 px-6 shadow-lg shadow-primary/20"
                                                onClick={handleCreatePost}
                                                disabled={createPost.isPending || (!newPostContent.trim() && selectedMedia.length === 0)}
                                            >
                                                <Send className="h-4 w-4" />
                                                Post
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Feed */}
                    <div className="space-y-6">
                        {posts.map((post) => (
                            <PostCard
                                key={post.id}
                                post={post}
                                slug={slug!}
                                onReact={handleReact}
                                onComment={handleComment}
                                onPreview={() => setPreviewMemberId(post.authorId)}
                                reactionTypes={REACTION_TYPES}
                            />
                        ))}

                        {!isLoading && posts.length === 0 && (
                            <div className="py-20 text-center space-y-4 border-2 border-dashed rounded-3xl opacity-50 bg-muted/10">
                                <div className="h-12 w-12 bg-muted rounded-full flex items-center justify-center mx-auto">
                                    <MessageSquare className="h-6 w-6 text-muted-foreground" />
                                </div>
                                <div className="space-y-1">
                                    <p className="font-semibold text-lg">No posts yet</p>
                                    <p className="text-sm text-muted-foreground">Be the first to share something in this topic!</p>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>

            <MemberPreviewModal
                slug={slug!}
                memberId={previewMemberId}
                onClose={() => setPreviewMemberId(null)}
            />

            {/* Create Topic Dialog */}
            <Dialog open={isCreateTopicOpen} onOpenChange={setIsCreateTopicOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create a Community Topic</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Topic Name</label>
                            <Input
                                placeholder="e.g., Workout Tips"
                                value={newTopic.name}
                                onChange={(e) => setNewTopic(prev => ({ ...prev, name: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Description</label>
                            <Input
                                placeholder="What is this space for?"
                                value={newTopic.description}
                                onChange={(e) => setNewTopic(prev => ({ ...prev, description: e.target.value }))}
                            />
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <Button variant="outline" onClick={() => setIsCreateTopicOpen(false)}>Cancel</Button>
                            <Button onClick={handleCreateTopic} disabled={createTopic.isPending}>Create Topic</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Topic Dialog */}
            <Dialog open={isEditTopicOpen} onOpenChange={setIsEditTopicOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Topic</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Topic Name</label>
                            <Input
                                placeholder="e.g. Nature, Announcements"
                                value={editingTopic?.name || ''}
                                onChange={(e) => setEditingTopic({ ...editingTopic, name: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Description (Optional)</label>
                            <Input
                                placeholder="What is this topic about?"
                                value={editingTopic?.description || ''}
                                onChange={(e) => setEditingTopic({ ...editingTopic, description: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Visibility</label>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant={editingTopic?.visibility === 'public' ? 'default' : 'outline'}
                                    className="flex-1"
                                    onClick={() => setEditingTopic({ ...editingTopic, visibility: 'public' })}
                                >
                                    Public
                                </Button>
                                <Button
                                    type="button"
                                    variant={editingTopic?.visibility === 'private' ? 'default' : 'outline'}
                                    className="flex-1"
                                    onClick={() => setEditingTopic({ ...editingTopic, visibility: 'private' })}
                                >
                                    Private
                                </Button>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditTopicOpen(false)}>Cancel</Button>
                        <Button onClick={handleEditTopic} disabled={updateTopic.isPending}>
                            {updateTopic.isPending ? "Updating..." : "Update Topic"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function PostCard({ post, slug, onReact, onComment, onPreview, reactionTypes }: {
    post: any,
    slug: string,
    onReact: any,
    onComment: any,
    onPreview: any,
    reactionTypes: any
}) {
    const [showComments, setShowComments] = useState(false);

    return (
        <Card className={cn("border-none shadow-lg transition-all hover:shadow-xl ring-1 ring-border/50", post.isPinned && "ring-primary/20 bg-primary/5")}>
            <CardHeader className="flex flex-row items-center gap-4 p-4 pb-0">
                <Avatar className="cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all" onClick={onPreview}>
                    <AvatarImage src={post.author?.user?.profile?.portraitUrl} />
                    <AvatarFallback>{post.author?.user?.profile?.firstName?.[0] || 'U'}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold">{post.author?.user?.profile?.firstName} {post.author?.user?.profile?.lastName}</span>
                        {post.isPinned && <Badge variant="secondary" className="gap-1 text-[10px] uppercase font-bold tracking-wider rounded-lg"><Pin className="h-3 w-3" /> Pinned</Badge>}
                        {post.topicId && <Badge variant="outline" className="text-[10px] text-primary/70 border-primary/20">#{post.topic?.name || 'Topic'}</Badge>}
                    </div>
                    <span className="text-xs text-muted-foreground lowercase">
                        {formatDistanceToNow(new Date(post.createdAt))} ago
                    </span>
                </div>
                <Button variant="ghost" size="icon" className="text-muted-foreground h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                </Button>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
                <div className="text-base leading-relaxed whitespace-pre-wrap">
                    {post.content}
                </div>

                {/* Media Section */}
                {post.mediaJson && Array.isArray(post.mediaJson) && post.mediaJson.length > 0 && (
                    <div className="grid gap-2 rounded-xl overflow-hidden border">
                        {post.mediaJson.map((item: any, idx: number) => (
                            <div key={idx} className="relative aspect-video bg-muted flex items-center justify-center">
                                {item.type === 'video' ? (
                                    <video src={item.url} controls className="w-full h-full object-cover" />
                                ) : item.type === 'audio' ? (
                                    <div className="flex flex-col items-center gap-2 p-8 w-full">
                                        <Music className="h-10 w-10 text-primary" />
                                        <audio src={item.url} controls className="w-full" />
                                    </div>
                                ) : (
                                    <img src={item.url} alt="Community media" className="w-full h-full object-cover" />
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Engagement Bar */}
                <div className="flex items-center justify-between border-t pt-2 mt-4">
                    <div className="flex items-center gap-1">
                        <div className="flex items-center gap-1 group relative">
                            <Button
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    "gap-2 hover:bg-muted font-medium h-9",
                                    post.userReaction && reactionTypes.find((r: any) => r.type === post.userReaction)?.color
                                )}
                                onClick={() => onReact(post.id, (post.userReaction as any) || 'like')}
                            >
                                {(() => {
                                    const r = reactionTypes.find((rt: any) => rt.type === post.userReaction) || reactionTypes[0];
                                    const Icon = r.icon;
                                    return <Icon className={cn("h-5 w-5", post.userReaction && r.fill)} />;
                                })()}
                                {post.likesCount || 0}
                            </Button>

                            <div className="absolute bottom-full left-0 mb-2 hidden group-hover:flex items-center gap-1 p-1.5 bg-background border border-border rounded-full shadow-2xl animate-in fade-in slide-in-from-bottom-2 z-20">
                                {reactionTypes.map((r: any) => {
                                    const Icon = r.icon;
                                    return (
                                        <Button
                                            key={r.type}
                                            variant="ghost"
                                            size="icon"
                                            className={cn("h-9 w-9 rounded-full transition-transform hover:scale-125", r.bg, r.color)}
                                            onClick={() => onReact(post.id, r.type)}
                                            title={r.label}
                                        >
                                            <Icon className={cn("h-5 w-5", post.userReaction === r.type && r.fill)} />
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn("gap-2 hover:bg-primary/5 hover:text-primary h-9 font-medium", showComments && "text-primary bg-primary/5")}
                            onClick={() => setShowComments(!showComments)}
                        >
                            <MessageSquare className="h-5 w-5" />
                            {post.commentsCount || 0}
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-2 hover:bg-muted h-9 text-muted-foreground">
                            <Share2 className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                {/* Comment Section */}
                {showComments && (
                    <CommentSection slug={slug} postId={post.id} onComment={onComment} />
                )}
            </CardContent>
        </Card>
    );
}

function CommentSection({ slug, postId, onComment }: { slug: string, postId: string, onComment: any }) {
    const { data: comments = [], isLoading } = useCommunityComments(slug, postId);
    const [replyText, setReplyText] = useState("");
    const [replyToId, setReplyToId] = useState<string | null>(null);

    const handleSubmit = async (parentId?: string) => {
        if (!replyText.trim()) return;
        await onComment(postId, replyText, parentId);
        setReplyText("");
        setReplyToId(null);
    };

    if (isLoading) return <div className="text-center py-4 text-xs text-muted-foreground animate-pulse">Loading conversation...</div>;

    // Helper to build tree
    const rootComments = comments.filter((c: any) => !c.parentId);

    return (
        <div className="space-y-6 pt-6 animate-in fade-in slide-in-from-top-2">
            <div className="space-y-4">
                {rootComments.map((comment: any) => (
                    <CommentItem
                        key={comment.id}
                        comment={comment}
                        allComments={comments}
                        onReply={(id: string) => setReplyToId(id)}
                        replyToId={replyToId}
                        replyText={replyText}
                        setReplyText={setReplyText}
                        onSubmit={handleSubmit}
                    />
                ))}
            </div>

            {/* Main Reply Input */}
            {!replyToId && (
                <div className="flex gap-3 pt-2">
                    <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-[10px]">YO</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 flex gap-2">
                        <Input
                            placeholder="Add a comment..."
                            className="h-9 text-sm bg-muted/30 border-none focus-visible:ring-1 focus-visible:ring-primary/20"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                        />
                        <Button size="sm" className="h-9 px-4 rounded-xl shadow-md shadow-primary/10" onClick={() => handleSubmit()}>Comment</Button>
                    </div>
                </div>
            )}
        </div>
    );
}

function CommentItem({ comment, allComments, onReply, replyToId, replyText, setReplyText, onSubmit, depth = 0 }: any) {
    const replies = allComments.filter((c: any) => c.parentId === comment.id);
    const isReplying = replyToId === comment.id;

    return (
        <div className={cn("space-y-3", depth > 0 && "ml-8 border-l border-border/50 pl-4")}>
            <div className="flex gap-3">
                <Avatar className="h-8 w-8 shadow-sm">
                    <AvatarImage src={comment.author?.user?.profile?.portraitUrl} />
                    <AvatarFallback className="text-xs bg-muted">{comment.author?.user?.profile?.firstName?.[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                    <div className="bg-muted/40 p-3 rounded-2xl rounded-tl-none">
                        <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-bold">{comment.author?.user?.profile?.firstName} {comment.author?.user?.profile?.lastName}</span>
                            <span className="text-[10px] text-muted-foreground uppercase">{formatDistanceToNow(new Date(comment.createdAt))}</span>
                        </div>
                        <p className="text-sm leading-relaxed">{comment.content}</p>
                    </div>
                    <div className="flex items-center gap-3 px-1">
                        <button
                            onClick={() => onReply(isReplying ? null : comment.id)}
                            className="text-[11px] font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                        >
                            <MessageSquare size={12} /> Reply
                        </button>
                    </div>

                    {isReplying && (
                        <div className="flex gap-2 pt-2 animate-in slide-in-from-left-2 fade-in">
                            <Input
                                autoFocus
                                placeholder={`Reply to ${comment.author?.user?.profile?.firstName}...`}
                                className="h-8 text-xs bg-muted/60 border-none focus-visible:ring-1"
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && onSubmit(comment.id)}
                            />
                            <Button size="sm" className="h-8 py-0 px-3 text-xs" onClick={() => onSubmit(comment.id)}>Send</Button>
                            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => onReply(null)}>Cancel</Button>
                        </div>
                    )}
                </div>
            </div>

            {replies.length > 0 && (
                <div className="space-y-3">
                    {replies.map((reply: any) => (
                        <CommentItem
                            key={reply.id}
                            comment={reply}
                            allComments={allComments}
                            onReply={onReply}
                            replyToId={replyToId}
                            replyText={replyText}
                            setReplyText={setReplyText}
                            onSubmit={onSubmit}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function MemberPreviewModal({ slug, memberId, onClose }: { slug: string, memberId: string | null, onClose: () => void }) {
    const { data: member, isLoading } = useMemberPreview(slug, memberId);

    return (
        <Dialog open={!!memberId} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl">
                <div className="h-24 bg-gradient-to-r from-primary/20 to-primary/5" />
                <div className="px-6 pb-8 -mt-12 text-center space-y-4">
                    <Avatar className="h-24 w-24 mx-auto ring-4 ring-background shadow-lg">
                        <AvatarImage src={member?.profilePicture} />
                        <AvatarFallback className="text-2xl">{member?.firstName?.[0]}</AvatarFallback>
                    </Avatar>

                    <div className="space-y-1">
                        <DialogTitle className="text-2xl font-bold">{member?.firstName} {member?.lastName}</DialogTitle>
                        <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-sm font-medium">
                            <Calendar className="h-4 w-4" />
                            Joined {member ? new Date(member.joinedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '...'}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4">
                        <div className="p-4 bg-muted/50 rounded-2xl space-y-1">
                            <Trophy className="h-5 w-5 text-yellow-500 mx-auto" />
                            <p className="text-2xl font-bold">{member?.stats?.totalClasses || 0}</p>
                            <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Classes</p>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-2xl space-y-1">
                            <Users className="h-5 w-5 text-blue-500 mx-auto" />
                            <p className="text-2xl font-bold">{member?.stats?.totalClasses > 50 ? 'Elite' : 'Member'}</p>
                            <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Rank</p>
                        </div>
                    </div>

                    <div className="pt-4">
                        <Button className="w-full rounded-xl py-6 text-lg font-semibold" onClick={onClose}>
                            Awesome!
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

