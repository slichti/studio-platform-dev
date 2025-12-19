import { useState } from "react";
import { apiRequest } from "../utils/api";
import { useAuth } from "@clerk/remix";

export default function ImageUploader({ onUploadComplete }: { onUploadComplete: (url: string) => void }) {
    const { getToken } = useAuth();
    const [uploading, setUploading] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const token = await getToken();

            // 1. Get Upload URL from our API
            const { uploadURL } = await apiRequest("/uploads/image", token, {
                method: "POST"
            }) as { uploadURL: string; id: string };

            // 2. Upload directly to Cloudflare
            const formData = new FormData();
            formData.append("file", file);

            const cfResponse = await fetch(uploadURL, {
                method: "POST",
                body: formData
            });

            if (!cfResponse.ok) {
                throw new Error("Failed to upload image to Cloudflare");
            }

            const cfData = await cfResponse.json() as { result: { id: string } };
            // Cloudflare returns variants. Let's assume 'public' or use the ID.
            // Construct public URL: https://imagedelivery.net/<ACCOUNT_HASH>/<IMAGE_ID>/public
            // Ideally our API should return the account hash or full URL prefix, but for now let's pass back the ID or look for variants in response (if available).
            // Direct Upload response usually contains 'result: { id: ..., variants: [...] }'

            // For simplicity, let's just pass back the ID, and we can construct URL in display.
            // Or better, let's assume we want to save the full variants[0] or similar.

            const imageId = cfData.result.id;
            // Hacky: We need the account hash which is part of the variant URL usually
            // ex: https://imagedelivery.net/ZWd9.../imageId/public
            // Let's rely on the user having configured a delivery domain or just use ID if we want.
            // Actually, let's pass the ID back.

            onUploadComplete(imageId);
            setPreview(URL.createObjectURL(file));

        } catch (e) {
            console.error(e);
            alert("Upload failed");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div style={{ marginTop: '10px' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '5px' }}>Thumbnail</label>
            <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={uploading}
                style={{ fontSize: '0.875rem' }}
            />
            {uploading && <span style={{ fontSize: '0.875rem', color: '#71717a', marginLeft: '10px' }}>Uploading...</span>}
            {preview && (
                <div style={{ marginTop: '10px' }}>
                    <img src={preview} alt="Preview" style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '6px' }} />
                </div>
            )}
        </div>
    );
}
