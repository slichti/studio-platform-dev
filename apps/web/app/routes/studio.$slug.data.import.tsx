import { useState } from "react";
// @ts-ignore
import { useOutletContext, Form } from "react-router";
import { apiRequest } from "../utils/api";
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";

export default function DataImport() {
    const { tenant } = useOutletContext<any>();
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
            setResult(null);
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) {
            setError("Please select a file.");
            return;
        }

        setUploading(true);
        setError(null);
        setResult(null);

        try {
            const token = await (window as any).Clerk?.session?.getToken();
            const formData = new FormData();
            formData.append('file', file);

            // Use fetch directly for FormData content-type handling (boundary)
            // apiRequest helper might force Content-Type: application/json or similar if we aren't careful
            // But apiRequest usually handles headers. If we pass body as FormData, browser sets content-type.

            // Let's use apiRequest but ensure we don't set Content-Type to JSON manually.
            // My utility might mock it or be simple. Let's use raw fetch for safety here or check utility.
            // Assuming apiRequest handles it if body is not string.

            // Actually, my apiRequest utility:
            /*
             export const apiRequest = async (path: string, token: string | null, options: RequestInit = {}) => {
                const headers: any = { ...options.headers };
                if (token) headers['Authorization'] = `Bearer ${token}`;
                if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
                    headers['Content-Type'] = 'application/json';
                }
                ...
             }
            */
            // So if body is FormData (object), it won't set JSON header. Correct.

            const res: any = await apiRequest(`/import/csv`, token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': tenant.slug },
                body: formData
            });

            if (res.error) {
                setError(res.error);
                if (res.details) {
                    console.error(res.details);
                }
            } else {
                setResult(res);
            }

        } catch (err: any) {
            setError(err.message || "Upload failed.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="max-w-4xl pb-10">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-zinc-900">Data Import</h1>
                <p className="text-zinc-500 mt-2">Migrate your data from another system using CSV files.</p>
            </div>

            <div className="bg-white border border-zinc-200 rounded-lg p-6 shadow-sm mb-8">
                <h2 className="text-lg font-semibold mb-4">Import Users & Memberships</h2>

                <div className="mb-6 p-4 bg-blue-50 text-blue-800 rounded text-sm">
                    <p className="font-semibold mb-1">CSV Format Requirements:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Headers required: <code>email</code>, <code>firstname</code>, <code>lastname</code></li>
                        <li>Optional: <code>phone</code>, <code>address</code>, <code>dob</code> (YYYY-MM-DD), <code>minor</code> (yes/no)</li>
                        <li>Membership: <code>membership</code> (Plan Name - must match exactly)</li>
                    </ul>
                    <p className="font-semibold mt-3 mb-1">OR Import Classes:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Headers required: <code>title</code>, <code>start_time</code> (ISO 8601), <code>duration</code> (minutes), <code>instructor_email</code></li>
                        <li>Optional: <code>description</code>, <code>capacity</code>, <code>price</code>, <code>location</code> (Name)</li>
                    </ul>
                </div>

                <form onSubmit={handleUpload} className="space-y-6">
                    <div className="border-2 border-dashed border-zinc-300 rounded-lg p-8 flex flex-col items-center justify-center text-center hover:bg-zinc-50 transition-colors">
                        <Upload className="h-10 w-10 text-zinc-400 mb-3" />

                        {file ? (
                            <div className="flex items-center gap-2 text-zinc-900 font-medium">
                                <FileText className="h-5 w-5 text-blue-500" />
                                {file.name}
                            </div>
                        ) : (
                            <div>
                                <label htmlFor="file-upload" className="cursor-pointer">
                                    <span className="text-blue-600 font-medium hover:text-blue-500">Upload a file</span>
                                    <span className="text-zinc-500"> or drag and drop</span>
                                    <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".csv" onChange={handleFileChange} />
                                </label>
                                <p className="text-xs text-zinc-500 mt-1">CSV up to 10MB</p>
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="flex items-start gap-2 bg-red-50 text-red-600 p-3 rounded">
                            <AlertCircle className="h-5 w-5 shrink-0" />
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    {result && (
                        <div className="bg-green-50 text-green-800 p-4 rounded border border-green-200">
                            <div className="flex items-center gap-2 mb-2 font-semibold">
                                <CheckCircle className="h-5 w-5" />
                                Import Complete
                            </div>
                            <div className="text-sm space-y-1">
                                <p>Total Rows: {result.total}</p>
                                <p>Created: {result.created}</p>
                                <p>Skipped: {result.skipped}</p>
                                {result.errors && result.errors.length > 0 && (
                                    <div className="mt-2">
                                        <p className="font-medium text-red-600">Errors:</p>
                                        <ul className="list-disc pl-5 text-red-600 max-h-32 overflow-y-auto">
                                            {result.errors.map((e: string, i: number) => (
                                                <li key={i}>{e}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={!file || uploading}
                            className="bg-zinc-900 text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-zinc-800 disabled:opacity-50 flex items-center gap-2"
                        >
                            {uploading ? 'Importing...' : 'Start Import'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
