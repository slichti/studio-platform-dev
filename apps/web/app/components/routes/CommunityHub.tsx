
import { useState, useRef } from "react";
import { useParams } from "react-router";
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
    X
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { Input } from "~/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/Avatar";
import { Badge } from "~/components/ui/Badge";
import { useCommunity, useMemberPreview } from "~/hooks/useCommunity";
import { cn } from "~/lib/utils";
import { apiRequest } from "~/utils/api";
import { useAuth, useUser } from "@clerk/react-router";

export default function CommunityHub({ slug: propsSlug }: { slug?: string }) {
    const { slug: paramsSlug } = useParams();
    const slug = propsSlug || paramsSlug;
    const { posts, isLoading, createPost, reactToPost, commentOnPost, generateAIContent } = useCommunity(slug!);
    const { getToken } = useAuth();
    const { user } = useUser();

    // Get user initials for avatar fallback
    const initials = user
        ? `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`.toUpperCase() || user.emailAddresses[0]?.emailAddress?.charAt(0).toUpperCase()
        : "??";

    const [newPostContent, setNewPostContent] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
    const [commentText, setCommentText] = useState("");
    const [previewMemberId, setPreviewMemberId] = useState<string | null>(null);
    const [selectedMedia, setSelectedMedia] = useState<{ url: string; type: 'image' | 'video' }[]>([]);
    const [isUploading, setIsUploading] = useState(false);

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
                media: selectedMedia.length > 0 ? selectedMedia : undefined
            });
            setNewPostContent("");
            setSelectedMedia([]);
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

    const handleComment = async (postId: string) => {
        if (!commentText.trim()) return;
        try {
            await commentOnPost.mutateAsync({ postId, content: commentText });
            setCommentText("");
            setActiveCommentId(null);
            toast.success("Comment added");
        } catch (e) {
            toast.error("Failed to add comment");
        }
    };

    if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading Community Hub...</div>;

    return (
        <div className="max-w-3xl mx-auto space-y-8 p-4 md:p-8">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Community Hub</h1>
                    <p className="text-muted-foreground">Connect and grow with your studio family.</p>
                </div>
                <a
                    href={`/studio/${slug}/community/settings`}
                    className="p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all text-zinc-500"
                >
                    <Settings size={20} />
                </a>
            </header>

            {/* Create Post Card */}
            <Card className="border-none shadow-xl bg-gradient-to-br from-background to-muted/30 overflow-hidden">
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
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        ref={fileInputRef}
                                        onChange={(e) => handleFileUpload(e, 'image')}
                                    />
                                    <input
                                        type="file"
                                        accept="video/*"
                                        className="hidden"
                                        ref={videoInputRef}
                                        onChange={(e) => handleFileUpload(e, 'video')}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-muted-foreground hover:text-primary transition-colors"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isUploading}
                                    >
                                        <ImageIcon className="h-5 w-5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-muted-foreground hover:text-primary transition-colors"
                                        onClick={() => videoInputRef.current?.click()}
                                        disabled={isUploading}
                                    >
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
                                                    <button
                                                        key={emoji}
                                                        onClick={() => setNewPostContent(prev => prev + emoji)}
                                                        className="h-10 text-xl hover:bg-muted rounded-md transition-colors"
                                                    >
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
                                        disabled={createPost.isPending || !newPostContent.trim()}
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
                    <Card key={post.id} className={cn("border-none shadow-lg transition-all hover:shadow-xl", post.isPinned && "ring-1 ring-primary/20")}>
                        <CardHeader className="flex flex-row items-center gap-4 p-4 pb-0">
                            <Avatar className="cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all" onClick={() => setPreviewMemberId(post.authorId)}>
                                <AvatarImage src={post.author?.user?.profile?.portraitUrl} />
                                <AvatarFallback>{post.author?.user?.profile?.firstName?.[0] || 'U'}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold">{post.author?.user?.profile?.firstName} {post.author?.user?.profile?.lastName}</span>
                                    {post.isPinned && <Badge variant="secondary" className="gap-1 text-[10px] uppercase font-bold tracking-wider"><Pin className="h-3 w-3" /> Pinned</Badge>}
                                </div>
                                <span className="text-xs text-muted-foreground lowercase">
                                    {formatDistanceToNow(new Date(post.createdAt))} ago
                                </span>
                            </div>
                            <Button variant="ghost" size="icon" className="text-muted-foreground">
                                <MoreVertical className="h-5 w-5" />
                            </Button>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                            <div className="text-base leading-relaxed whitespace-pre-wrap">
                                {post.content}
                            </div>

                            {/* Media Section */}
                            {post.media && Array.isArray(post.media) && post.media.length > 0 && (
                                <div className="grid gap-2 rounded-xl overflow-hidden border">
                                    {post.media.map((item: any, idx: number) => (
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
                                                "gap-2",
                                                post.userReaction && REACTION_TYPES.find(r => r.type === post.userReaction)?.color
                                            )}
                                            onClick={() => handleReact(post.id, (post.userReaction as any) || 'like')}
                                        >
                                            {(() => {
                                                const r = REACTION_TYPES.find(rt => rt.type === post.userReaction) || REACTION_TYPES[0];
                                                const Icon = r.icon;
                                                return <Icon className={cn("h-5 w-5", post.userReaction && r.fill)} />;
                                            })()}
                                            {post.likesCount || 0}
                                        </Button>

                                        {/* Reaction Picker Popover (Simplified) */}
                                        <div className="absolute bottom-full left-0 mb-2 hidden group-hover:flex items-center gap-1 p-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full shadow-xl animate-in fade-in slide-in-from-bottom-2 z-10">
                                            {REACTION_TYPES.map((r) => {
                                                const Icon = r.icon;
                                                return (
                                                    <Button
                                                        key={r.type}
                                                        variant="ghost"
                                                        size="icon"
                                                        className={cn("h-8 w-8 rounded-full", r.bg, r.color)}
                                                        onClick={() => handleReact(post.id, r.type)}
                                                        title={r.label}
                                                    >
                                                        <Icon className={cn("h-4 w-4", post.userReaction === r.type && r.fill)} />
                                                    </Button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="gap-2 hover:bg-blue-50 hover:text-blue-500"
                                        onClick={() => setActiveCommentId(activeCommentId === post.id ? null : post.id)}
                                    >
                                        <MessageSquare className="h-5 w-5" />
                                        {post.commentsCount || 0}
                                    </Button>
                                    <Button variant="ghost" size="sm" className="gap-2 hover:bg-green-50 hover:text-green-500">
                                        <Share2 className="h-5 w-5" />
                                    </Button>
                                </div>
                            </div>

                            {/* Comment Section */}
                            {activeCommentId === post.id && (
                                <div className="space-y-4 pt-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex gap-3">
                                        <Avatar className="h-8 w-8">
                                            <AvatarFallback>YO</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 flex gap-2">
                                            <Input
                                                placeholder="Write a reply..."
                                                className="h-8 text-sm bg-muted/50 border-none focus-visible:ring-1"
                                                value={commentText}
                                                onChange={(e) => setCommentText(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleComment(post.id)}
                                            />
                                            <Button size="sm" className="h-8" onClick={() => handleComment(post.id)}>Reply</Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {!isLoading && posts.length === 0 && (
                <div className="py-20 text-center space-y-4 border-2 border-dashed rounded-3xl opacity-50">
                    <div className="h-12 w-12 bg-muted rounded-full flex items-center justify-center mx-auto">
                        <MessageSquare className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                        <p className="font-semibold text-lg">No posts yet</p>
                        <p className="text-sm text-muted-foreground">Be the first to share something with the community!</p>
                    </div>
                </div>
            )}

            <MemberPreviewModal
                slug={slug!}
                memberId={previewMemberId}
                onClose={() => setPreviewMemberId(null)}
            />
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

