import { useLoaderData, Link } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { apiRequest } from "~/utils/api";
import { BookOpen, Calendar, ArrowRight, Home } from "lucide-react";
import { format } from "date-fns";
import { getTenantBySlug } from "~/utils/subdomain.server";

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
    const { slug } = params;
    if (!slug) throw new Response("Not Found", { status: 404 });

    const tenant = await getTenantBySlug(slug);
    if (!tenant) throw new Response("Tenant Not Found", { status: 404 });

    // Public request - no token. API must support public fetching for blogs
    const headers = { 'X-Tenant-Slug': slug };
    const blogs = await apiRequest(`/community?type=blog&limit=50`, null, { headers }).catch(() => []);

    return { blogs, tenant };
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
    const tenantName = data?.tenant?.name || "Studio";
    return [
        { title: `Blog | ${tenantName}` },
        { name: "description", content: `Insights, news, and fitness tips from ${tenantName}.` },
    ];
};

export default function PublicBlogIndex() {
    const { blogs, tenant } = useLoaderData<typeof loader>();

    return (
        <div className="min-h-screen bg-white dark:bg-zinc-950 font-sans">
            {/* Simple Public Header */}
            <header className="border-b border-zinc-100 dark:border-zinc-800 py-6 px-4">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <Link to={`/site/${tenant.slug}`} className="flex items-center gap-2 group">
                        <Home size={20} className="text-zinc-400 group-hover:text-black transition-colors" />
                        <span className="font-bold text-lg">{tenant.name}</span>
                    </Link>
                    <nav>
                        <Link to={`/portal/${tenant.slug}`} className="text-sm font-semibold hover:underline">Member Portal</Link>
                    </nav>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 py-16">
                <div className="mb-12">
                    <h1 className="text-5xl font-black tracking-tight text-zinc-900 dark:text-zinc-100 mb-4">
                        Latest Insights
                    </h1>
                    <p className="text-xl text-zinc-500 dark:text-zinc-400">
                        Expert advice and studio updates from the {tenant.name} team.
                    </p>
                </div>

                {blogs.length === 0 ? (
                    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-3xl p-20 text-center border border-zinc-100 dark:border-zinc-800">
                        <BookOpen size={48} className="mx-auto text-zinc-300 mb-6" />
                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">No articles found</h2>
                        <p className="text-zinc-500">We're currently preparing fresh content. Check back soon!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {blogs.map((post: any) => {
                            const match = post.content?.match(/^## (.*)\n/);
                            const title = match ? match[1] : 'Untitled Article';
                            const summary = post.content?.replace(/^## .*\n/, '').substring(0, 150).trim() + '...';

                            return (
                                <Link
                                    key={post.id}
                                    to={`/site/${tenant.slug}/blog/${post.id}`}
                                    className="group flex flex-col h-full bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-100 dark:border-zinc-800 hover:shadow-xl transition-all duration-300"
                                >
                                    <div className="aspect-[16/10] bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                                        {post.imageUrl ? (
                                            <img src={post.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={title} />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-zinc-300">
                                                <BookOpen size={48} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-6 flex flex-col flex-1">
                                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 mb-3">
                                            <Calendar size={12} />
                                            {format(new Date(post.createdAt), 'MMM d, yyyy')}
                                        </div>
                                        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-3 line-clamp-2 leading-tight">
                                            {title}
                                        </h2>
                                        <p className="text-zinc-600 dark:text-zinc-400 text-sm line-clamp-3 mb-6 flex-1">
                                            {summary}
                                        </p>
                                        <div className="flex items-center gap-2 text-sm font-black text-zinc-900 dark:text-zinc-100">
                                            Read More
                                            <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform" />
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </main>

            <footer className="bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 py-12 px-4 mt-20">
                <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
                    <p className="text-zinc-500 text-sm">© {new Date().getFullYear()} {tenant.name}. All rights reserved.</p>
                    <div className="flex gap-6">
                        <Link to={`/site/${tenant.slug}`} className="text-sm font-semibold hover:underline">Home</Link>
                        <Link to={`/portal/${tenant.slug}/classes`} className="text-sm font-semibold hover:underline">Classes</Link>
                        <Link to={`/portal/${tenant.slug}/join`} className="text-sm font-semibold hover:underline">Membership</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
