import { useState, useRef, useCallback, useEffect } from 'react';
import React, { Suspense } from 'react';
const Cropper = React.lazy(() => import('react-easy-crop'));
import { getCroppedImg } from '../utils/cropImage';
import { Upload, Wand2, ChevronDown, Trash2, Type } from 'lucide-react';

interface CardCreatorProps {
    initialImage?: string;
    initialTitle?: string;
    initialSubtitle?: string;
    onChange: (data: { image: Blob | null, title: string, subtitle: string, previewUrl: string }) => void;
}

// --- Gradient Presets ---
const GRADIENT_PRESETS = [
    { name: 'Ocean', colors: ['#0f2027', '#2c5364'], direction: 135 },
    { name: 'Sunset', colors: ['#f12711', '#f5af19'], direction: 135 },
    { name: 'Forest', colors: ['#134e5e', '#71b280'], direction: 135 },
    { name: 'Midnight', colors: ['#232526', '#414345'], direction: 180 },
    { name: 'Lavender', colors: ['#667eea', '#764ba2'], direction: 135 },
    { name: 'Rose', colors: ['#ee9ca7', '#ffdde1'], direction: 135 },
    { name: 'Ember', colors: ['#ff416c', '#ff4b2b'], direction: 135 },
    { name: 'Aurora', colors: ['#11998e', '#38ef7d'], direction: 135 },
];

const DIRECTION_OPTIONS = [
    { label: '↘', value: 135 },
    { label: '→', value: 90 },
    { label: '↓', value: 180 },
    { label: '↗', value: 45 },
];

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 450;

const FONT_SIZE_OPTIONS = [
    { label: 'XS', titlePx: 20, subtitlePx: 12 },
    { label: 'S', titlePx: 28, subtitlePx: 14 },
    { label: 'M', titlePx: 36, subtitlePx: 16 },
    { label: 'L', titlePx: 42, subtitlePx: 18 },
    { label: 'XL', titlePx: 52, subtitlePx: 22 },
    { label: '2XL', titlePx: 64, subtitlePx: 26 },
];

// --- Canvas rendering ---
function renderCardToCanvas(
    canvas: HTMLCanvasElement,
    options: {
        bgType: 'solid' | 'gradient';
        color1: string;
        color2: string;
        direction: number;
        title: string;
        subtitle: string;
        titleFontSize: number;
        subtitleFontSize: number;
    }
) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // Background
    if (options.bgType === 'gradient') {
        const rad = (options.direction * Math.PI) / 180;
        const cx = CANVAS_WIDTH / 2;
        const cy = CANVAS_HEIGHT / 2;
        const len = Math.max(CANVAS_WIDTH, CANVAS_HEIGHT);
        const x0 = cx - Math.cos(rad) * len / 2;
        const y0 = cy - Math.sin(rad) * len / 2;
        const x1 = cx + Math.cos(rad) * len / 2;
        const y1 = cy + Math.sin(rad) * len / 2;
        const grad = ctx.createLinearGradient(x0, y0, x1, y1);
        grad.addColorStop(0, options.color1);
        grad.addColorStop(1, options.color2);
        ctx.fillStyle = grad;
    } else {
        ctx.fillStyle = options.color1;
    }
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Subtle noise/pattern overlay for depth
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let i = 0; i < 80; i++) {
        const x = Math.random() * CANVAS_WIDTH;
        const y = Math.random() * CANVAS_HEIGHT;
        const r = Math.random() * 60 + 20;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    // Title
    if (options.title) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Use the user-selected font size, but clamp to fit width
        const maxFontSize = options.titleFontSize;
        const fontSize = Math.min(maxFontSize, CANVAS_WIDTH / (options.title.length * 0.55));
        ctx.font = `bold ${fontSize}px "Inter", "Segoe UI", system-ui, sans-serif`;

        // Text shadow
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4;

        ctx.fillStyle = '#ffffff';
        const titleY = options.subtitle ? CANVAS_HEIGHT / 2 - 20 : CANVAS_HEIGHT / 2;
        ctx.fillText(options.title.toUpperCase(), CANVAS_WIDTH / 2, titleY, CANVAS_WIDTH - 80);
        ctx.restore();
    }

    // Subtitle
    if (options.subtitle) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `400 ${options.subtitleFontSize}px "Inter", "Segoe UI", system-ui, sans-serif`;

        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 2;

        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(options.subtitle, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 24, CANVAS_WIDTH - 80);
        ctx.restore();
    }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => blob ? resolve(blob) : reject(new Error('Canvas export failed')),
            'image/jpeg',
            0.92
        );
    });
}


