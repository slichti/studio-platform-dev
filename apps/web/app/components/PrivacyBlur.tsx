import { ReactNode } from "react";

interface PrivacyBlurProps {
    revealed: boolean;
    children: ReactNode;
    blurAmount?: string;
    className?: string;
    placeholder?: string;
}

export function PrivacyBlur({ revealed, children, blurAmount = "blur-sm", className = "", placeholder }: PrivacyBlurProps) {
    if (revealed) {
        return <>{children}</>;
    }

    return (
        <span className={`relative inline-block select-none ${className}`} title="Hidden for privacy">
            <span className={`filter ${blurAmount} opacity-50`}>
                {children}
            </span>
            {placeholder && (
                <span className="absolute inset-0 flex items-center justify-center text-xs font-mono text-zinc-500 font-bold bg-white/50 dark:bg-black/50 backdrop-blur-md rounded">
                    {placeholder}
                </span>
            )}
        </span>
    );
}
