import { Dialog, Transition } from '@headlessui/react';
import { Fragment, useState, useEffect } from 'react';
import { X, Video, Loader2 } from 'lucide-react';
import { apiRequest } from '../utils/api';
import { useAuth } from '@clerk/react-router'; // Use Clerk hook or pass token

interface ClassDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    classEvent: any | null; // The class object from calendar
    onRecordingAdded: (classId: string, videoId: string) => void;
    canAttachRecording?: boolean;
}

export function ClassDetailModal({ isOpen, onClose, classEvent, onRecordingAdded, canAttachRecording = false }: ClassDetailModalProps) {
    const [recordingUrl, setRecordingUrl] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { getToken } = useAuth();

    // Reset state when opening different class
    useEffect(() => {
        setRecordingUrl('');
        setError(null);
        setIsSubmitting(false);
    }, [classEvent?.id]);

    if (!classEvent) return null;

    // status can be passed in classEvent or we assume 'ready' if streamId exists
    const hasRecording = !!classEvent.resource?.cloudflareStreamId;
    const streamStatus = classEvent.resource?.recordingStatus;

    const handleAddRecording = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            const token = await getToken();
            const res = await apiRequest(`/classes/${classEvent.id}/recording`, token, {
                method: 'POST',
                body: JSON.stringify({ url: recordingUrl })
            }) as any;

            if (res.error) throw new Error(res.error);

            onRecordingAdded(classEvent.id, res.videoId);
            onClose();
        } catch (err: any) {
            setError(err.message || "Failed to add recording");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Transition appear show={isOpen} as={Fragment as any}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment as any}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment as any}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                                            {classEvent.title}
                                        </Dialog.Title>
                                        <p className="text-sm text-gray-500 mt-1">
                                            {new Date(classEvent.start).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                                        </p>
                                    </div>
                                    <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="space-y-6">
                                    {/* Info Section */}
                                    <div className="bg-gray-50 p-3 rounded-md text-sm text-gray-700 space-y-2">
                                        <div className="grid grid-cols-2 gap-2">
                                            <p><strong>Instructor:</strong> {classEvent.resource?.instructor?.user?.profile?.firstName || 'Unknown'}</p>
                                            <p><strong>Duration:</strong> {classEvent.resource?.durationMinutes} min</p>
                                        </div>
                                        {classEvent.resource?.location && <p><strong>Location:</strong> {classEvent.resource.location.name}</p>}

                                        <div className="mt-2 pt-2 border-t border-gray-200">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="font-semibold text-gray-900">Bookings</span>
                                                <a
                                                    href={`/studio/${window.location.pathname.split('/')[2]}/classes/${classEvent.id}/roster`}
                                                    className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                                                >
                                                    View Roster &rarr;
                                                </a>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 text-xs">
                                                <div className="bg-white p-2 rounded border border-gray-200">
                                                    <span className="block text-gray-500">Confirmed</span>
                                                    <span className="block text-lg font-bold text-gray-900">
                                                        {classEvent.resource?.confirmedCount || 0}
                                                        <span className="text-gray-400 font-normal text-xs ml-1">
                                                            / {classEvent.resource?.capacity || '∞'}
                                                        </span>
                                                    </span>
                                                </div>
                                                <div className="bg-white p-2 rounded border border-gray-200">
                                                    <span className="block text-gray-500">Waitlist</span>
                                                    <span className={`block text-lg font-bold ${classEvent.resource?.waitlistCount > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                                                        {classEvent.resource?.waitlistCount || 0}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Recording Section */}
                                    {canAttachRecording && (
                                        <div className="border-t pt-4">
                                            <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                                <Video size={16} />
                                                Class Recording
                                            </h4>

                                            {hasRecording ? (
                                                <div className="space-y-3">
                                                    <div className="bg-green-50 text-green-800 p-3 rounded-md text-sm flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                                        <span>
                                                            Recording attached ({streamStatus || 'processed'})
                                                        </span>
                                                    </div>

                                                    {/* Player */}
                                                    <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
                                                        <iframe
                                                            src={`https://iframe.videodelivery.net/${classEvent.resource.cloudflareStreamId}`}
                                                            className="border-none absolute top-0 left-0 w-full h-full"
                                                            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                                                            allowFullScreen={true}
                                                            title="Class Recording"
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <form onSubmit={handleAddRecording}>
                                                    <div className="mb-3">
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                                            Add External Video URL (e.g. Zoom Cloud Link)
                                                        </label>
                                                        <input
                                                            type="url"
                                                            required
                                                            placeholder="https://zoom.us/rec/..."
                                                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                                                            value={recordingUrl}
                                                            onChange={(e) => setRecordingUrl(e.target.value)}
                                                        />
                                                    </div>
                                                    {error && (
                                                        <p className="text-xs text-red-600 mb-2">{error}</p>
                                                    )}
                                                    <button
                                                        type="submit"
                                                        disabled={isSubmitting}
                                                        className="inline-flex justify-center rounded-md border border-transparent bg-blue-100 px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50"
                                                    >
                                                        {isSubmitting ? (
                                                            <span className="flex items-center gap-2">
                                                                <Loader2 size={16} className="animate-spin" /> Uploading...
                                                            </span>
                                                        ) : "Attach Recording"}
                                                    </button>
                                                </form>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}
