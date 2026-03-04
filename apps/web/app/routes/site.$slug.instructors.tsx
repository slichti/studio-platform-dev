import { useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import { Users, Star, Calendar, ChevronRight } from "lucide-react";
import { API_URL } from "~/utils/api";

export default function InstructorsPage() {
    const { slug } = useParams();
    const [instructors, setInstructors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!slug) return;
        fetch(`${API_URL}/public/instructors?slug=${slug}`)
            .then(r => r.json() as Promise<{ instructors: any[] }>)
            .then(data => setInstructors(data.instructors || []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [slug]);

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto px-6 py-16 animate-pulse">
                <div className="h-10 bg-zinc-200 rounded w-48 mb-12" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-80 bg-zinc-100 rounded-2xl" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-6 py-16">
            <div className="text-center mb-12">
                <div className="inline-flex items-center gap-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-4 py-2 rounded-full text-sm font-medium mb-4">
                    <Users size={16} />
                    Our Team
                </div>
                <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-3">
                    Meet Our Instructors
                </h1>
                <p className="text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto">
                    Get to know the talented instructors who make every class an unforgettable experience.
                </p>
            </div>

            {instructors.length === 0 ? (
                <div className="text-center py-20 text-zinc-400">
                    <Users size={48} className="mx-auto mb-4 opacity-40" />
                    <p className="text-lg">No instructor profiles available yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {instructors.map(instructor => (
                        <Link
                            key={instructor.id}
                            to={`/site/${slug}/instructors/${instructor.id}`}
                            className="group bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm hover:shadow-lg hover:border-purple-300 dark:hover:border-purple-700 transition-all duration-300"
                        >
                            <div className="h-56 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 flex items-center justify-center relative overflow-hidden">
                                {instructor.portraitUrl ? (
                                    <img src={instructor.portraitUrl} alt={`${instructor.firstName} ${instructor.lastName}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                ) : (
                                    <div className="w-28 h-28 rounded-full bg-white/80 dark:bg-zinc-800/80 flex items-center justify-center shadow-lg">
                                        <span className="text-4xl font-bold text-purple-600">
                                            {(instructor.firstName?.[0] || '').toUpperCase()}{(instructor.lastName?.[0] || '').toUpperCase()}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div className="p-5">
                                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                                    {instructor.firstName} {instructor.lastName}
                                    <ChevronRight size={18} className="text-zinc-400 group-hover:text-purple-600 transition-colors" />
                                </h3>
                                {instructor.specialties?.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-3">
                                        {instructor.specialties.slice(0, 3).map((s: string, i: number) => (
                                            <span key={i} className="text-xs px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-md">
                                                {s}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {instructor.bio && (
                                    <p className="text-sm text-zinc-500 mt-3 line-clamp-2">{instructor.bio}</p>
                                )}
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
