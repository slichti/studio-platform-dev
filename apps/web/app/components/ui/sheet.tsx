import { Dialog as HeadlessDialog, Transition, TransitionChild, DialogPanel, DialogTitle as HeadlessDialogTitle } from '@headlessui/react'
import { Fragment, useState, createContext, useContext } from 'react'
import { X } from 'lucide-react'

const SheetContext = createContext<any>(null);

interface SheetProps {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    side?: "left" | "right"; // Default left
}

export function Sheet({ children, open: controlledOpen, onOpenChange: setControlledOpen, side = "left" }: SheetProps) {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(false);

    const isControlled = controlledOpen !== undefined;
    const isOpen = isControlled ? controlledOpen : uncontrolledOpen;
    const setIsOpen = isControlled ? setControlledOpen : setUncontrolledOpen;

    return (
        <SheetContext.Provider value={{ isOpen, setIsOpen, side }}>
            {children}
        </SheetContext.Provider>
    )
}

export function SheetTrigger({ asChild, children }: any) {
    const { setIsOpen } = useContext(SheetContext);
    return (
        <div onClick={() => setIsOpen(true)} className="inline-block cursor-pointer">
            {children}
        </div>
    )
}

export function SheetContent({ children, className = "" }: any) {
    const { isOpen, setIsOpen, side } = useContext(SheetContext);

    // Animation Classes based on side
    const enterFrom = side === "left" ? "-translate-x-full" : "translate-x-full";
    const enterTo = "translate-x-0";
    const leaveFrom = "translate-x-0";
    const leaveTo = side === "left" ? "-translate-x-full" : "translate-x-full";

    const positionClasses = side === "left" ? "left-0" : "right-0";
    const borderClasses = side === "left" ? "border-r" : "border-l";

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <HeadlessDialog as="div" className="relative z-50" onClose={() => setIsOpen(false)}>
                <TransitionChild
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/80" />
                </TransitionChild>

                <div className="fixed inset-0 overflow-hidden">
                    <div className="absolute inset-0 overflow-hidden">
                        <div className={`pointer-events-none fixed inset-y-0 ${positionClasses} flex max-w-full`}>
                            <TransitionChild
                                as={Fragment}
                                enter="transform transition ease-in-out duration-300 sm:duration-300"
                                enterFrom={enterFrom}
                                enterTo={enterTo}
                                leave="transform transition ease-in-out duration-300 sm:duration-300"
                                leaveFrom={leaveFrom}
                                leaveTo={leaveTo}
                            >
                                <DialogPanel className={`pointer-events-auto w-screen max-w-md ${className}`}>
                                    <div className={`flex h-full flex-col overflow-y-auto bg-white dark:bg-zinc-950 shadow-xl border-zinc-200 dark:border-zinc-800 ${borderClasses}`}>
                                        <div className="px-4 sm:px-6 py-6 flex-1 relative">
                                            <button
                                                type="button"
                                                className="absolute right-4 top-4 rounded-md text-zinc-400 hover:text-zinc-500 focus:outline-none"
                                                onClick={() => setIsOpen(false)}
                                            >
                                                <span className="sr-only">Close panel</span>
                                                <X className="h-6 w-6" aria-hidden="true" />
                                            </button>
                                            {children}
                                        </div>
                                    </div>
                                </DialogPanel>
                            </TransitionChild>
                        </div>
                    </div>
                </div>
            </HeadlessDialog>
        </Transition>
    )
}

export function SheetHeader({ children, className }: any) {
    return <div className={`flex flex-col space-y-2 text-center sm:text-left ${className}`}>{children}</div>
}

export function SheetTitle({ children, className }: any) {
    return <HeadlessDialogTitle as="h3" className={`text-lg font-semibold text-zinc-900 dark:text-zinc-50 ${className}`}>{children}</HeadlessDialogTitle>
}
