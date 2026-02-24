import { useLoaderData, Link } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { apiRequest } from "~/utils/api";
import { Calendar, ArrowLeft, Home, User, Clock, Share2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";
import { getTenantBySlug } from "~/utils/subdomain.server";

export const loader = async ({ params }: LoaderFunctionArgs) => {
    const { slug, postId } = params;
    if (!slug || !postId) throw new Response("Not Found", { status: 404 });

    const tenant = await getTenantBySlug(slug);
    if (!tenant) throw new Response("Tenant Not Found", { status: 404 });

    const headers = { 'X-Tenant-Slug': slug };
    try {
        const post = await apiRequest(`/community/${postId}`, null, { headers });
        return { post, tenant };
    } catch (e) {
        throw new Response("Post Not Found", { status: 404 });
    }
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
    if (!data?.post) return [{ title: "Post Not Found" }];

    const post = data.post;
    const tenantName = data.tenant?.name || "Studio";
    const match = post.content?.match(/^## (.*)\n/);
    const title = match ? match[1] : 'Studio Blog';
    const summary = post.content?.replace(/^## .*\n/, '').substring(0, 160).trim();

    return [
        { title: `${title} | ${tenantName}` },
        { name: "description", content: summary },
        { property: "og:title", content: title },
        { property: "og:description", content: summary },
        { property: "og:image", content: post.imageUrl },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
    ];
};

export default function PublicBlogPost() {
    const { post, tenant } = useLoaderData<typeof loader>();

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
        <div className="min-h-screen bg-white dark:bg-zinc-950 font-sans">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            {/* Simple Public Header */}
            <header className="border-b border-zinc-100 dark:border-zinc-800 py-6 px-4">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <Link to={`/site/${tenant.slug}`} className="flex items-center gap-2 group">
                        <Home size={20} className="text-zinc-400 group-hover:text-black transition-colors" />
                        <span className="font-bold text-lg">{tenant.name}</span>
                    </Link>
                    <nav>
                        <Link to={`/portal/${tenant.slug}`} className="text-sm font-semibold hover:underline">Member Portal</Link>
                    </nav>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-16">
                <Link
                    to=".."
                    className="inline-flex items-center gap-2 text-sm font-bold text-zinc-400 hover:text-black transition-colors mb-12 group"
                >
                    <ArrowLeft size={16} className="group-hover:-translate-x-2 transition-transform" />
                    Back to Blog
                </Link>

                <header className="mb-12">
                    <div className="flex flex-wrap items-center gap-4 text-xs font-bold uppercase tracking-widest text-indigo-600 mb-6">
                        <div className="flex items-center gap-1.5">
                            <Calendar size={12} />
                            {format(new Date(post.createdAt), 'MMMM d, yyyy')}
                        </div>
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-200" />
                        <div className="flex items-center gap-1.5">
                            <Clock size={12} />
                            5 min read
                        </div>
                    </div>

                    <h1 className="text-5xl md:text-6xl font-black text-zinc-900 dark:text-zinc-100 leading-tight tracking-tighter mb-8">
                        {title}
                    </h1>

                    {post.imageUrl && (
                        <div className="aspect-[21/9] rounded-[40px] overflow-hidden shadow-2xl border border-zinc-100 dark:border-zinc-800">
                            <img src={post.imageUrl} alt={title} className="w-full h-full object-cover" />
                        </div>
                    )}
                </header>

                <div className="prose prose-zinc dark:prose-invert max-w-none 
                    prose-p:text-xl prose-p:text-zinc-600 dark:prose-p:text-zinc-400 prose-p:leading-relaxed prose-p:mb-8
                    prose-h2:text-3xl prose-h2:font-black prose-h2:tracking-tight prose-h2:mt-16 prose-h2:mb-6
                    prose-strong:text-zinc-900 dark:prose-strong:text-zinc-100 prose-strong:font-bold
                    prose-img:rounded-3xl prose-img:shadow-xl prose-img:my-12">
                    <ReactMarkdown>{cleanContent}</ReactMarkdown>
                </div>

                <footer className="mt-20 pt-12 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="bg-zinc-900 dark:bg-white p-12 rounded-[40px] text-center">
                        <h2 className="text-3xl font-black text-white dark:text-black mb-4">Start your journey today</h2>
                        <p className="text-zinc-400 dark:text-zinc-500 mb-8 max-w-md mx-auto">
                            Join {tenant.name} and transform your fitness with our expert-led classes and community.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link
                                to={`/portal/${tenant.slug}/join`}
                                className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition shadow-lg"
                            >
                                View Memberships
                            </Link>
                            <Link
                                to={`/portal/${tenant.slug}/classes`}
                                className="px-8 py-4 bg-white/10 dark:bg-black/5 text-white dark:text-black rounded-2xl font-black hover:bg-white/20 dark:hover:bg-black/10 transition border border-white/10 dark:border-black/5"
                            >
                                Book a Class
                            </Link>
                        </div>
                    </div>
                </footer>
            </main>

            <footer className="bg-white dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800 py-12 px-4 mt-20">
                <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-4">
                        <span className="font-bold">© {new Date().getFullYear()} {tenant.name}</span>
                    </div>
                    <div className="flex gap-8">
                        <Link to={`/site/${tenant.slug}`} className="text-sm font-bold hover:text-indigo-600 transition-colors">Home</Link>
                        <Link to={`/site/${tenant.slug}/blog`} className="text-sm font-bold hover:text-indigo-600 transition-colors underline decoration-2 underline-offset-4">Blog</Link>
                        <button className="text-sm font-bold hover:text-indigo-600 transition-colors flex items-center gap-2">
                            <Share2 size={16} />
                            Share
                        </button>
                    </div>
                </div>
            </footer>
        </div>
    );
}
