// @ts-ignore
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
// @ts-ignore
import { useLoaderData, Form, useActionData, useNavigation, useOutletContext, Link } from "react-router";
import { useAuth } from "@clerk/react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { useState, useRef, useEffect } from "react";
import { Modal } from "../components/Modal";
import { SignaturePad } from "../components/SignaturePad";
import ReactMarkdown from 'react-markdown'; // Ensure this package is installed or use simple whitespace-pre-wrap

// Loader: Fetch waivers
export const loader = async (args: LoaderFunctionArgs) => {
    const { params } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();

    try {
        const data = await apiRequest("/waivers", token, {
            headers: { 'X-Tenant-Slug': params.slug! }
        });
        return { data }; // data contains { templates } for owner or { waiver, signed } for student
    } catch (e: any) {
        console.error("Failed to load waivers", e);
        return { data: null, error: e.message };
    }
};

// Action: Create Waiver (Owner) or Sign (Student)
export const action = async (args: ActionFunctionArgs) => {
    const { request, params } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "create") {
        const title = formData.get("title");
        const content = formData.get("content");
        const pdfUrl = formData.get("pdfUrl");
        try {
            await apiRequest("/waivers", token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': params.slug! },
                body: JSON.stringify({ title, content, pdfUrl })
            });
            return { success: true };
        } catch (e: any) {
            return { error: e.message };
        }
    } else if (intent === "toggle_active") {
        const templateId = formData.get("templateId");
        const active = formData.get("active") === "true";
        try {
            await apiRequest(`/waivers/${templateId}`, token, {
                method: "PATCH",
                headers: { 'X-Tenant-Slug': params.slug! },
                body: JSON.stringify({ active })
            });
            return { success: true };
        } catch (e: any) {
            return { error: e.message };
        }
    } else if (intent === "sign") {
        const templateId = formData.get("templateId");
        const signatureData = formData.get("signatureData");
        const onBehalfOfMemberId = formData.get("onBehalfOfMemberId");
        try {
            await apiRequest(`/waivers/${templateId}/sign`, token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': params.slug! },
                body: JSON.stringify({ signatureData, onBehalfOfMemberId })
            });
            return { success: true };
        } catch (e: any) {
            return { error: e.message };
        }
    }
    return null;
};

export default function StudioWaivers() {
    const { data, error } = useLoaderData<any>();
    const { me, roles } = useOutletContext<any>();
    const isOwner = roles.includes('owner');
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";
    const [signature, setSignature] = useState<string | null>(null);

    // Initial Error Check
    if (error) {
        return <div className="p-8 text-red-600">Error: {error}</div>;
    }

    // OWNER VIEW
    if (isOwner) {
        const templates = (data as { templates?: any[] })?.templates || [];
        return (
            <div className="max-w-4xl mx-auto py-8 px-4">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Waivers & Forms</h2>
                    <Link
                        to="new"
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium flex items-center gap-2"
                    >
                        + Create Waiver
                    </Link>
                </div>

                <div className="space-y-4">
                    {templates.length === 0 ? (
                        <div className="p-12 text-center text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700">
                            <p className="mb-2 font-medium">No waiver templates yet</p>
                            <p className="text-sm">Create a liability waiver for your members to sign.</p>
                        </div>
                    ) : (
                        templates.map((t: any) => (
                            <div key={t.id} className="p-6 rounded-lg shadow-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100">{t.title}</h3>
                                    <Form method="post">
                                        <input type="hidden" name="intent" value="toggle_active" />
                                        <input type="hidden" name="templateId" value={t.id} />
                                        <input type="hidden" name="active" value={(!t.active).toString()} />
                                        <button
                                            type="submit"
                                            className={`text-xs px-2 py-1 rounded border font-medium transition-colors ${t.active
                                                ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
                                                : 'bg-zinc-100 text-zinc-800 border-zinc-200 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                                                }`}
                                        >
                                            {t.active ? 'Active' : 'Inactive'}
                                        </button>
                                    </Form>
                                </div>
                                <div className="text-sm line-clamp-3 mb-1 whitespace-pre-wrap text-zinc-600 dark:text-zinc-400 font-mono bg-zinc-50 dark:bg-zinc-950 p-3 rounded border border-zinc-100 dark:border-zinc-800/50">
                                    {t.content}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    }

    // STUDENT VIEW
    const { waiver, required, signed, signatureDate, family, signedMemberIds } = (data as any) || {};
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

    if (!required || !waiver) {
        return (
            <div className="max-w-md mx-auto py-12 px-4 text-center">
                <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                </div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Good to go!</h2>
                <p className="text-zinc-500 dark:text-zinc-400">You have no pending waivers to sign.</p>
            </div>
        );
    }

    const isSigned = signedMemberIds?.includes(selectedMemberId || me?.id);

    return (
        <div className="max-w-2xl mx-auto py-8 px-4">
            <h2 className="text-2xl font-bold mb-6 text-zinc-900 dark:text-zinc-100">{waiver.title}</h2>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm mb-6 max-h-[60vh] overflow-y-auto">
                <div className="prose dark:prose-invert text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap font-serif text-sm leading-relaxed">
                    {waiver.content}
                </div>
            </div>

            {family && family.length > 0 && (
                <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-lg p-4">
                    <label className="block text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Who are you signing for?</label>
                    <select
                        className="w-full bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 rounded-md text-sm px-3 py-2"
                        value={selectedMemberId || ''}
                        onChange={(e) => setSelectedMemberId(e.target.value || null)}
                    >
                        <option value="">Myself {signed ? '✅' : ''}</option>
                        {family.map((f: any) => (
                            <option key={f.memberId} value={f.memberId}>
                                {f.firstName} {f.lastName} {signedMemberIds?.includes(f.memberId) ? '✅' : ''}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {isSigned ? (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/50 text-green-800 dark:text-green-300 p-6 rounded-lg flex flex-col items-center justify-center gap-2 text-center">
                    <div className="text-2xl">✅</div>
                    <div className="font-bold">Waiver Signed</div>
                    <div className="text-sm opacity-80">This member has successfully signed the waiver.</div>
                </div>
            ) : (
                <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6">
                    <h3 className="font-bold mb-4 text-zinc-900 dark:text-white">Sign Waiver</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                        Please draw your signature below to accept this agreement.
                    </p>

                    <div className="mb-6 bg-white dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                        <SignaturePad
                            onChange={(data) => setSignature(data)}
                            width={600}
                            height={200}
                        />
                    </div>
                    {signature && (
                        <p className="text-xs text-green-600 dark:text-green-400 mb-4 flex items-center gap-1 font-medium">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            Signature captured
                        </p>
                    )}

                    <Form method="post">
                        <input type="hidden" name="intent" value="sign" />
                        <input type="hidden" name="templateId" value={waiver.id} />
                        <input type="hidden" name="signatureData" value={signature || ''} />
                        <input type="hidden" name="onBehalfOfMemberId" value={selectedMemberId || ''} />

                        <div className="flex items-start gap-3 mb-6">
                            <input type="checkbox" required id="agree" className="mt-1 w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500" />
                            <label htmlFor="agree" className="text-sm text-zinc-700 dark:text-zinc-300 leading-snug">
                                I have read and agree to the terms of this waiver.
                                By drawing my signature above and checking this box, I electronically sign this document.
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={!signature || isSubmitting}
                            className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? 'Signing...' : 'Sign Waiver'}
                        </button>
                    </Form>
                </div>
            )}
        </div>
    );
}

