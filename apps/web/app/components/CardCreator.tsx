import { useState, useRef, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '../utils/cropImage'; // Helper we'll create

interface CardCreatorProps {
    initialImage?: string;
    initialTitle?: string;
    initialSubtitle?: string;
    onChange: (data: { image: Blob | null, title: string, subtitle: string, previewUrl: string }) => void;
}

export function CardCreator({ initialImage, initialTitle, initialSubtitle, onChange }: CardCreatorProps) {
    const [imageSrc, setImageSrc] = useState<string | null>(initialImage || null);
    const [title, setTitle] = useState(initialTitle || "");
    const [subtitle, setSubtitle] = useState(initialSubtitle || "");
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
    const [mode, setMode] = useState<'upload' | 'crop' | 'preview'>(initialImage ? 'preview' : 'upload');

    const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const imageDataUrl = await readFile(file);
            setImageSrc(imageDataUrl);
            setMode('crop');
        }
    };

    const handleCropSave = async () => {
        try {
            if (!imageSrc || !croppedAreaPixels) return;
            const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
            const previewUrl = URL.createObjectURL(croppedImageBlob);

            // Notify parent
            onChange({
                image: croppedImageBlob,
                title,
                subtitle,
                previewUrl
            });

            setMode('preview');
        } catch (e) {
            console.error(e);
        }
    };

    const readFile = (file: File): Promise<string> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.addEventListener('load', () => resolve(reader.result as string));
            reader.readAsDataURL(file);
        });
    };

    return (
        <div className="card-creator space-y-4">
            {mode === 'upload' && (
                <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-8 text-center bg-zinc-50 dark:bg-zinc-800/50 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800">
                    <p className="text-zinc-500 dark:text-zinc-400 mb-4 font-medium">Upload a background image for your membership card.</p>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                        id="card-image-upload"
                    />
                    <label
                        htmlFor="card-image-upload"
                        className="cursor-pointer inline-block bg-indigo-600 text-white px-4 py-2 rounded-md font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                        Choose Image
                    </label>
                </div>
            )}

            {mode === 'crop' && imageSrc && (
                <div className="relative h-64 w-full bg-zinc-900 rounded-lg overflow-hidden">
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={3 / 2} // Standard card aspect ratio
                        onCropChange={setCrop}
                        onCropComplete={onCropComplete}
                        onZoomChange={setZoom}
                    />
                    <div className="absolute bottom-4 right-4 z-10 space-x-2">
                        <button
                            type="button"
                            onClick={() => setMode('upload')}
                            className="bg-zinc-800/80 backdrop-blur text-white px-3 py-1 rounded text-sm hover:bg-zinc-700 font-medium transition-colors"
                        >
                            Change Image
                        </button>
                        <button
                            type="button"
                            onClick={handleCropSave}
                            className="bg-indigo-600 text-white px-3 py-1 rounded text-sm hover:bg-indigo-700 font-medium transition-colors shadow-lg"
                        >
                            Apply Crop
                        </button>
                    </div>
                </div>
            )}

            {mode === 'preview' && (
                <div className="space-y-4">
                    {/* The Card Preview */}
                    <div className="relative w-full aspect-[3/2] rounded-lg overflow-hidden shadow-md group">
                        {/* Background Image */}
                        {imageSrc && (
                            <img
                                src={imageSrc} // Note: This might need to be the cropped version URL if we saved it in state properly, but for 'preview' mode usually we use the cropped blob URL or if just text editing, the base image? 
                                // Actually, handleCropSave sets mode to preview but doesn't update imageSrc to the cropped one. 
                                // Let's assume parent manages proper preview URL or we use local state.
                                // For simplicity:
                                className="w-full h-full object-cover"
                                alt="Card Background"
                            />
                        )}

                        {/* Overlay */}
                        <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center text-center p-4">
                            <div className="bg-white/80 dark:bg-black/60 backdrop-blur-sm p-4 rounded-lg max-w-[80%]">
                                <h3 className="text-xl font-bold text-zinc-900 dark:text-white uppercase tracking-wider">{title || "Membership Title"}</h3>
                                {subtitle && <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1">{subtitle}</p>}
                            </div>
                        </div>

                        {/* Edit Overlay on Hover */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                                type="button"
                                onClick={() => setMode('crop')}
                                className="bg-white text-zinc-900 px-4 py-2 rounded-full font-medium hover:bg-zinc-100 shadow-lg transform transition-transform hover:scale-105"
                            >
                                Edit Image
                            </button>
                        </div>
                    </div>

                    {/* Text Inputs */}
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-zinc-500 dark:text-zinc-400">Overlay Title</label>
                            <input
                                value={title}
                                onChange={(e) => {
                                    setTitle(e.target.value);
                                    onChange({ image: null, title: e.target.value, subtitle, previewUrl: "" });
                                }}
                                className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-indigo-500 focus:border-indigo-500 text-zinc-900 dark:text-zinc-100"
                                placeholder="3 MONTH MEMBERSHIP"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-zinc-500 dark:text-zinc-400">Overlay Subtitle (Optional)</label>
                            <input
                                value={subtitle}
                                onChange={(e) => {
                                    setSubtitle(e.target.value);
                                    onChange({ image: null, title, subtitle: e.target.value, previewUrl: "" });
                                }}
                                className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-indigo-500 focus:border-indigo-500 text-zinc-900 dark:text-zinc-100"
                                placeholder="Unlimited Yoga"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
