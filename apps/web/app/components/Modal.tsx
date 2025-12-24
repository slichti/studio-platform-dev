import { useEffect } from "react";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    maxWidth?: string;
}

export function Modal({ isOpen, onClose, title, children, maxWidth = "max-w-md" }: ModalProps) {
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };

        if (isOpen) {
            document.addEventListener("keydown", handleEscape);
            document.body.style.overflow = "hidden";
        }

        return () => {
            document.removeEventListener("keydown", handleEscape);
            document.body.style.overflow = "unset";
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            ></div>

            {/* Content */}
            <div
                className={`relative rounded-xl shadow-2xl w-full ${maxWidth} overflow-hidden animate-in zoom-in-95 duration-200`}
                style={{ background: 'var(--card-bg)', border: '1px solid var(--border)' }}
                role="dialog"
                aria-modal="true"
            >
                {title && (
                    <div className="px-6 py-4 flex items-center justify-between" style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                        <h3 className="font-semibold text-lg" style={{ color: 'var(--text)' }}>{title}</h3>
                        <button
                            onClick={onClose}
                            className="p-1 rounded-md transition-colors hover:opacity-70"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                )}
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    );
}
