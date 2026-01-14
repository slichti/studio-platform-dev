import { Modal } from "./Modal";

interface DialogProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    message: string;
}

interface ConfirmationDialogProps extends DialogProps {
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
}

export function SuccessDialog({ isOpen, onClose, title = "Success", message }: DialogProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <div className="flex flex-col gap-4">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 text-green-600">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    </div>
                    <div className="text-zinc-600 text-sm leading-relaxed pt-1">
                        {message}
                    </div>
                </div>
                <div className="flex justify-end pt-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-lg font-medium text-sm transition-colors"
                    >
                        Dismiss
                    </button>
                </div>
            </div>
        </Modal>
    );
}

export function ErrorDialog({ isOpen, onClose, title = "Error", message }: DialogProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <div className="flex flex-col gap-4">
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 text-red-600">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    </div>
                    <div className="text-zinc-600 text-sm leading-relaxed pt-1">
                        {message}
                    </div>
                </div>
                <div className="flex justify-end pt-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-lg font-medium text-sm transition-colors"
                    >
                        Dismiss
                    </button>
                </div>
            </div>
        </Modal>
    );
}

export function ConfirmationDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    isDestructive = false
}: ConfirmationDialogProps) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <div className="flex flex-col gap-6">
                <p className="text-zinc-600 text-sm leading-relaxed">
                    {message}
                </p>
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-lg font-medium text-sm transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors text-white ${isDestructive
                            ? "bg-red-600 hover:bg-red-700"
                            : "bg-blue-600 hover:bg-blue-700"
                            }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