export function CardCreator({ initialImage, initialTitle, initialSubtitle, onChange }: CardCreatorProps) {
    // --- Shared state ---
    const [title, setTitle] = useState(initialTitle || "");
    const [subtitle, setSubtitle] = useState(initialSubtitle || "");
    const [tab, setTab] = useState<'upload' | 'generate'>(initialImage ? 'upload' : 'generate');

    // --- Font size state ---
    const [fontSizeIndex, setFontSizeIndex] = useState(3); // Default to 'L' (42px title)
    const currentFontSize = FONT_SIZE_OPTIONS[fontSizeIndex];

    // --- Upload state ---
    const [imageSrc, setImageSrc] = useState<string | null>(initialImage || null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
    const [uploadMode, setUploadMode] = useState<'upload' | 'crop' | 'preview'>(initialImage ? 'preview' : 'upload');

    // --- Generate state ---
    const [bgType, setBgType] = useState<'solid' | 'gradient'>('gradient');
    const [color1, setColor1] = useState('#667eea');
    const [color2, setColor2] = useState('#764ba2');
    const [direction, setDirection] = useState(135);
    const [activePreset, setActivePreset] = useState<string | null>('Lavender');

    const previewCanvasRef = useRef<HTMLCanvasElement>(null);
    const exportCanvasRef = useRef<HTMLCanvasElement>(null);

    // --- Repaint canvas preview ---
    useEffect(() => {
        if (tab !== 'generate') return;
        const canvas = previewCanvasRef.current;
        if (!canvas) return;
        renderCardToCanvas(canvas, {
            bgType, color1, color2, direction, title, subtitle,
            titleFontSize: currentFontSize.titlePx,
            subtitleFontSize: currentFontSize.subtitlePx,
        });
    }, [tab, bgType, color1, color2, direction, title, subtitle, fontSizeIndex]);

    // --- Upload handlers ---
    const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const imageDataUrl = await readFile(file);
            setImageSrc(imageDataUrl);
            setUploadMode('crop');
        }
    };

    const handleCropSave = async () => {
        try {
            if (!imageSrc || !croppedAreaPixels) return;
            const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
            const previewUrl = URL.createObjectURL(croppedImageBlob);
            onChange({ image: croppedImageBlob, title, subtitle, previewUrl });
            setUploadMode('preview');
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

    // --- Generate handlers ---
    const handleApplyGenerated = async () => {
        const canvas = exportCanvasRef.current;
        if (!canvas) return;
        renderCardToCanvas(canvas, {
            bgType, color1, color2, direction, title, subtitle,
            titleFontSize: currentFontSize.titlePx,
            subtitleFontSize: currentFontSize.subtitlePx,
        });
        const blob = await canvasToBlob(canvas);
        const previewUrl = URL.createObjectURL(blob);
        onChange({ image: blob, title, subtitle, previewUrl });
        // Switch upload tab to preview to show the result
        setImageSrc(previewUrl);
        setUploadMode('preview');
    };

    const handlePresetClick = (preset: typeof GRADIENT_PRESETS[0]) => {
        setBgType('gradient');
        setColor1(preset.colors[0]);
        setColor2(preset.colors[1]);
        setDirection(preset.direction);
        setActivePreset(preset.name);
    };

    // Notify parent when title/subtitle change (for overlay-only updates when in upload mode)
    const handleTitleChange = (val: string) => {
        setTitle(val);
        if (tab === 'upload') {
            onChange({ image: null, title: val, subtitle, previewUrl: "" });
        }
    };

    const handleSubtitleChange = (val: string) => {
        setSubtitle(val);
        if (tab === 'upload') {
            onChange({ image: null, title, subtitle: val, previewUrl: "" });
        }
    };

    return (
        <div className="card-creator space-y-4">
            {/* Tab switcher */}
            <div className="flex rounded-lg bg-zinc-100 dark:bg-zinc-800 p-1 gap-1">
                <button
                    type="button"
                    onClick={() => setTab('upload')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${tab === 'upload'
                        ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                        }`}
                >
                    <Upload size={15} /> Upload Image
                </button>
                <button
                    type="button"
                    onClick={() => setTab('generate')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${tab === 'generate'
                        ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                        }`}
                >
                    <Wand2 size={15} /> Generate Card
                </button>
            </div>

            {/* ===== UPLOAD TAB ===== */}
            {tab === 'upload' && (
                <>
                    {uploadMode === 'upload' && (
                        <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-8 text-center bg-zinc-50 dark:bg-zinc-800/50 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800">
                            <p className="text-zinc-500 dark:text-zinc-400 mb-2 font-medium">Upload a background image for your membership card.</p>
                            <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">Recommended: 600×450px (4:3 ratio). Max 5 MB.</p>
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

                    {uploadMode === 'crop' && imageSrc && (
                        <div className="relative h-64 w-full bg-zinc-900 rounded-lg overflow-hidden">
                            <Suspense fallback={<div className="h-full w-full flex items-center justify-center text-zinc-500">Loading editor...</div>}>
                                <Cropper
                                    image={imageSrc}
                                    crop={crop}
                                    zoom={zoom}
                                    aspect={4 / 3}
                                    onCropChange={setCrop}
                                    onCropComplete={onCropComplete}
                                    onZoomChange={setZoom}
                                />
                            </Suspense>
                            <div className="absolute bottom-4 right-4 z-10 space-x-2">
                                <button
                                    type="button"
                                    onClick={() => setUploadMode('upload')}
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

                    {uploadMode === 'preview' && (
                        <div className="space-y-4">
                            <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden shadow-md group">
                                {imageSrc && (
                                    <img
                                        src={imageSrc}
                                        className="w-full h-full object-cover"
                                        alt="Card Background"
                                    />
                                )}
                                <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center text-center p-4">
                                    <div className="bg-white/80 dark:bg-black/60 backdrop-blur-sm p-4 rounded-lg max-w-[80%]">
                                        <h3 className="text-xl font-bold text-zinc-900 dark:text-white uppercase tracking-wider">{title || "Membership Title"}</h3>
                                        {subtitle && <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1">{subtitle}</p>}
                                    </div>
                                </div>
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setUploadMode('crop')}
                                        className="bg-white text-zinc-900 px-4 py-2 rounded-full font-medium hover:bg-zinc-100 shadow-lg transform transition-transform hover:scale-105"
                                    >
                                        Edit Image
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setUploadMode('upload');
                                            setImageSrc(null);
                                        }}
                                        className="bg-white text-zinc-900 px-4 py-2 rounded-full font-medium hover:bg-zinc-100 shadow-lg transform transition-transform hover:scale-105"
                                    >
                                        Replace
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setImageSrc(null);
                                            setUploadMode('upload');
                                            onChange({ image: null, title, subtitle, previewUrl: '' });
                                        }}
                                        className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 shadow-lg transform transition-transform hover:scale-105"
                                        title="Remove Image"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ===== GENERATE TAB ===== */}
            {tab === 'generate' && (
                <div className="space-y-4">
                    {/* Text overlay inputs — placed BEFORE the preview so the user types text first */}
                    <div className="grid grid-cols-1 gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
                        <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">
                            <Type size={13} />
                            Text Overlay
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1 text-zinc-500 dark:text-zinc-400">Title</label>
                            <input
                                value={title}
                                onChange={(e) => handleTitleChange(e.target.value)}
                                className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-indigo-500 focus:border-indigo-500 text-zinc-900 dark:text-zinc-100 text-sm"
                                placeholder="3 MONTH MEMBERSHIP"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium mb-1 text-zinc-500 dark:text-zinc-400">Subtitle (Optional)</label>
                            <input
                                value={subtitle}
                                onChange={(e) => handleSubtitleChange(e.target.value)}
                                className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-indigo-500 focus:border-indigo-500 text-zinc-900 dark:text-zinc-100 text-sm"
                                placeholder="Unlimited Yoga"
                            />
                        </div>
                        {/* Font size selector */}
                        <div>
                            <label className="block text-xs font-medium mb-1.5 text-zinc-500 dark:text-zinc-400">Font Size</label>
                            <div className="flex rounded-md bg-zinc-100 dark:bg-zinc-800 p-0.5 gap-0.5">
                                {FONT_SIZE_OPTIONS.map((opt, idx) => (
                                    <button
                                        key={opt.label}
                                        type="button"
                                        onClick={() => setFontSizeIndex(idx)}
                                        className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all ${fontSizeIndex === idx
                                            ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                                            : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                                            }`}
                                        title={`Title: ${opt.titlePx}px, Subtitle: ${opt.subtitlePx}px`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Presets */}
                    <div>
                        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase mb-2">Presets</label>
                        <div className="grid grid-cols-4 gap-2">
                            {GRADIENT_PRESETS.map((preset) => (
                                <button
                                    key={preset.name}
                                    type="button"
                                    onClick={() => handlePresetClick(preset)}
                                    className={`group relative h-10 rounded-md overflow-hidden border-2 transition-all ${activePreset === preset.name ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'
                                        }`}
                                    style={{
                                        background: `linear-gradient(${preset.direction}deg, ${preset.colors[0]}, ${preset.colors[1]})`
                                    }}
                                    title={preset.name}
                                >
                                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white/90 opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                                        {preset.name}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Background type */}
                    <div className="flex gap-4 items-center">
                        <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase shrink-0">Background</label>
                        <div className="flex rounded-md bg-zinc-100 dark:bg-zinc-800 p-0.5 gap-0.5">
                            <button
                                type="button"
                                onClick={() => { setBgType('gradient'); setActivePreset(null); }}
                                className={`px-3 py-1 rounded text-xs font-medium transition-all ${bgType === 'gradient' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500'}`}
                            >
                                Gradient
                            </button>
                            <button
                                type="button"
                                onClick={() => { setBgType('solid'); setActivePreset(null); }}
                                className={`px-3 py-1 rounded text-xs font-medium transition-all ${bgType === 'solid' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500'}`}
                            >
                                Solid
                            </button>
                        </div>
                    </div>

                    {/* Color pickers */}
                    <div className="flex gap-3 items-end">
                        <div className="flex-1">
                            <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">{bgType === 'gradient' ? 'Start Color' : 'Color'}</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={color1}
                                    onChange={(e) => { setColor1(e.target.value); setActivePreset(null); }}
                                    className="w-10 h-10 rounded-md border border-zinc-300 dark:border-zinc-600 cursor-pointer p-0.5"
                                />
                                <input
                                    type="text"
                                    value={color1}
                                    onChange={(e) => { setColor1(e.target.value); setActivePreset(null); }}
                                    className="flex-1 px-2 py-1.5 text-xs font-mono rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                                />
                            </div>
                        </div>
                        {bgType === 'gradient' && (
                            <>
                                <div className="flex-1">
                                    <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">End Color</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={color2}
                                            onChange={(e) => { setColor2(e.target.value); setActivePreset(null); }}
                                            className="w-10 h-10 rounded-md border border-zinc-300 dark:border-zinc-600 cursor-pointer p-0.5"
                                        />
                                        <input
                                            type="text"
                                            value={color2}
                                            onChange={(e) => { setColor2(e.target.value); setActivePreset(null); }}
                                            className="flex-1 px-2 py-1.5 text-xs font-mono rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-zinc-500 dark:text-zinc-400 mb-1">Direction</label>
                                    <div className="flex gap-1">
                                        {DIRECTION_OPTIONS.map((opt) => (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => { setDirection(opt.value); setActivePreset(null); }}
                                                className={`w-8 h-10 rounded text-sm font-medium transition-all ${direction === opt.value
                                                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                                    }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Live preview canvas */}
                    <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden shadow-md border border-zinc-200 dark:border-zinc-700">
                        <canvas
                            ref={previewCanvasRef}
                            className="w-full h-full"
                            style={{ imageRendering: 'auto' }}
                        />
                    </div>

                    {/* Apply button */}
                    <button
                        type="button"
                        onClick={handleApplyGenerated}
                        className="w-full bg-indigo-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                        <Wand2 size={16} />
                        Apply Generated Card
                    </button>
                </div>
            )}

            {/* Hidden export canvas (full resolution) */}
            <canvas ref={exportCanvasRef} className="hidden" width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />

            {/* Text overlay inputs (shared — only for upload tab since generate tab has its own above) */}
            {tab === 'upload' && (
                <div className="grid grid-cols-1 gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <div>
                        <label className="block text-xs font-medium mb-1 text-zinc-500 dark:text-zinc-400">Overlay Title</label>
                        <input
                            value={title}
                            onChange={(e) => handleTitleChange(e.target.value)}
                            className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-indigo-500 focus:border-indigo-500 text-zinc-900 dark:text-zinc-100"
                            placeholder="3 MONTH MEMBERSHIP"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1 text-zinc-500 dark:text-zinc-400">Overlay Subtitle (Optional)</label>
                        <input
                            value={subtitle}
                            onChange={(e) => handleSubtitleChange(e.target.value)}
                            className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-indigo-500 focus:border-indigo-500 text-zinc-900 dark:text-zinc-100"
                            placeholder="Unlimited Yoga"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
