import { useState } from "react";
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { apiRequest } from "~/utils/api";

interface DataImportFormProps {
    tenantSlug: string;
    onSuccess?: () => void;
    onSkip?: () => void;
}

export function DataImportForm({ tenantSlug, onSuccess, onSkip }: DataImportFormProps) {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setError(null);
            setResult(null);

            // Client-side Validation
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target?.result as string;
                if (!text) return;

                const lines = text.split(/\r\n|\n/);
                if (lines.length > 0) {
                    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
                    const required = ['email', 'firstname', 'lastname'];
                    const missing = required.filter(r => !headers.includes(r));

                    if (missing.length > 0) {
                        setError(`Missing required headers: ${missing.join(', ')}`);
                        setFile(null); // Clear invalid file
                    }
                }
            };
            reader.readAsText(selectedFile);
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

            const res: any = await apiRequest(`/import/csv`, token, {
                method: "POST",
                headers: { 'X-Tenant-Slug': tenantSlug },
                body: formData
            });

            if (res.error) {
                setError(res.error);
                if (res.details) {
                    console.error(res.details);
                }
            } else {
                setResult(res);
                // Optional: Auto-advance after short delay or let user click Next
                // if (onSuccess) onSuccess(); 
            }

        } catch (err: any) {
            setError(err.message || "Upload failed.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded text-sm">
                <p className="font-semibold mb-1">CSV Format Requirements:</p>
                <ul className="list-disc pl-5 space-y-1">
                    <li>Headers: <code>email</code>, <code>firstname</code>, <code>lastname</code></li>
                    <li>Membership: <code>membership</code> (Plan Name)</li>
                </ul>
            </div>

            <form onSubmit={handleUpload} className="space-y-6">
                <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-8 flex flex-col items-center justify-center text-center hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <Upload className="h-10 w-10 text-zinc-400 mb-3" />

                    {file ? (
                        <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-medium">
                            <FileText className="h-5 w-5 text-blue-500" />
                            {file.name}
                        </div>
                    ) : (
                        <div>
                            <label htmlFor="file-upload" className="cursor-pointer">
                                <span className="text-blue-600 dark:text-blue-400 font-medium hover:text-blue-500">Upload CSV</span>
                                <span className="text-zinc-500"> or drag/drop</span>
                                <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".csv" onChange={handleFileChange} />
                            </label>
                            <p className="text-xs text-zinc-500 mt-1">Max 10MB</p>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded">
                        <AlertCircle className="h-5 w-5 shrink-0" />
                        <span className="text-sm">{error}</span>
                    </div>
                )}

                {result && (
                    <div className="bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 p-4 rounded border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-2 mb-2 font-semibold">
                            <CheckCircle className="h-5 w-5" />
                            Import Complete
                        </div>
                        <div className="text-sm space-y-1">
                            <p>Created: {result.created}, Skipped: {result.skipped}</p>
                            {result.errors && result.errors.length > 0 && (
                                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{result.errors.length} row errors (see logs)</p>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex justify-between items-center pt-4">
                    {onSkip && (
                        <button
                            type="button"
                            onClick={onSkip}
                            className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 text-sm font-medium"
                        >
                            Skip Import
                        </button>
                    )}

                    {result ? (
                        <button
                            type="button"
                            onClick={onSuccess}
                            className="bg-green-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-green-700 transition flex items-center gap-2"
                        >
                            Continue
                        </button>
                    ) : (
                        <button
                            type="submit"
                            disabled={!file || uploading}
                            className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-6 py-2 rounded-xl font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-2 ml-auto"
                        >
                            {uploading ? 'Importing...' : 'Start Import'}
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
}
