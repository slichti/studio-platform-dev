import { type LoaderFunctionArgs } from "react-router";
import { Form, useLoaderData, useNavigation, useActionData } from "react-router";
import { useState } from "react";
import { apiRequest } from "~/utils/api";
import { SignaturePad } from "~/components/SignaturePad"; // Ensure this path is correct
import { toast } from "sonner";
import { Check, ArrowRight } from "lucide-react";

export const loader = async ({ params }: LoaderFunctionArgs) => {
    // 1. Fetch Tenant Context (Public) - Middleware handles context, we just need basic info or use the generic public endpoint
    // Actually our apiRequest will handle the header if we pass it.
    // We need to get the ACTIVE WAIVER for this tenant. 
    // The previously read `GET /waivers` endpoint handles public request? 
    // Let's check waivers.ts: `app.get('/', ...)` -> checks `c.get('tenant')`.
    // It logic branches: if owner -> list all. if else -> returns { required, waiver, signed }.
    // But it checks for `member` (auth). if (!member) -> returns { required: true, waiver, signed: false }.
    // So `GET /waivers` IS SAFE for public use (it returns the active waiver).

    try {
        const data = await apiRequest("/waivers", null, {
            headers: { 'X-Tenant-Slug': params.slug! }
        });
        return { data, tenantSlug: params.slug };
    } catch (e: any) {
        console.error("Loader Error", e);
        throw new Response("Failed to load waiver", { status: 500 });
    }
};

export const action = async ({ request, params }: any) => {
    const formData = await request.formData();
    const firstName = formData.get("firstName");
    const lastName = formData.get("lastName");
    const email = formData.get("email");
    const signatureData = formData.get("signatureData");
    const templateId = formData.get("templateId");

    try {
        const res: any = await apiRequest("/waivers/sign/public", null, {
            method: "POST",
            headers: { 'X-Tenant-Slug': params.slug! },
            body: JSON.stringify({ firstName, lastName, email, signatureData, templateId })
        });

        if (res.error) return { error: res.error };
        return { success: true };
    } catch (e: any) {
        return { error: e.message };
    }
};

export default function PublicWaiverPage() {
    const { data, tenantSlug } = useLoaderData<typeof loader>();
    const actionData = useActionData();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";
    const [step, setStep] = useState(1);
    const [signature, setSignature] = useState<string | null>(null);

    const waiver = data?.waiver;

    if (!waiver) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-2">No Active Waiver</h1>
                    <p className="text-zinc-500">This studio does not currently have an active waiver to sign.</p>
                </div>
            </div>
        );
    }

    if (actionData?.success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
                <div className="bg-white dark:bg-zinc-900 p-8 rounded-xl shadow-lg max-w-md w-full text-center border border-zinc-200 dark:border-zinc-800 animate-in zoom-in duration-300">
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Check className="w-10 h-10" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2 text-zinc-900 dark:text-zinc-100">Waiver Signed!</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mb-6">
                        Thank you for signing. A copy has been sent to your email.
                    </p>
                    <a href={`/site/${tenantSlug}`} className="text-blue-600 hover:underline">
                        Return to Home
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-3xl mx-auto">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{waiver.title}</h1>
                    <p className="mt-2 text-zinc-600 dark:text-zinc-400">Please review and sign the document below.</p>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
                    {/* Waiver Content Scroll Area */}
                    <div className="p-8 max-h-[60vh] overflow-y-auto border-b border-zinc-100 dark:border-zinc-800">
                        <div className="prose dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300 prose-sm sm:prose-base font-serif">
                            {waiver.content}
                        </div>
                    </div>

                    <div className="p-8 bg-zinc-50 dark:bg-zinc-900/50">
                        <Form method="post" className="space-y-6">
                            <input type="hidden" name="templateId" value={waiver.id} />

                            {actionData?.error && (
                                <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm mb-4">
                                    {actionData.error}
                                </div>
                            )}

                            {step === 1 && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-right-8 duration-300">
                                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Step 1: Your Information</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">First Name</label>
                                            <input name="firstName" required className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Jane" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Last Name</label>
                                            <input name="lastName" required className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Doe" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Email Address</label>
                                        <input name="email" type="email" required className="w-full px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="jane@example.com" />
                                    </div>
                                    <div className="pt-4">
                                        <button type="button" onClick={() => setStep(2)} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg font-medium hover:opacity-90 transition-opacity">
                                            Next: Sign Document <ArrowRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {step === 2 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Step 2: Signature</h3>
                                        <button type="button" onClick={() => setStep(1)} className="text-sm text-zinc-500 hover:text-zinc-900 underline">Edit Info</button>
                                    </div>

                                    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                                        <p className="p-2 text-xs text-center text-zinc-400 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">Draw your signature below</p>
                                        <SignaturePad
                                            onChange={(data) => setSignature(data)}
                                            width={600}
                                            height={200}
                                        />
                                    </div>
                                    <input type="hidden" name="signatureData" value={signature || ''} />

                                    <div className="flex items-start gap-3">
                                        <input type="checkbox" required id="agree" className="mt-1 w-5 h-5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500" />
                                        <label htmlFor="agree" className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                            I acknowledge that I have read and agree to the terms of the waiver above.
                                            I understand that by signing electronically, I am legally bound by this agreement.
                                        </label>
                                    </div>

                                    <div className="pt-2">
                                        <button
                                            type="submit"
                                            disabled={!signature || isSubmitting}
                                            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-lg font-bold text-lg hover:bg-blue-700 shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-[0.99]"
                                        >
                                            {isSubmitting ? 'Signing...' : 'Sign & Complete'}
                                        </button>
                                    </div>
                                </div>
                            )}

                        </Form>
                    </div>
                </div>

                <div className="text-center mt-8 text-zinc-400 text-sm">
                    Protected by <strong>Studio Platform</strong> security
                </div>
            </div>
        </div>
    );
}
