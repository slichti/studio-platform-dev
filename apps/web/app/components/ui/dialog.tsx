import { Dialog as HeadlessDialog, Transition, TransitionChild, DialogPanel, DialogTitle as HeadlessDialogTitle } from '@headlessui/react'
import { Fragment, useState, createContext, useContext } from 'react'
import { X } from 'lucide-react'

// Adapting to: <Dialog> <DialogTrigger> <DialogContent> ...
const DialogContext = createContext<any>(null);

interface DialogProps {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

function Dialog({ children, open: controlledOpen, onOpenChange: setControlledOpen }: DialogProps) {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(false);

    // Use controlled state if provided, otherwise internal state
    const isControlled = controlledOpen !== undefined;
    const isOpen = isControlled ? controlledOpen : uncontrolledOpen;
    const setIsOpen = isControlled ? setControlledOpen : setUncontrolledOpen;

    return (
        <DialogContext.Provider value={{ isOpen, setIsOpen }}>
            {children}
        </DialogContext.Provider>
    )
}

function DialogTrigger({ asChild, children, onClick }: any) {
    const { setIsOpen } = useContext(DialogContext);
    // if asChild is true, we clone the child and add onClick? 
    // Simplified: Just wrap in a span or clone if single child.
    // For now, let's just use a div or span if not specific.
    // But in payroll.tsx: <DialogTrigger asChild><button...

    // We'll simplisticly assume it's a clickable child we need to attach handler to.
    return (
        <div onClick={() => setIsOpen(true)} className="inline-block cursor-pointer">
            {children}
        </div>
    )
}

function DialogContent({ children, className }: any) {
    const { isOpen, setIsOpen } = useContext(DialogContext);

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

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <TransitionChild
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <DialogPanel className={`w-full max-w-lg transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-xl transition-all dark:bg-zinc-950 dark:border dark:border-zinc-800 ${className}`}>
                                {children}
                                <button
                                    className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 focus:outline-none"
                                    onClick={() => setIsOpen(false)}
                                >
                                    <X className="h-4 w-4 text-zinc-500" />
                                </button>
                            </DialogPanel>
                        </TransitionChild>
                    </div>
                </div>
            </HeadlessDialog>
        </Transition>
    )
}

function DialogHeader({ children, className }: any) {
    return <div className={`flex flex-col space-y-1.5 text-center sm:text-left ${className}`}>{children}</div>
}

function DialogTitle({ children, className }: any) {
    return <HeadlessDialogTitle as="h3" className={`text-lg font-semibold leading-none tracking-tight ${className}`}>{children}</HeadlessDialogTitle>
}

function DialogDescription({ children, className }: any) {
    return <p className={`text-sm text-zinc-500 dark:text-zinc-400 ${className}`}>{children}</p>
}

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription }

function DialogFooter({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 ${className}`}
            {...props}
        />
    )
}
