import { useState, useEffect } from "react";
// @ts-ignore
import { Form, useNavigation, useNavigate, Link } from "react-router";
import { apiRequest } from "../utils/api";
import { useUser, SignedIn, SignedOut, RedirectToSignIn } from "@clerk/react-router";

export default function CreateStudio() {
    const { user, isLoaded } = useUser();
    const navigate = useNavigate();
    const navigation = useNavigation();

    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [tier, setTier] = useState("basic");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Auto-generate slug from name
    useEffect(() => {
        if (!name) return;
        const generated = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
        setSlug(generated);
    }, [name]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const token = await (window as any).Clerk?.session?.getToken();
            const res: any = await apiRequest('/onboarding/studio', token, {
                method: 'POST',
                body: JSON.stringify({ name, slug, tier })
            });

            if (res.tenant) {
                // Success! Redirect to dashboard
                navigate(`/studio/${res.tenant.slug}/dashboard`);
            } else if (res.error) {
                setError(res.error);
            }
        } catch (err: any) {
            setError(err.message || "Failed to create studio.");
        } finally {
            setLoading(false);
        }
    };

    if (!isLoaded) return <div className="p-10 text-center">Loading...</div>;

    return (
        <div className="min-h-screen bg-zinc-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <SignedOut>
                <RedirectToSignIn afterSignInUrl="/create-studio" />
            </SignedOut>
            <SignedIn>
                <div className="sm:mx-auto sm:w-full sm:max-w-md">
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-zinc-900">
                        Create your Studio
                    </h2>
                    <p className="mt-2 text-center text-sm text-zinc-600">
                        Start managing your classes and students today.
                    </p>
                </div>

                <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                    <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                        {error && (
                            <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">
                                {error}
                            </div>
                        )}

                        <form className="space-y-6" onSubmit={handleSubmit}>
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-zinc-700">
                                    Studio Name
                                </label>
                                <div className="mt-1">
                                    <input
                                        id="name"
                                        name="name"
                                        type="text"
                                        required
                                        className="appearance-none block w-full px-3 py-2 border border-zinc-300 rounded-md shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="e.g. Zen Yoga"
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="slug" className="block text-sm font-medium text-zinc-700">
                                    Studio URL (Slug)
                                </label>
                                <div className="mt-1 flex rounded-md shadow-sm">
                                    <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-zinc-300 bg-zinc-50 text-zinc-500 sm:text-sm">
                                        studio.platform.com/
                                    </span>
                                    <input
                                        id="slug"
                                        name="slug"
                                        type="text"
                                        required
                                        className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md border border-zinc-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                        value={slug}
                                        onChange={(e) => setSlug(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-zinc-700 mb-3">Select Plan</label>
                                <div className="grid grid-cols-1 gap-4">
                                    <div
                                        onClick={() => setTier('basic')}
                                        className={`cursor-pointer border rounded-lg p-4 flex items-center justify-between transition-all ${tier === 'basic' ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50' : 'border-zinc-200 hover:border-blue-300'}`}
                                    >
                                        <div>
                                            <div className="font-medium text-zinc-900">Basic (Free)</div>
                                            <div className="text-sm text-zinc-500">Up to 50 students, 1 location.</div>
                                        </div>
                                        <div className="h-4 w-4 rounded-full border border-zinc-300 flex items-center justify-center">
                                            {tier === 'basic' && <div className="h-2 w-2 bg-blue-600 rounded-full" />}
                                        </div>
                                    </div>
                                    <div
                                        onClick={() => setTier('growth')}
                                        className={`cursor-pointer border rounded-lg p-4 flex items-center justify-between transition-all ${tier === 'growth' ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50' : 'border-zinc-200 hover:border-blue-300'}`}
                                    >
                                        <div>
                                            <div className="font-medium text-zinc-900">Growth ($49/mo)</div>
                                            <div className="text-sm text-zinc-500">Up to 500 students, 3 locations.</div>
                                        </div>
                                        <div className="h-4 w-4 rounded-full border border-zinc-300 flex items-center justify-center">
                                            {tier === 'growth' && <div className="h-2 w-2 bg-blue-600 rounded-full" />}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-500 disabled:opacity-70"
                                >
                                    {loading ? 'Creating...' : 'Create Studio'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </SignedIn>
        </div>
    );
}
