
import type { ActionFunctionArgs } from "react-router";

import { Form, useNavigation, useActionData, Link } from "react-router";
import { useAuth } from "@clerk/react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { ArrowLeft, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const action = async (args: ActionFunctionArgs) => {
    const { request, params } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();

    const formData = await request.formData();
    const title = formData.get("title");
    const content = formData.get("content");
    const pdfUrl = formData.get("pdfUrl");

    try {
        const res: any = await apiRequest("/waivers", token, {
            method: "POST",
            headers: { 'X-Tenant-Slug': params.slug! },
            body: JSON.stringify({ title, content, pdfUrl })
        });

        if (res.error) return { error: res.error };
        return { success: true, id: res.id };
    } catch (e: any) {
        return { error: e.message };
    }
};

export default function NewWaiverTemplate() {
    const actionData = useActionData();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    // Simple state for success message redirect or show
    if (actionData?.success) {
        return (
            <div className="max-w-2xl mx-auto py-12 text-center">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Save className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Template Created!</h2>
                <p className="text-zinc-600 mb-8">Your waiver template has been successfully saved.</p>
                <div className="flex justify-center gap-4">
                    <Link to="../waivers" className="px-4 py-2 bg-zinc-900 text-white rounded-md hover:bg-zinc-800 transition">
                        Back to Waivers
                    </Link>
                </div>
            </div>
        );
    }

    const [uploading, setUploading] = useState(false);
    const { getToken } = useAuth(); // Need client auth for upload

    return (
        <div className="max-w-4xl mx-auto py-8">
            <div className="mb-8">
                <Link to="../waivers" className="flex items-center text-sm text-zinc-500 hover:text-zinc-900 mb-4 transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back to Waivers
                </Link>
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Create Waiver Template</h1>
                <p className="text-zinc-500 dark:text-zinc-400">Design a liability waiver for your members to sign.</p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm">
                <Form method="post" className="space-y-6">
                    {actionData && 'error' in (actionData as any) && (actionData as any).error && (
                        <div className="text-red-600 text-sm bg-red-50 p-2 rounded border border-red-200">
                            Error saving: {(actionData as any).error}
                        </div>
                    )}                <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                            Document Title
                        </label>
                        <input
                            type="text"
                            name="title"
                            required
                            placeholder="e.g. Activity Liability Waiver 2024"
                            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                            Legal Content
                            <span className="ml-2 text-xs font-normal text-zinc-500">
                                (You can paste plain text or HTML here)
                            </span>
                        </label>
                        <textarea
                            name="content"
                            required
                            rows={15}
                            placeholder="I, the undersigned, agree to..."
                            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Create from PDF (Optional)</label>
                        <p className="text-xs text-zinc-500 mb-2">Upload a PDF to link it or extract text (extraction not yet supported, just linking).</p>
                        <input
                            type="file"
                            accept=".pdf"
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    setUploading(true);
                                    try {
                                        const token = await getToken();
                                        const slug = window.location.pathname.split('/')[2];
                                        const formData = new FormData();
                                        formData.append('file', file);

                                        const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://studio-platform-api.slichti.workers.dev'}/uploads/pdf`, {
                                            method: 'POST',
                                            headers: {
                                                'Authorization': `Bearer ${token}`,
                                                'X-Tenant-Slug': slug
                                            },
                                            body: formData
                                        });

                                        if (!res.ok) throw new Error(await res.text());
                                        const data = await res.json();

                                        const input = document.getElementById('pdf-url-input') as HTMLInputElement;

                                        if (input) input.value = (data as any).url;
                                        toast.success("PDF Uploaded successfully!");
                                    } catch (err: any) {
                                        toast.error("Upload failed: " + err.message);
                                    } finally {
                                        setUploading(false);
                                    }
                                }
                            }}
                            className="block w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                        <input type="hidden" name="pdfUrl" id="pdf-url-input" />
                    </div>

                    <div className="flex justify-end pt-4 border-t border-zinc-100 dark:border-zinc-800">
                        <button
                            type="submit"
                            disabled={isSubmitting || uploading}
                            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            <Save className="w-4 h-4" />
                            {isSubmitting ? 'Saving...' : 'Save Template'}
                        </button>
                    </div>
                </Form>
            </div>
        </div>
    );
}
