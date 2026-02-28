import { useState, useCallback } from 'react';
import { CardCreator } from './CardCreator';
import { Plus, Trash2, Star, Calendar, Image as ImageIcon, X } from 'lucide-react';
import { useAuth } from '@clerk/react-router';

export interface ImageLibraryEntry {
    id: string;
    url: string;
    label: string;
    isActive: boolean;
    activeFrom?: string;
    activeUntil?: string;
}

interface ImageLibraryProps {
    images: ImageLibraryEntry[];
    onImagesChange: (images: ImageLibraryEntry[]) => void;
    /** The current active image URL (for display) */
    activeImageUrl?: string;
    /** Called when the active image changes (url or null) */
    onActiveImageChange: (url: string | null) => void;
    tenantSlug: string;
}

export function ImageLibrary({ images, onImagesChange, activeImageUrl, onActiveImageChange, tenantSlug }: ImageLibraryProps) {
    const { getToken } = useAuth();
    const [showCreator, setShowCreator] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<string | null>(null);

    const handleAddImage = useCallback(async (data: { image: Blob | null; title: string; subtitle: string; previewUrl: string }) => {
        if (!data.image) return;

        setUploading(true);
        try {
            const token = await getToken();
            const formData = new FormData();
            const file = new File([data.image], 'card.jpg', { type: 'image/jpeg' });
            formData.append('file', file);

            const apiUrl = import.meta.env.VITE_API_URL || 'https://studio-platform-api.slichti.workers.dev';
            const res = await fetch(`${apiUrl}/uploads/r2-image`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'X-Tenant-Slug': tenantSlug,
                },
                body: formData,
            });

            if (res.ok) {
                const uploadData = await res.json() as { url: string };
                const newEntry: ImageLibraryEntry = {
                    id: crypto.randomUUID(),
                    url: uploadData.url,
                    label: data.title || `Image ${images.length + 1}`,
                    isActive: images.length === 0, // First image is active by default
                };

                const updated = [...images, newEntry];
                onImagesChange(updated);

                if (newEntry.isActive) {
                    onActiveImageChange(newEntry.url);
                }

                setShowCreator(false);
            }
        } catch (e) {
            console.error('Failed to upload image', e);
        } finally {
            setUploading(false);
        }
    }, [images, getToken, tenantSlug, onImagesChange, onActiveImageChange]);

    const handleSetActive = (id: string) => {
        const updated = images.map(img => ({
            ...img,
            isActive: img.id === id,
        }));
        onImagesChange(updated);
        const active = updated.find(img => img.isActive);
        onActiveImageChange(active?.url || null);
    };

    const handleRemove = (id: string) => {
        const removed = images.find(img => img.id === id);
        const updated = images.filter(img => img.id !== id);

        // If we removed the active image, activate the first remaining one
        if (removed?.isActive && updated.length > 0) {
            updated[0].isActive = true;
            onActiveImageChange(updated[0].url);
        } else if (updated.length === 0) {
            onActiveImageChange(null);
        }

        onImagesChange(updated);
    };

    const handleUpdateSchedule = (id: string, field: 'activeFrom' | 'activeUntil', value: string) => {
        const updated = images.map(img =>
            img.id === id ? { ...img, [field]: value || undefined } : img
        );
        onImagesChange(updated);
    };

    const handleLabelChange = (id: string, label: string) => {
        const updated = images.map(img =>
            img.id === id ? { ...img, label } : img
        );
        onImagesChange(updated);
    };

    // Determine the currently effective image based on scheduling
    const getEffectiveImage = (): ImageLibraryEntry | undefined => {
        const now = new Date();
        // First, check for scheduled images
        const scheduled = images.find(img => {
            if (!img.activeFrom && !img.activeUntil) return false;
            const from = img.activeFrom ? new Date(img.activeFrom) : new Date(0);
            const until = img.activeUntil ? new Date(img.activeUntil) : new Date('2099-12-31');
            return now >= from && now <= until;
        });
        if (scheduled) return scheduled;
        // Fallback to manually-set active image
        return images.find(img => img.isActive);
    };

    return (
        <div className="space-y-4">
            {/* Image Gallery */}
            {images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {images.map((img) => (
                        <div
                            key={img.id}
                            className={`relative group rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${img.isActive
                                ? 'border-indigo-500 ring-2 ring-indigo-500/30'
                                : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'
                                }`}
                            onClick={() => handleSetActive(img.id)}
                        >
                            <div className="aspect-[4/3]">
                                <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                            </div>

                            {/* Active badge */}
                            {img.isActive && (
                                <div className="absolute top-1.5 left-1.5 bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                    <Star className="w-2.5 h-2.5 fill-current" /> Active
                                </div>
                            )}

                            {/* Schedule badge */}
                            {(img.activeFrom || img.activeUntil) && (
                                <div className="absolute top-1.5 right-1.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                    <Calendar className="w-2.5 h-2.5" /> Scheduled
                                </div>
                            )}

                            {/* Label */}
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                                <p className="text-white text-xs font-medium truncate">{img.label}</p>
                            </div>

                            {/* Hover actions */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setEditingSchedule(editingSchedule === img.id ? null : img.id); }}
                                    className="bg-white text-zinc-900 p-1.5 rounded-full hover:bg-zinc-100 shadow-lg"
                                    title="Schedule"
                                >
                                    <Calendar className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleRemove(img.id); }}
                                    className="bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 shadow-lg"
                                    title="Remove"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Schedule editor for selected image */}
            {editingSchedule && (() => {
                const img = images.find(i => i.id === editingSchedule);
                if (!img) return null;
                return (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                                <Calendar className="w-4 h-4" /> Schedule: {img.label}
                            </h4>
                            <button type="button" onClick={() => setEditingSchedule(null)} className="text-amber-600 hover:text-amber-800">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={img.label}
                                onChange={(e) => handleLabelChange(img.id, e.target.value)}
                                className="flex-1 px-2 py-1.5 text-sm border border-amber-300 dark:border-amber-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                placeholder="Image label (e.g. Holiday 2025)"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">Active From</label>
                                <input
                                    type="date"
                                    value={img.activeFrom ? img.activeFrom.split('T')[0] : ''}
                                    onChange={(e) => handleUpdateSchedule(img.id, 'activeFrom', e.target.value ? new Date(e.target.value).toISOString() : '')}
                                    className="w-full px-2 py-1.5 text-sm border border-amber-300 dark:border-amber-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">Active Until</label>
                                <input
                                    type="date"
                                    value={img.activeUntil ? img.activeUntil.split('T')[0] : ''}
                                    onChange={(e) => handleUpdateSchedule(img.id, 'activeUntil', e.target.value ? new Date(e.target.value).toISOString() : '')}
                                    className="w-full px-2 py-1.5 text-sm border border-amber-300 dark:border-amber-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                />
                            </div>
                        </div>
                        <p className="text-[10px] text-amber-700 dark:text-amber-400">
                            When a scheduled date range is active, this image will override the manually selected active image.
                        </p>
                    </div>
                );
            })()}

            {/* Add image button / CardCreator */}
            {showCreator ? (
                <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Add New Image</h4>
                        <button type="button" onClick={() => setShowCreator(false)} className="text-zinc-400 hover:text-zinc-600">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <CardCreator onChange={handleAddImage} />
                    {uploading && (
                        <div className="flex items-center gap-2 text-sm text-indigo-600">
                            <div className="h-4 w-4 animate-spin rounded-full border-t-2 border-indigo-600 border-r-2" />
                            Uploading...
                        </div>
                    )}
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setShowCreator(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-500 dark:text-zinc-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors text-sm font-medium"
                >
                    <Plus className="w-4 h-4" />
                    {images.length === 0 ? 'Add Cover Image' : 'Add Another Image'}
                </button>
            )}

            {images.length > 1 && (
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    Click an image to set it as active. Use the calendar icon to schedule seasonal rotation.
                </p>
            )}
        </div>
    );
}
