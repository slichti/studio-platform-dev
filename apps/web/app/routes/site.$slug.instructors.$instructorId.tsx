import { useEffect, useState } from "react";
import { useParams, Link } from "react-router";
import { ArrowLeft, Star, Calendar, Clock, Quote } from "lucide-react";
import { format } from "date-fns";
import { API_URL } from "~/utils/api";

export default function InstructorProfilePage() {
    const { slug, instructorId } = useParams();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!slug || !instructorId) return;
        fetch(`${API_URL}/public/instructors/${instructorId}?slug=${slug}`)
            .then(r => r.json())
            .then(setData)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [slug, instructorId]);

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto px-6 py-16 animate-pulse">
                <div className="h-6 bg-zinc-200 rounded w-32 mb-8" />
                <div className="h-64 bg-zinc-100 rounded-2xl mb-8" />
                <div className="h-6 bg-zinc-200 rounded w-2/3 mb-4" />
                <div className="h-4 bg-zinc-200 rounded w-full" />
            </div>
        );
    }

    if (!data?.instructor) {
        return (
            <div className="max-w-4xl mx-auto px-6 py-16 text-center">
                <p className="text-zinc-500 text-lg">Instructor not found.</p>
                <Link to={`/site/${slug}/instructors`} className="text-purple-600 hover:underline mt-4 inline-block">
                    &larr; Back to Team
                </Link>
            </div>
        );
    }

    const { instructor, upcomingClasses, reviews } = data;
    const fullName = `${instructor.firstName} ${instructor.lastName}`.trim();
    const avgRating = reviews?.length > 0
        ? (reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length).toFixed(1)
        : null;

    return (
        <div className="max-w-4xl mx-auto px-6 py-12">
            <Link to={`/site/${slug}/instructors`} className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 mb-8 transition-colors">
                <ArrowLeft size={18} /> Back to Team
            </Link>

            {/* Hero */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm mb-10">
                <div className="flex flex-col md:flex-row">
                    <div className="w-full md:w-72 h-72 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 flex items-center justify-center flex-shrink-0">
                        {instructor.portraitUrl ? (
                            <img src={instructor.portraitUrl} alt={fullName} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-32 h-32 rounded-full bg-white/80 dark:bg-zinc-800/80 flex items-center justify-center shadow-lg">
                                <span className="text-5xl font-bold text-purple-600">
                                    {(instructor.firstName?.[0] || '').toUpperCase()}
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="p-8 flex-1">
                        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">{fullName}</h1>
                        {avgRating && (
                            <div className="flex items-center gap-2 text-amber-500 mb-4">
                                <Star size={18} fill="currentColor" />
                                <span className="font-semibold">{avgRating}</span>
                                <span className="text-zinc-400 text-sm">({reviews.length} reviews)</span>
                            </div>
                        )}
                        {instructor.specialties?.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-4">
                                {instructor.specialties.map((s: string, i: number) => (
                                    <span key={i} className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium">
                                        {s}
                                    </span>
                                ))}
                            </div>
                        )}
                        {instructor.bio && (
                            <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">{instructor.bio}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Upcoming Schedule */}
            {upcomingClasses?.length > 0 && (
                <div className="mb-10">
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                        <Calendar size={20} className="text-purple-600" />
                        Upcoming Classes
                    </h2>
                    <div className="space-y-3">
                        {upcomingClasses.map((cls: any) => (
                            <div key={cls.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 flex items-center justify-between">
                                <div>
                                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">{cls.title}</div>
                                    <div className="text-sm text-zinc-500 flex items-center gap-1 mt-1">
                                        <Clock size={14} />
                                        {format(new Date(cls.startTime), 'EEEE, MMM d')}
                                        <span className="mx-1">•</span>
                                        {format(new Date(cls.startTime), 'h:mm a')}
                                        {cls.endTime && ` – ${format(new Date(cls.endTime), 'h:mm a')}`}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Reviews */}
            {reviews?.length > 0 && (
                <div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                        <Star size={20} className="text-amber-500" />
                        Student Reviews
                    </h2>
                    <div className="space-y-4">
                        {reviews.map((review: any) => (
                            <div key={review.id} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
                                <div className="flex items-center gap-1 mb-3">
                                    {[...Array(5)].map((_, i) => (
                                        <Star key={i} size={16} className={i < review.rating ? 'text-amber-400 fill-amber-400' : 'text-zinc-200 dark:text-zinc-700'} />
                                    ))}
                                </div>
                                {review.content && (
                                    <div className="flex gap-3">
                                        <Quote size={16} className="text-zinc-300 flex-shrink-0 mt-0.5" />
                                        <p className="text-zinc-700 dark:text-zinc-300 italic">{review.content}</p>
                                    </div>
                                )}
                                <div className="text-xs text-zinc-400 mt-3">
                                    {review.createdAt ? format(new Date(review.createdAt), 'MMM d, yyyy') : ''}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
