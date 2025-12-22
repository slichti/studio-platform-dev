import { ActionFunction, LoaderFunction } from "react-router";
import { useLoaderData, Form, useActionData, useNavigation, useOutletContext } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { apiRequest } from "../utils/api";
import { useState } from "react";
import { Modal } from "../components/Modal";
import ReactMarkdown from 'react-markdown'; // Ensure this package is installed or use simple whitespace-pre-wrap

// Loader: Fetch waivers
export const loader: LoaderFunction = async (args) => {
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
export const action: ActionFunction = async (args) => {
    const { request, params } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "create") {
        const title = formData.get("title");
        const content = formData.get("content");
        try {
            await apiRequest("/waivers", token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': params.slug! },
                body: JSON.stringify({ title, content })
            });
            return { success: true };
        } catch (e: any) {
            return { error: e.message };
        }
    } else if (intent === "sign") {
        const templateId = formData.get("templateId");
        const signatureData = formData.get("signatureData"); // e.g. checked box or name
        try {
            await apiRequest(`/waivers/${templateId}/sign`, token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': params.slug! },
                body: JSON.stringify({ signatureData, ipAddress: "browser" })
            });
            return { success: true, signed: true };
        } catch (e: any) {
            return { error: e.message };
        }
    }
    return null;
};

export default function StudioWaivers() {
    const { data, error } = useLoaderData<any>();
    const { roles } = useOutletContext<any>();
    const isOwner = roles.includes('owner');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    if (error) {
        return <div className="text-red-600">Error: {error}</div>;
    }

    // OWNER VIEW
    if (isOwner) {
        const templates = data?.templates || [];
        return (
            <div>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">Waivers & Forms</h2>
                    <button
                        onClick={() => setIsCreateOpen(true)}
                        className="bg-zinc-900 text-white px-4 py-2 rounded-md hover:bg-zinc-800 text-sm font-medium"
                    >
                        + Create Waiver
                    </button>
                </div>

                <div className="space-y-4">
                    {templates.length === 0 ? (
                        <div className="p-8 text-center text-zinc-500 bg-zinc-50 rounded-lg border border-dashed border-zinc-300">
                            No waiver templates created yet.
                        </div>
                    ) : (
                        templates.map((t: any) => (
                            <div key={t.id} className="bg-white p-6 rounded-lg border border-zinc-200 shadow-sm">
                                <h3 className="font-bold text-lg mb-2">{t.title}</h3>
                                <div className="text-sm text-zinc-600 line-clamp-3 mb-4 whitespace-pre-wrap bg-zinc-50 p-3 rounded">{t.content}</div>
                                <div className="flex gap-2">
                                    <span className={`text-xs px-2 py-1 rounded ${t.active ? 'bg-green-100 text-green-800' : 'bg-zinc-100 text-zinc-800'}`}>
                                        {t.active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create Waiver">
                    <Form method="post" onSubmit={() => setIsCreateOpen(false)}>
                        <input type="hidden" name="intent" value="create" />
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Title</label>
                                <input name="title" required placeholder="Liability Release" className="w-full border rounded px-3 py-2" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Content</label>
                                <textarea name="content" required rows={10} className="w-full border rounded px-3 py-2 font-mono text-sm" placeholder="Legal text here..." />
                            </div>
                            <button disabled={isSubmitting} className="w-full bg-zinc-900 text-white py-2 rounded">
                                {isSubmitting ? 'Saving...' : 'Save Waiver'}
                            </button>
                        </div>
                    </Form>
                </Modal>
            </div>
        );
    }

    // STUDENT VIEW
    const { waiver, required, signed, signatureDate } = data || {};

    if (!required || !waiver) {
        return (
            <div className="text-center py-12">
                <h2 className="text-xl font-medium text-zinc-900">Good to go!</h2>
                <p className="text-zinc-500">No pending waivers to sign.</p>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto py-8">
            <h2 className="text-2xl font-bold mb-6">{waiver.title}</h2>

            <div className="bg-white border border-zinc-200 rounded-lg p-8 shadow-sm mb-6 max-h-[500px] overflow-y-auto">
                <div className="prose text-zinc-700 whitespace-pre-wrap">
                    {waiver.content}
                </div>
            </div>

            {signed ? (
                <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg flex items-center justify-center gap-2">
                    ✅ Signed on {new Date(signatureDate).toLocaleDateString()}
                </div>
            ) : (
                <div className="bg-zinc-50 p-6 rounded-lg border border-zinc-200">
                    <h3 className="font-bold mb-4">Acceptance</h3>
                    <Form method="post">
                        <input type="hidden" name="intent" value="sign" />
                        <input type="hidden" name="templateId" value={waiver.id} />
                        <input type="hidden" name="signatureData" value="Agreed explicitly via UI" />

                        <div className="flex items-start gap-3 mb-6">
                            <input type="checkbox" required id="agree" className="mt-1" />
                            <label htmlFor="agree" className="text-sm text-zinc-700">
                                I have read and agree to the terms of this waiver.
                                by checking this box, I electronically sign this document.
                            </label>
                        </div>

                        <button
                            disabled={isSubmitting}
                            className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
                        >
                            {isSubmitting ? 'Signing...' : 'Sign Waiver'}
                        </button>
                    </Form>
                </div>
            )}
        </div>
    );
}
