import { Dialog, Transition } from '@headlessui/react';
import { Fragment, useState, useEffect } from 'react';
import { X, User, Users, Check } from 'lucide-react';

import { useFetcher } from 'react-router';
import { Confetti } from './ui/Confetti';

interface BookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    classEvent: any;
    family: any[];
    member?: any;
    onSuccess?: () => void; // Added onSuccess prop
}

export function BookingModal({ isOpen, onClose, classEvent, family, member, onSuccess }: BookingModalProps) {
    const fetcher = useFetcher();
    const [attendanceType, setAttendanceType] = useState<'in_person' | 'zoom'>('in_person');
    const [showSuccess, setShowSuccess] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);

    // Detect successful booking
    useEffect(() => {
        if (fetcher.state === 'idle' && fetcher.data && !showSuccess) {
            if ((fetcher.data as any).success) { // Check for explicit success in response
                setShowSuccess(true);
                setShowConfetti(true);
                if (onSuccess) onSuccess(); // Normalize state updates

                // Auto-close after showing success
                const timer = setTimeout(() => {
                    setShowSuccess(false);
                    onClose();
                }, 2000);

                return () => clearTimeout(timer);
            } else if ((fetcher.data as any).error) {
                // Handle error if needed, usually toast handles it in parent or here
            }
        }
    }, [fetcher.state, fetcher.data, showSuccess, onClose, onSuccess]);

    if (!classEvent) return null;

    const isFull = (!classEvent.zoomEnabled && (classEvent.confirmedCount || 0) >= (classEvent.capacity || Infinity));

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
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
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
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 p-6 text-left align-middle shadow-xl transition-all border border-zinc-200 dark:border-zinc-800 relative">
                                {/* Success Overlay */}
                                {showSuccess && (
                                    <div className="absolute inset-0 bg-green-500/95 dark:bg-green-600/95 flex flex-col items-center justify-center z-10 rounded-2xl">
                                        <div className="bg-white dark:bg-zinc-900 rounded-full p-4 mb-4 animate-bounce">
                                            <Check size={48} className="text-green-500" />
                                        </div>
                                        <h3 className="text-2xl font-bold text-white mb-2">Booked!</h3>
                                        <p className="text-white/90">See you in class! 🎉</p>
                                    </div>
                                )}

                                {/* Confetti */}
                                <Confetti trigger={showConfetti} onComplete={() => setShowConfetti(false)} />

                                <div className="flex justify-between items-start mb-4">
                                    <Dialog.Title as="h3" className="text-lg font-bold leading-6 text-zinc-900 dark:text-zinc-100">
                                        Book {classEvent.title}
                                    </Dialog.Title>
                                    <button onClick={onClose} className="text-zinc-400 hover:text-zinc-500">
                                        <X size={20} />
                                    </button>
                                </div>

                                {/* Class Details */}
                                <div className="mb-6 space-y-3">
                                    {classEvent.description && (
                                        <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3">
                                            {classEvent.description}
                                        </p>
                                    )}

                                    {/* Instructor Info */}
                                    {classEvent.instructor && (
                                        <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg">
                                            {classEvent.instructor.user?.profile?.avatarUrl ? (
                                                <img
                                                    src={classEvent.instructor.user.profile.avatarUrl}
                                                    alt="Instructor"
                                                    className="w-10 h-10 rounded-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                                                    <User size={16} className="text-zinc-500" />
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                                    with {classEvent.instructor.user?.profile?.firstName || 'Instructor'}
                                                </p>
                                                {/* Could add instructor bio here if available in classEvent.instructor.profile */}
                                            </div>
                                        </div>
                                    )}
                                </div>


                                <div className="space-y-4">
                                    {/* Attendance Type Selector */}
                                    {classEvent.zoomEnabled && (
                                        <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg text-sm border border-zinc-200 dark:border-zinc-700">
                                            <p className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Attendance Preference</p>
                                            <div className="flex gap-4">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="attendanceType"
                                                        checked={attendanceType === 'in_person'}
                                                        onChange={() => setAttendanceType('in_person')}
                                                        className="text-blue-600 focus:ring-blue-500"
                                                    />
                                                    <span className="text-zinc-700 dark:text-zinc-300">In-Person</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="attendanceType"
                                                        checked={attendanceType === 'zoom'}
                                                        onChange={() => setAttendanceType('zoom')}
                                                        className="text-blue-600 focus:ring-blue-500"
                                                    />
                                                    <span className="text-zinc-700 dark:text-zinc-300">Virtual (Zoom)</span>
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                    {/* Price / Payment Info */}
                                    <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg text-sm border border-zinc-200 dark:border-zinc-700">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-semibold text-zinc-900 dark:text-zinc-100">Price</span>
                                            <span className="font-bold text-zinc-900 dark:text-zinc-100">
                                                {(() => {
                                                    // 1. Check Included Plans
                                                    if (member?.memberships?.some((m: any) =>
                                                        m.status === 'active' &&
                                                        classEvent.includedPlanIds?.includes(m.planId)
                                                    )) {
                                                        return <span className="text-green-600">Free (Included)</span>;
                                                    }

                                                    // 2. Check Credits
                                                    if (classEvent.allowCredits && member?.purchasedPacks?.some((p: any) => p.remainingCredits > 0)) {
                                                        return <span className="text-blue-600">1 Credit</span>;
                                                    }

                                                    // 3. Member Price
                                                    if (member && classEvent.memberPrice !== undefined && classEvent.memberPrice !== null) {
                                                        return <span>${(classEvent.memberPrice).toFixed(2)} <span className="text-xs font-normal text-zinc-500 line-through">${classEvent.price}</span></span>;
                                                    }

                                                    // 4. Public Price
                                                    return classEvent.price ? `$${classEvent.price.toFixed(2)}` : "Free";
                                                })()}
                                            </span>
                                        </div>
                                        {/* Optional: Show why */}
                                        <div className="text-xs text-zinc-500">
                                            {classEvent.type === 'workshop' ? "Workshop" : "Class"} • {classEvent.durationMinutes} min
                                        </div>
                                    </div>

                                    <div className="text-sm">
                                        {isFull && attendanceType === 'in_person' ? (
                                            <div className="text-amber-600 mb-2 font-medium">Class is full. You will be added to the waitlist.</div>
                                        ) : (
                                            <p className="text-zinc-500 dark:text-zinc-400 mb-2">Who is this booking for?</p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        {/* Myself */}
                                        <fetcher.Form method="post" action={`/studio/${window.location.pathname.split('/')[2]}/classes?index`} onSubmit={() => { }}>
                                            <input type="hidden" name="classId" value={classEvent.id} />
                                            <input type="hidden" name="attendanceType" value={attendanceType} />
                                            <input type="hidden" name="intent" value={isFull && attendanceType === 'in_person' ? 'waitlist' : 'book'} />

                                            <button
                                                type="submit"
                                                disabled={fetcher.state !== 'idle'}
                                                className="w-full text-left px-4 py-3 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex justify-between items-center group transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-full text-blue-600 dark:text-blue-400">
                                                        <User size={16} />
                                                    </div>
                                                    <span className="font-medium text-zinc-900 dark:text-zinc-100">Myself</span>
                                                </div>
                                                <span className="text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100">&rarr;</span>
                                            </button>
                                        </fetcher.Form>

                                        {/* Family Members */}
                                        {family.map((f: any) => (
                                            <fetcher.Form key={f.userId} method="post" action={`/studio/${window.location.pathname.split('/')[2]}/classes?index`} onSubmit={() => { }}>
                                                <input type="hidden" name="classId" value={classEvent.id} />
                                                <input type="hidden" name="memberId" value={f.memberId || ''} />
                                                <input type="hidden" name="attendanceType" value={attendanceType} />
                                                {/* Zoom is always book, family are always waitlisted if full? Or treat same? logic: */}
                                                <input type="hidden" name="intent" value={isFull && attendanceType === 'in_person' ? 'waitlist' : 'book'} />

                                                <button
                                                    type="submit"
                                                    disabled={fetcher.state !== 'idle'}
                                                    className="w-full text-left px-4 py-3 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex justify-between items-center group transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-full text-purple-600 dark:text-purple-400">
                                                            <Users size={16} />
                                                        </div>
                                                        <span className="font-medium text-zinc-900 dark:text-zinc-100">{f.firstName} {f.lastName}</span>
                                                    </div>
                                                    <span className="text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100">&rarr;</span>
                                                </button>
                                            </fetcher.Form>
                                        ))}
                                    </div>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}
