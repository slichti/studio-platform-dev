
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";

import { useLoaderData, useOutletContext, Form, useNavigation, Link } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { useAuth } from "@clerk/react-router";
import { apiRequest } from "../utils/api";
import { useState, useRef } from "react";
import { Plus, Package, Calendar, DollarSign, Sparkles, ChevronDown, ChevronUp, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { CardCreator } from "../components/CardCreator";

type ClassPackDefinition = {
    id: string;
    name: string;
    credits: number;
    price: number; // in cents
    expirationDays: number | null;
    active: boolean;
};

export const loader = async (args: LoaderFunctionArgs) => {
    const { params } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();

    const res: any = await apiRequest(`/commerce/packs`, token, {
        headers: { 'X-Tenant-Slug': params.slug! }
    });

    if (res.error) throw new Error(res.error);

    return { params, packs: res.packs as ClassPackDefinition[] };
};

export const action = async (args: ActionFunctionArgs) => {
    const { params, request } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();

    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "create_pack") {
        const name = formData.get("name") as string;
        const credits = parseInt(formData.get("credits") as string);
        const price = parseFloat(formData.get("price") as string) * 100; // Convert to cents
        const expirationDays = formData.get("expirationDays") ? parseInt(formData.get("expirationDays") as string) : null;
        const imageUrl = formData.get("imageUrl") as string;
        const vodEnabled = formData.get("vodEnabled") === "on";

        const res: any = await apiRequest(`/commerce/packs`, token, {
            method: "POST",
            headers: { 'X-Tenant-Slug': params.slug! },
            body: JSON.stringify({ name, credits, price, expirationDays, imageUrl, vodEnabled })
        });

        if (res.error) return { error: res.error };
        return { success: true };
    }

    return null;
};

