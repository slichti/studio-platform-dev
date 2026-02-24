import { useLoaderData, useOutletContext, Link } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { getAuth } from "../utils/auth-wrapper.server";
import { apiRequest } from "~/utils/api";
import { Calendar, ArrowLeft, User, Clock, Share2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";
import { cn } from "~/utils/cn";

export const loader = async (args: LoaderFunctionArgs) => {
    let userId: string | null = null;
    let token: string | null = null;
    let getToken: (() => Promise<string | null>) | null = null;

    const cookie = args.request.headers.get("Cookie");
    const isDev = import.meta.env.DEV || process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

    if (isDev && cookie?.includes("__e2e_bypass_user_id=")) {
        const match = cookie.match(/__e2e_bypass_user_id=([^;]+)/);
        if (match) { userId = match[1]; token = userId; }
    }

    if (!userId) {
        const authResult = await getAuth(args);
        userId = authResult.userId;
        getToken = authResult.getToken;
    }

    if (getToken && !token) token = await getToken();
    const { slug, postId } = args.params;
    const headers = { 'X-Tenant-Slug': slug! };

    try {
        const post = await apiRequest(`/community/${postId}`, token, { headers });
        return { post };
    } catch (e) {
        throw new Response("Post Not Found", { status: 404 });
    }
};

export const meta: MetaFunction<typeof loader> = ({ data, params }) => {
    if (!data?.post) return [{ title: "Post Not Found" }];

    const post = data.post;
    const match = post.content?.match(/^## (.*)\n/);
    const title = match ? match[1] : 'Studio Blog';
    const summary = post.content?.replace(/^## .*\n/, '').substring(0, 160).trim();

    return [
        { title: `${title} | Blog` },
        { name: "description", content: summary },
        { property: "og:title", content: title },
        { property: "og:description", content: summary },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
    ];
};

export default function PortalBlogPost() {
    const { post } = useLoaderData<typeof loader>();
    const { tenant } = useOutletContext<any>();

    const match = post.content?.match(/^## (.*)\n/);
    const title = match ? match[1] : 'Untitled Article';
    const cleanContent = post.content?.replace(/^## .*\n/, '');

    // Schema.org Structured Data
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": title,
        "image": post.imageUrl,
        "datePublished": post.createdAt,
        "dateModified": post.updatedAt || post.createdAt,
        "author": {
            "@type": "Organization",
            "name": tenant.name
        },
        "publisher": {
            "@type": "Organization",
            "name": tenant.name,
            "logo": {
                "@type": "ImageObject",
                "url": tenant.branding?.logoUrl
            }
        },
        "description": post.content?.substring(0, 160).replace(/[#\*`\n]/g, '').trim()
    };

    return (
        <article className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            <Link
                to=".."
                className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-indigo-600 transition-colors group"
            >
                <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                Back to Blog
            </Link>

            <header className="space-y-6">
                <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500 font-medium">
                    <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800/50 px-3 py-1 rounded-full">
                        <Calendar size={14} className="text-zinc-400" />
                        {format(new Date(post.createdAt), 'MMMM d, yyyy')}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <User size={14} className="text-zinc-400" />
                        By {tenant.name} Team
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Clock size={14} className="text-zinc-400" />
                        5 min read
                    </div>
                </div>

                <h1 className="text-4xl md:text-5xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight leading-tight">
                    {title}
                </h1>
            </header>

            {post.imageUrl && (
                <div className="aspect-[21/9] rounded-3xl overflow-hidden shadow-xl border border-zinc-200 dark:border-zinc-800">
                    <img src={post.imageUrl} alt={title} className="w-full h-full object-cover" />
                </div>
            )}

            <div className="prose prose-zinc dark:prose-invert max-w-none 
                prose-h1:text-zinc-900 dark:prose-h1:text-zinc-100
                prose-h2:text-zinc-900 dark:prose-h2:text-zinc-100 prose-h2:text-2xl prose-h2:font-bold prose-h2:mt-10 prose-h2:mb-4
                prose-p:text-zinc-600 dark:prose-p:text-zinc-400 prose-p:text-lg prose-p:leading-relaxed prose-p:mb-6
                prose-strong:text-zinc-900 dark:prose-strong:text-zinc-100
                prose-img:rounded-2xl prose-img:shadow-lg">
                <ReactMarkdown>{cleanContent}</ReactMarkdown>
            </div>

            <footer className="pt-12 mt-12 border-t border-zinc-200 dark:border-zinc-800">
                <div className="bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                        <h4 className="font-bold text-indigo-900 dark:text-indigo-400">Enjoyed this article?</h4>
                        <p className="text-sm text-indigo-700/70 dark:text-indigo-400/70">Share it with your fitness community.</p>
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition shadow-sm">
                        <Share2 size={18} />
                        Share Article
                    </button>
                </div>
            </footer>
        </article>
    );
}
