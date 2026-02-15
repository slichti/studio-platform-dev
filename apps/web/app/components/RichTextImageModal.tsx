import { useState } from "react";
import { Upload, Link as LinkIcon, X, Check, Image as ImageIcon } from "lucide-react";
import { apiRequest, API_URL } from "~/utils/api";
import { useAuth } from "@clerk/react-router";
import { Modal } from "~/components/Modal";
import { toast } from "sonner";

interface RichTextImageModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (url: string) => void;
}

export function RichTextImageModal({ isOpen, onClose, onSelect }: RichTextImageModalProps) {
    const { getToken } = useAuth();
    const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
    const [uploading, setUploading] = useState(false);
    const [urlInput, setUrlInput] = useState('');
    const [dragActive, setDragActive] = useState(false);

    const handleFile = async (file: File) => {
        setUploading(true);
        try {
            const token = await getToken();
            const formData = new FormData();
            formData.append('file', file);

            // Use the R2 upload endpoint which returns a relative URL
            const res = await apiRequest('/uploads/r2-image', token, {
                method: 'POST',
                body: formData
            });

            if (res.url) {
                // Ensure the URL is absolute for email clients
                const fullUrl = res.url.startsWith('http')
                    ? res.url
                    : `${API_URL}${res.url.startsWith('/') ? '' : '/'}${res.url}`;

                onSelect(fullUrl);
                onClose();
            } else {
                throw new Error("No URL returned from upload");
            }
        } catch (e: any) {
            console.error(e);
            toast.error("Upload failed: " + (e.message || "Unknown error"));
        } finally {
            setUploading(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleUrlSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (urlInput) {
            onSelect(urlInput);
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Insert Image">
            <div className="flex flex-col h-full">
                <div className="flex border-b border-zinc-200 mb-4">
                    <button
                        onClick={() => setActiveTab('upload')}
                        className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'upload'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-zinc-500 hover:text-zinc-700'
                            }`}
                    >
                        Upload
                    </button>
                    <button
                        onClick={() => setActiveTab('url')}
                        className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'url'
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-zinc-500 hover:text-zinc-700'
                            }`}
                    >
                        Image URL
                    </button>
                </div>

                {activeTab === 'upload' ? (
                    <div
                        className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 transition-colors ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-zinc-200 bg-zinc-50'
                            }`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        {uploading ? (
                            <div className="flex flex-col items-center animate-pulse">
                                <Upload className="w-8 h-8 text-blue-500 mb-2" />
                                <span className="text-sm text-zinc-500">Uploading...</span>
                            </div>
                        ) : (
                            <>
                                <div className="bg-white p-3 rounded-full shadow-sm mb-3">
                                    <Upload className="w-6 h-6 text-zinc-400" />
                                </div>
                                <p className="text-sm font-medium text-zinc-900 mb-1">Click to upload or drag and drop</p>
                                <p className="text-xs text-zinc-500 mb-4">SVG, PNG, JPG or GIF</p>
                                <label className="cursor-pointer">
                                    <span className="bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-700 font-medium py-1.5 px-4 rounded shadow-sm text-sm">
                                        Select File
                                    </span>
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                                    />
                                </label>
                            </>
                        )}
                    </div>
                ) : (
                    <form onSubmit={handleUrlSubmit} className="flex flex-col gap-4 py-4">
                        <div>
                            <label className="block text-xs font-medium text-zinc-700 mb-1">Image URL</label>
                            <div className="relative">
                                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                                <input
                                    type="url"
                                    value={urlInput}
                                    onChange={(e) => setUrlInput(e.target.value)}
                                    placeholder="https://"
                                    className="w-full pl-9 pr-3 py-2 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="flex justify-end pt-2">
                            <button
                                type="submit"
                                disabled={!urlInput}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Insert Image
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </Modal>
    );
}
