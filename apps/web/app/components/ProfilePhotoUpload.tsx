import { useState, useRef } from "react";
import { Camera, Loader2 } from "lucide-react";
import { apiRequest, API_URL } from "~/utils/api";

interface ProfilePhotoUploadProps {
    /** Current portrait URL, if any */
    currentPhotoUrl?: string | null;
    /** User's first initial for fallback avatar */
    initials: string;
    /** Auth token for API calls */
    token: string;
    /** Tenant slug for X-Tenant-Slug header */
    slug: string;
    /** Optional target member ID (for admin uploading on behalf of someone) */
    memberId?: string;
    /** Size in pixels (default 80) */
    size?: number;
    /** Called after successful upload with the new URL */
    onUploaded?: (url: string) => void;
}

export function ProfilePhotoUpload({
    currentPhotoUrl,
    initials,
    token,
    slug,
    memberId,
    size = 80,
    onUploaded,
}: ProfilePhotoUploadProps) {
    const [photoUrl, setPhotoUrl] = useState(currentPhotoUrl || null);
    const [uploading, setUploading] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        // Client-side validation
        if (!file.type.startsWith("image/")) {
            alert("Please select an image file.");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            alert("Image must be under 5MB.");
            return;
        }

        // Show preview immediately
        const previewUrl = URL.createObjectURL(file);
        setPreview(previewUrl);

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            if (memberId) {
                formData.append("memberId", memberId);
            }

            const result = await apiRequest<{ portraitUrl: string }>(
                "/uploads/portrait",
                token,
                {
                    method: "POST",
                    body: formData,
                    headers: { "X-Tenant-Slug": slug },
                }
            );

            setPhotoUrl(result.portraitUrl);
            setPreview(null);
            URL.revokeObjectURL(previewUrl);
            onUploaded?.(result.portraitUrl);
        } catch (err: any) {
            console.error("Photo upload failed:", err);
            setPreview(null);
            URL.revokeObjectURL(previewUrl);
            alert("Failed to upload photo. Please try again.");
        } finally {
            setUploading(false);
            // Reset input so re-selecting the same file triggers onChange
            if (inputRef.current) inputRef.current.value = "";
        }
    }

    const displayUrl = preview || photoUrl;

    return (
        <div className="relative group" style={{ width: size, height: size }}>
            {/* Avatar circle */}
            <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="w-full h-full rounded-full overflow-hidden border-2 border-zinc-200 dark:border-zinc-700 bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center cursor-pointer transition-all hover:border-indigo-400 dark:hover:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                aria-label="Upload profile photo"
            >
                {displayUrl ? (
                    <img
                        src={displayUrl}
                        alt="Profile"
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <span
                        className="text-indigo-600 dark:text-indigo-400 font-bold select-none"
                        style={{ fontSize: size * 0.35 }}
                    >
                        {initials}
                    </span>
                )}
            </button>

            {/* Hover overlay */}
            {!uploading && (
                <div
                    onClick={() => inputRef.current?.click()}
                    className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                >
                    <Camera size={size * 0.25} className="text-white" />
                </div>
            )}

            {/* Loading spinner overlay */}
            {uploading && (
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                    <Loader2 size={size * 0.3} className="text-white animate-spin" />
                </div>
            )}

            {/* Hidden file input */}
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
            />
        </div>
    );
}
