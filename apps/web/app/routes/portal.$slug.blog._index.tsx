import { useLoaderData, useOutletContext, Link } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { getAuth } from "../utils/auth-wrapper.server";
import { apiRequest } from "~/utils/api";
import { BookOpen, Search, X, Calendar, ArrowRight } from "lucide-react";
import { useState, useMemo } from "react";
import { cn } from "~/utils/cn";
import { format } from "date-fns";

export const loader = async (args: LoaderFunctionArgs) => {
    let userId: string | null = null;
    let token: string | null = null;
    let getToken: (() => Promise<string | null>) | null = null;

    const cookie = args.request.headers.get("Cookie");
    const isDev = import.meta.env.DEV || process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

    if (isDev && cookie?.includes("__e2e_bypass_user_id=")) {
        const match = cookie.match(/__e2e_bypass_user_id=([^;]+)/);
        if (match) {
            userId = match[1];
            token = userId;
        }
    }

    if (!userId) {
        const authResult = await getAuth(args);
        userId = authResult.userId;
        getToken = authResult.getToken;
    }

    if (getToken && !token) token = await getToken();
    const { slug } = args.params;
    const headers = { 'X-Tenant-Slug': slug! };

    const blogs = await apiRequest(`/community?type=blog&limit=100`, token, { headers }).catch(() => []);

    return { blogs };
};

export default function PortalBlogIndex() {
    const { blogs } = useLoaderData<typeof loader>();
    const { tenant } = useOutletContext<any>();
    const slug = tenant?.slug;
    const [searchQuery, setSearchQuery] = useState('');

    const filteredBlogs = useMemo(() => {
        if (!searchQuery.trim()) return blogs as any[];
        const q = searchQuery.toLowerCase();
        return (blogs as any[]).filter((b: any) =>
            b.content?.toLowerCase().includes(q)
        );
    }, [blogs, searchQuery]);

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
                    <BookOpen className="text-indigo-600" size={30} />
                    Studio Blog
                </h1>
                <p className="text-zinc-500 dark:text-zinc-400 mt-1">Latest insights, tips, and news from {tenant?.name}.</p>
            </div>

            {/* Search bar */}
            <div className="relative max-w-md">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                    type="search"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search articles…"
                    className="w-full pl-9 pr-8 py-2.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-indigo-500 transition"
                />
                {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition">
                        <X size={14} />
                    </button>
                )}
            </div>

            {blogs.length === 0 ? (
                <div className="p-16 text-center bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                    <BookOpen size={36} className="mx-auto text-zinc-300 mb-4" />
                    <p className="font-medium text-zinc-600 dark:text-zinc-400">No blog posts yet.</p>
                    <p className="text-sm text-zinc-400 mt-1">Check back soon for fresh content!</p>
                </div>
            ) : filteredBlogs.length === 0 ? (
                <div className="p-10 text-center bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                    <Search size={28} className="mx-auto text-zinc-300 mb-3" />
                    <p className="font-medium text-zinc-600 dark:text-zinc-400">No matching articles found.</p>
                    <button onClick={() => setSearchQuery('')} className="mt-2 text-sm text-indigo-600 hover:underline transition">Clear search</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {filteredBlogs.map((post: any) => {
                        // Extract title from content if it starts with ##
                        const match = post.content?.match(/^## (.*)\n/);
                        const title = match ? match[1] : 'Untitled Article';
                        const summary = post.content?.replace(/^## .*\n/, '').substring(0, 180).trim() + '...';

                        return (
                            <Link
                                key={post.id}
                                to={post.id}
                                className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row"
                            >
                                {post.imageUrl && (
                                    <div className="md:w-64 h-48 md:h-auto overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex-shrink-0">
                                        <img src={post.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={title} />
                                    </div>
                                )}
                                <div className="p-6 flex flex-col flex-1">
                                    <div className="flex items-center gap-2 text-xs font-medium text-zinc-400 mb-3">
                                        <Calendar size={12} />
                                        {format(new Date(post.createdAt), 'MMM d, yyyy')}
                                        <span className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                                        <span>{tenant.name} Team</span>
                                    </div>
                                    <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 transition-colors mb-2">
                                        {title}
                                    </h2>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-4 flex-1">
                                        {summary}
                                    </p>
                                    <div className="flex items-center gap-2 text-sm font-semibold text-indigo-600">
                                        Read Article
                                        <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
