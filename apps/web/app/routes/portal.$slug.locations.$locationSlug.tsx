import { useLoaderData, useParams, useOutletContext, Link } from "react-router";
import { apiRequest } from "~/utils/api";
import { MapPin, Clock, Phone, Calendar, ChevronLeft, Globe } from "lucide-react";
import { format } from "date-fns";
import type { LoaderFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/server";

export const loader = async (args: LoaderFunctionArgs) => {
    const { slug, locationSlug } = args.params;
    const authResult = await getAuth(args);
    const token = await authResult.getToken();

    try {
        const location = await apiRequest(`/locations/slug/${locationSlug}`, token, {
            headers: { 'X-Tenant-Slug': slug! }
        });

        const classes = await apiRequest(`/classes?locationId=${location.id}&limit=20`, token, {
            headers: { 'X-Tenant-Slug': slug! }
        });

        return { location, classes };
    } catch (e) {
        throw new Response("Location Not Found", { status: 404 });
    }
};

export default function LocationLandingPage() {
    const { location, classes } = useLoaderData<typeof loader>();
    const { slug } = useParams();
    const { tenant } = useOutletContext<any>();

    const seoConfig = (location.seoConfig || {}) as any;
    const title = seoConfig.titleTemplate
        ? seoConfig.titleTemplate.replace('%location%', location.name).replace('%tenant%', tenant?.name)
        : `${location.name} | ${tenant?.name} Studio`;

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* SEO Schema Injection (Visualized for now, normally handled by HTMLRewriter or Helmet) */}
            <script type="application/ld+json">
                {JSON.stringify({
                    "@context": "https://schema.org",
                    "@type": "LocalBusiness",
                    "name": location.name,
                    "address": {
                        "@type": "PostalAddress",
                        "streetAddress": location.address
                    },
                    "telephone": location.settings?.phone,
                    "url": typeof window !== 'undefined' ? window.location.href : "",
                    "parentOrganization": {
                        "@type": "Organization",
                        "name": tenant?.name
                    }
                })}
            </script>

            <div className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
                <ChevronLeft size={16} />
                <Link to={`/portal/${slug}/classes`}>Back to all classes</Link>
            </div>

            {/* Hero Section */}
            <div className="bg-zinc-900 text-white rounded-3xl p-8 md:p-12 overflow-hidden relative border border-zinc-800 shadow-2xl">
                <div className="relative z-10 space-y-4">
                    <Badge variant="outline" className="border-zinc-700 text-zinc-400">Our Studio</Badge>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{location.name}</h1>
                    <div className="flex flex-wrap gap-6 text-zinc-400 text-sm mt-6">
                        <div className="flex items-center gap-2">
                            <MapPin size={18} className="text-indigo-400" />
                            <span>{location.address || "Main Location"}</span>
                        </div>
                        {location.settings?.phone && (
                            <div className="flex items-center gap-2">
                                <Phone size={18} className="text-indigo-400" />
                                <span>{location.settings.phone}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <Clock size={18} className="text-indigo-400" />
                            <span>{location.timezone || "UTC"}</span>
                        </div>
                    </div>
                </div>
                {/* Visual decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-3xl rounded-full -mr-20 -mt-20"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 blur-3xl rounded-full -ml-10 -mb-10"></div>
            </div>

            {/* Content & Schedule */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <section>
                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                            <Calendar size={20} className="text-indigo-500" /> Upcoming Classes
                        </h2>
                        {classes.length === 0 ? (
                            <div className="p-12 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-500">
                                No classes scheduled at this location this week.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {classes.map((cls: any) => (
                                    <div key={cls.id} className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex justify-between items-center group hover:border-indigo-200 dark:hover:border-indigo-900 transition-all">
                                        <div>
                                            <div className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-1">
                                                {format(new Date(cls.startTime), 'EEEE, MMM do')}
                                            </div>
                                            <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{cls.title}</h3>
                                            <div className="text-sm text-zinc-500 flex items-center gap-3 mt-1">
                                                <span className="flex items-center gap-1"><Clock size={12} /> {format(new Date(cls.startTime), 'h:mm a')}</span>
                                                <span>• {cls.durationMinutes} min</span>
                                            </div>
                                        </div>
                                        <Link
                                            to={`/portal/${slug}/classes`}
                                            className="px-4 py-2 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl text-sm font-bold opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            Book Now
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>

                <div className="space-y-6">
                    <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
                        <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-4">Location Info</h3>
                        <div className="space-y-4 text-sm text-zinc-600 dark:text-zinc-400">
                            <div className="flex gap-3">
                                <MapPin size={16} className="shrink-0 text-zinc-400" />
                                <span>{location.address}</span>
                            </div>
                            <div className="flex gap-3">
                                <Globe size={16} className="shrink-0 text-zinc-400" />
                                <span>Official {tenant?.name} Studio</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-indigo-600 text-white rounded-2xl p-6 shadow-xl shadow-indigo-100 dark:shadow-none">
                        <h3 className="font-bold mb-2">New Here?</h3>
                        <p className="text-sm text-indigo-100 mb-4">First timers at {location.name} get 50% off their first class pack!</p>
                        <Link to={`/portal/${slug}/packs`} className="block text-center py-2 bg-white text-indigo-600 rounded-xl font-bold text-sm hover:bg-zinc-50 transition-colors">
                            Claim Offer
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Badge({ children, variant = "default", className = "" }: { children: React.ReactNode, variant?: "default" | "outline" | "secondary", className?: string }) {
    const variants = {
        default: "bg-indigo-500 text-white",
        outline: "border border-zinc-200 text-zinc-600",
        secondary: "bg-zinc-100 text-zinc-600"
    };
    return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${variants[variant]} ${className}`}>
            {children}
        </span>
    );
}
