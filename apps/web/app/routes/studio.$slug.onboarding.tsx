// @ts-ignore
import { useLoaderData, useOutletContext, Form, useNavigation, useSubmit, Link, useNavigate } from "react-router"; // @ts-ignore
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router"; // @ts-ignore
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { useState } from "react";
import { CheckCircle2, MapPin, Calendar, Palette, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "~/utils/cn";

export const loader = async (args: LoaderFunctionArgs) => {
    // Standard auth check
    const { getToken, userId } = await getAuth(args);
    if (!userId) return null; // Let parent handle redirect if needed, but this is a protected route anyway
    return {};
};

export const action = async (args: ActionFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const { slug } = args.params;
    const formData = await args.request.formData();
    const step = formData.get("step");

    try {
        // Step 1: Template
        if (step === "template") {
            const template = formData.get("template");
            await apiRequest(`/tenant/settings`, token, {
                method: "PATCH",
                body: JSON.stringify({
                    branding: { template },
                    onboardingStep: 2
                }),
                headers: { 'X-Tenant-Slug': slug! }
            });
            return { step: 2 };
        }

        // Step 2: Branding
        if (step === "branding") {
            const primaryColor = formData.get("primaryColor");
            await apiRequest(`/tenant/settings`, token, {
                method: "PATCH",
                body: JSON.stringify({
                    branding: { primaryColor },
                    onboardingStep: 3
                }),
                headers: { 'X-Tenant-Slug': slug! }
            });
            return { step: 3 };
        }

        // Step 3: Location
        if (step === "location") {
            const name = formData.get("name");
            const address = formData.get("address");
            await apiRequest(`/locations`, token, {
                method: "POST",
                body: JSON.stringify({ name, address }),
                headers: { 'X-Tenant-Slug': slug! }
            });
            await apiRequest(`/tenant/settings`, token, {
                method: "PATCH",
                body: JSON.stringify({ onboardingStep: 4 }),
                headers: { 'X-Tenant-Slug': slug! }
            });
            return { step: 4 };
        }

        // Step 4: Schedule
        if (step === "schedule") {
            const title = formData.get("title");
            const startTime = formData.get("startTime");
            const price = formData.get("price");
            await apiRequest(`/classes`, token, {
                method: "POST",
                body: JSON.stringify({
                    title,
                    startTime,
                    durationMinutes: 60,
                    capacity: 10,
                    price: price ? parseInt(price.toString()) : 2000
                }),
                headers: { 'X-Tenant-Slug': slug! }
            });
            await apiRequest(`/tenant/settings`, token, {
                method: "PATCH",
                body: JSON.stringify({ onboardingStep: 5 }),
                headers: { 'X-Tenant-Slug': slug! }
            });
            return { step: 5 };
        }

        // Step 5: Import Complete (Advanced by Skipping or Success)
        if (step === "import_complete") {
            await apiRequest(`/tenant/settings`, token, {
                method: "PATCH",
                body: JSON.stringify({ onboardingStep: 6 }), // 6 = Completed
                headers: { 'X-Tenant-Slug': slug! }
            });
            return { step: 6 };
        }

        return null;
    } catch (e: any) {
        return { error: e.message || "Action failed" };
    }
};

import { DataImportForm } from "~/components/DataImportForm";

export default function StudioOnboarding() {
    const { tenant } = useOutletContext<any>();
    const navigation = useNavigation();
    const navigate = useNavigate();

    // Steps:
    // 1. Template (New)
    // 2. Branding
    // 3. Location
    // 4. Schedule
    // 5. Import (New)
    // 6. Complete
    const initialStep = (tenant.settings?.onboardingStep || 1);
    const [currentStep, setCurrentStep] = useState(initialStep);
    const [template, setTemplate] = useState<string>('yoga'); // Default

    const isSubmitting = navigation.state === "submitting";

    // Defaults based on template
    const getDefaults = () => {
        switch (template) {
            case 'gym': return { title: 'HIIT Session', price: 2500 };
            case 'crossfit': return { title: 'WOD', price: 3000 };
            case 'art': return { title: 'Painting Workshop', price: 4500 };
            case 'yoga': default: return { title: 'Vinyasa Flow', price: 2000 };
        }
    };
    const defaults = getDefaults();

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4">
            <div className="max-w-xl w-full bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                {/* Progress Bar */}
                <div className="h-2 bg-zinc-100 dark:bg-zinc-800 w-full relative">
                    <div
                        className="absolute left-0 top-0 h-full bg-indigo-600 transition-all duration-500"
                        style={{ width: `${(currentStep / 6) * 100}%` }}
                    />
                </div>

                <div className="p-8">
                    {/* Header */}
                    <div className="mb-8 text-center">
                        <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                            {currentStep}
                        </div>
                        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                            {currentStep === 1 && "Choose your Business Type"}
                            {currentStep === 2 && "Set your Brand"}
                            {currentStep === 3 && "Create a Location"}
                            {currentStep === 4 && "Schedule First Class"}
                            {currentStep === 5 && "Migrate Data"}
                            {currentStep === 6 && "You're all set!"}
                        </h1>
                        <p className="text-zinc-500 dark:text-zinc-400 mt-2">
                            {currentStep === 1 && "We'll customize your setup based on your needs."}
                            {currentStep === 2 && "Choose a color that represents your studio."}
                            {currentStep === 3 && "Where will your classes take place?"}
                            {currentStep === 4 && "Get your calendar started with one event."}
                            {currentStep === 5 && "Import users and classes from your previous system."}
                            {currentStep === 6 && "Your studio is ready to accept bookings."}
                        </p>
                    </div>

                    {/* Step 1: Template */}
                    {currentStep === 1 && (
                        <Form method="post" onSubmit={() => setTimeout(() => setCurrentStep(2), 500)}>
                            <input type="hidden" name="step" value="template" />
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { id: 'yoga', label: 'Yoga / Pilates', icon: '🧘' },
                                    { id: 'gym', label: 'Gym / Fitness', icon: '💪' },
                                    { id: 'crossfit', label: 'Crossfit', icon: '🏋️' },
                                    { id: 'art', label: 'Art / Workshop', icon: '🎨' }
                                ].map(t => (
                                    <label key={t.id} className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center gap-2 transition-all ${template === t.id ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'}`}>
                                        <input type="radio" name="template" value={t.id} checked={template === t.id} onChange={() => setTemplate(t.id)} className="sr-only" />
                                        <span className="text-3xl">{t.icon}</span>
                                        <span className="font-semibold text-sm">{t.label}</span>
                                    </label>
                                ))}
                            </div>
                            <button disabled={isSubmitting} className="w-full mt-8 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition">
                                {isSubmitting ? <Loader2 className="animate-spin" /> : <>Next Step <ArrowRight size={16} /></>}
                            </button>
                        </Form>
                    )}

                    {/* Step 2: Branding */}
                    {currentStep === 2 && (
                        <Form method="post" onSubmit={() => setTimeout(() => setCurrentStep(3), 500)}>
                            <input type="hidden" name="step" value="branding" />
                            <div className="space-y-4">
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Primary Color</label>
                                <div className="grid grid-cols-5 gap-2">
                                    {['#4f46e5', '#ec4899', '#10b981', '#f59e0b', '#dc2626'].map(color => (
                                        <label key={color} className="relative cursor-pointer group">
                                            <input type="radio" name="primaryColor" value={color} className="peer sr-only" />
                                            <div className="w-full aspect-square rounded-full border-2 border-transparent peer-checked:border-zinc-900 dark:peer-checked:border-white transition-all" style={{ backgroundColor: color }} />
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 peer-checked:opacity-100 text-white">
                                                <CheckCircle2 size={16} />
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <button disabled={isSubmitting} className="w-full mt-8 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition">
                                {isSubmitting ? <Loader2 className="animate-spin" /> : <>Next Step <ArrowRight size={16} /></>}
                            </button>
                        </Form>
                    )}

                    {/* Step 3: Location */}
                    {currentStep === 3 && (
                        <Form method="post" onSubmit={() => setTimeout(() => setCurrentStep(4), 500)}>
                            <input type="hidden" name="step" value="location" />
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Location Name</label>
                                    <input required name="name" placeholder="e.g. Main Studio" className="w-full p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Address</label>
                                    <input required name="address" placeholder="123 Yoga Lane" className="w-full p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900" />
                                </div>
                            </div>
                            <button disabled={isSubmitting} className="w-full mt-8 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition">
                                {isSubmitting ? <Loader2 className="animate-spin" /> : <>Next Step <ArrowRight size={16} /></>}
                            </button>
                        </Form>
                    )}

                    {/* Step 4: Schedule */}
                    {currentStep === 4 && (
                        <Form method="post" onSubmit={() => setTimeout(() => setCurrentStep(5), 500)}>
                            <input type="hidden" name="step" value="schedule" />
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Class Title</label>
                                    <input required name="title" defaultValue={defaults.title} className="w-full p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Start Time</label>
                                    <input required type="datetime-local" name="startTime" className="w-full p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900" />
                                </div>
                                <input type="hidden" name="price" value={defaults.price} />
                            </div>
                            <button disabled={isSubmitting} className="w-full mt-8 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition">
                                {isSubmitting ? <Loader2 className="animate-spin" /> : <>Next Step <ArrowRight size={16} /></>}
                            </button>
                        </Form>
                    )}

                    {/* Step 5: Import */}
                    {currentStep === 5 && (
                        <div>
                            <DataImportForm
                                tenantSlug={tenant.slug}
                                onSuccess={() => {
                                    // Submit a hidden form to advance step on server
                                    const form = document.getElementById('advance-step-form') as HTMLFormElement;
                                    if (form) form.submit();
                                    setCurrentStep(6);
                                }}
                                onSkip={() => {
                                    const form = document.getElementById('advance-step-form') as HTMLFormElement;
                                    if (form) form.submit();
                                    setCurrentStep(6);
                                }}
                            />
                            {/* Hidden form to persist step advancement to 6 */}
                            <Form method="post" id="advance-step-form" className="hidden">
                                <input type="hidden" name="step" value="import_complete" />
                            </Form>
                        </div>
                    )}

                    {/* Step 6: Completion */}
                    {currentStep === 6 && (
                        <div className="text-center">
                            <div className="text-6xl mb-4 animate-bounce">🎉</div>
                            <p className="text-zinc-600 dark:text-zinc-400 mb-8">
                                Great job! Your `{template}` studio is now configured.
                            </p>
                            <Link to={`/studio/${tenant.slug}`} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 dark:shadow-none">
                                Go to Dashboard
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