export default function ClassPacksPage() {
    const { packs, params } = useLoaderData<{ packs: ClassPackDefinition[]; params: { slug: string } }>();
    const { me, roles } = useOutletContext<any>() || {}; // Fallback for safety
    const { getToken } = useAuth();
    const navigation = useNavigation();
    const [isCreating, setIsCreating] = useState(false);
    const [showImageSection, setShowImageSection] = useState(false);
    const [imageUrl, setImageUrl] = useState('');
    const [imageBlob, setImageBlob] = useState<Blob | null>(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);

    const isSubmitting = navigation.state === "submitting";

    const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        // If we have an image blob, upload it first
        if (imageBlob) {
            e.preventDefault();
            setUploadingImage(true);
            try {
                const token = await getToken();
                const uploadFormData = new FormData();
                const file = new File([imageBlob], 'pack-card.jpg', { type: 'image/jpeg' });
                uploadFormData.append('file', file);

                const apiUrl = import.meta.env.VITE_API_URL || 'https://studio-platform-api.slichti.workers.dev';
                const res = await fetch(`${apiUrl}/uploads/r2-image`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'X-Tenant-Slug': params.slug!,
                    },
                    body: uploadFormData,
                });

                if (res.ok) {
                    const data = await res.json() as { url: string };
                    setImageUrl(data.url);
                    // Submit the form after a tick to let state update
                    setTimeout(() => {
                        formRef.current?.submit();
                    }, 50);
                }
            } catch (err) {
                console.error('Image upload failed', err);
            } finally {
                setUploadingImage(false);
            }
        }
    };

    return (
        <div className="max-w-5xl mx-auto py-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Class Packs</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-1">Manage punch cards and credit bundles.</p>
                </div>
                {(roles?.includes('owner') || roles?.includes('instructor')) && (
                    <div className="flex gap-2">
                        <Link
                            to={`/studio/${params.slug}/commerce/wizard`}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800 rounded-md text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                        >
                            <Sparkles className="h-4 w-4" />
                            Pricing Wizard
                        </Link>
                        <button
                            onClick={() => setIsCreating(!isCreating)}
                            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-md text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
                        >
                            <Plus className="h-4 w-4" />
                            Create Pack
                        </button>
                    </div>
                )}
            </div>

            {isCreating && (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 mb-8 shadow-sm">
                    <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-100">New Class Pack</h2>
                    <Form method="post" onSubmit={handleFormSubmit} ref={formRef}>
                        <input type="hidden" name="intent" value="create_pack" />
                        <input type="hidden" name="imageUrl" value={imageUrl} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Pack Name</label>
                                <input
                                    type="text"
                                    name="name"
                                    required
                                    placeholder="e.g. 10 Class Pass"
                                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Credits</label>
                                <input
                                    type="number"
                                    name="credits"
                                    required
                                    min="1"
                                    placeholder="Number of classes"
                                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Price ($)</label>
                                <input
                                    type="number"
                                    name="price"
                                    required
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Expiration (Days)</label>
                                <input
                                    type="number"
                                    name="expirationDays"
                                    placeholder="Optional (e.g. 90)"
                                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                />
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Leave blank for no expiration.</p>
                            </div>

                            {/* Cover Image with CardCreator */}
                            <div className="md:col-span-2">
                                <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => setShowImageSection(!showImageSection)}
                                        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-750 transition-colors text-left"
                                    >
                                        <span className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                                            <ImageIcon className="h-4 w-4" />
                                            Cover Image
                                            {imageUrl && <span className="text-green-600 text-xs">(Added)</span>}
                                        </span>
                                        {showImageSection ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
                                    </button>
                                    {showImageSection && (
                                        <div className="p-4 border-t border-zinc-200 dark:border-zinc-700">
                                            <CardCreator
                                                initialImage={imageUrl || undefined}
                                                onChange={(data) => {
                                                    setImageBlob(data.image);
                                                    if (data.previewUrl) setImageUrl(data.previewUrl);
                                                }}
                                            />
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                                                Upload or generate a 600×450 (4:3) cover image for this class pack.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 mb-6">
                            <input
                                type="checkbox"
                                name="vodEnabled"
                                id="vodEnabled"
                                className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="vodEnabled" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Include VOD Access</label>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 ml-2">(Allows entry to On-Demand Library)</p>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setIsCreating(false)}
                                className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || uploadingImage}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                            >
                                {uploadingImage ? "Uploading Image..." : isSubmitting ? "Creating..." : "Create Pack"}
                            </button>
                        </div>
                    </Form>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {packs.map((pack: ClassPackDefinition) => (
                    <div key={pack.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                                <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-400">
                                Active
                            </span>
                        </div>
                        <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">{pack.name}</h3>
                        <div className="space-y-3 mb-6">
                            <div className="flex items-center text-zinc-600 dark:text-zinc-400 text-sm">
                                <Package className="h-4 w-4 mr-2" />
                                <span>{pack.credits} Class Credits</span>
                            </div>
                            <div className="flex items-center text-zinc-600 dark:text-zinc-400 text-sm">
                                <DollarSign className="h-4 w-4 mr-2" />
                                <span>${(pack.price / 100).toFixed(2)}</span>
                            </div>
                            {pack.expirationDays && (
                                <div className="flex items-center text-zinc-600 dark:text-zinc-400 text-sm">
                                    <Calendar className="h-4 w-4 mr-2" />
                                    <span>Expires in {pack.expirationDays} days</span>
                                </div>
                            )}
                        </div>
                        <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                            {/* Purchase Logic */}
                            {!me ? (
                                <Link
                                    to={`/sign-in?redirect_url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '')}`}
                                    className="block w-full text-center px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-md text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                >
                                    Sign in to Buy
                                </Link>
                            ) : !roles?.includes('student') ? (
                                <button
                                    disabled
                                    className="block w-full text-center px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 rounded-md text-sm font-medium cursor-not-allowed"
                                >
                                    Students Only
                                </button>
                            ) : (
                                <a
                                    href={`/studio/${params.slug}/checkout?packId=${pack.id}`}
                                    className="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                                >
                                    Buy Now
                                </a>
                            )}
                        </div>
                    </div>
                ))}
                {packs.length === 0 && !isCreating && (
                    <div className="col-span-full text-center py-12 bg-zinc-50 dark:bg-zinc-900 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-500 dark:text-zinc-400">
                        <Package className="h-10 w-10 mx-auto mb-3 text-zinc-400 dark:text-zinc-500" />
                        <p>No class packs created yet.</p>
                        <button
                            onClick={() => setIsCreating(true)}
                            className="text-blue-600 hover:text-blue-800 font-medium mt-2"
                        >
                            Create one now
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
