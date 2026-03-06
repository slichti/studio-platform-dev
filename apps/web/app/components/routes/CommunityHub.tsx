
import { useState } from "react";
import { useParams } from "react-router";
import {
    MessageSquare,
    Heart,
    Share2,
    MoreVertical,
    Send,
    Image as ImageIcon,
    Video,
    Music,
    Smile,
    Sparkles,
    Pin
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Input } from "../ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { useCommunity } from "../../hooks/useCommunity";
import { cn } from "../../lib/utils";

export default function CommunityHub() {
    const { slug } = useParams();
    const { posts, isLoading, createPost, likePost, commentOnPost, generateAIContent } = useCommunity(slug!);

    const [newPostContent, setNewPostContent] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
    const [commentText, setCommentText] = useState("");

    const handleCreatePost = async () => {
        if (!newPostContent.trim()) return;
        try {
            await createPost.mutateAsync({ content: newPostContent });
            setNewPostContent("");
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
            setNewPostContent(res.content);
            toast.success("AI helper active! ✨");
        } catch (e) {
            toast.error("AI was unable to help this time.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleLike = (postId: string) => {
        likePost.mutate(postId);
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
            </header>

            {/* Create Post Card */}
            <Card className="border-none shadow-xl bg-gradient-to-br from-background to-muted/30 overflow-hidden">
                <CardContent className="p-6">
                    <div className="flex gap-4">
                        <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                            <AvatarFallback>YO</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-4">
                            <textarea
                                placeholder="What's on your mind? Share a thought, photo, or update..."
                                className="w-full bg-transparent border-none focus:ring-0 resize-none text-lg min-h-[100px]"
                                value={newPostContent}
                                onChange={(e) => setNewPostContent(e.target.value)}
                            />
                            <div className="flex items-center justify-between border-t pt-4">
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary transition-colors">
                                        <ImageIcon className="h-5 w-5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary transition-colors">
                                        <Video className="h-5 w-5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary transition-colors">
                                        <Smile className="h-5 w-5" />
                                    </Button>
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
                            <Avatar>
                                <AvatarImage src={post.author?.user?.profile?.avatarUrl} />
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
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className={cn("gap-2 hover:bg-red-50 hover:text-red-500", post.isLiked && "text-red-500")}
                                        onClick={() => handleLike(post.id)}
                                    >
                                        <Heart className={cn("h-5 w-5", post.isLiked && "fill-current")} />
                                        {post.likesCount || 0}
                                    </Button>
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
        </div>
    );
}

