import React from "react";

type BadgeVariant = "default" | "success" | "warning" | "error" | "outline";

interface BadgeProps {
    children: React.ReactNode;
    variant?: BadgeVariant;
    className?: string;
}

export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
    const variants = {
        default: "bg-zinc-900 text-white",
        success: "bg-emerald-100 text-emerald-700 border-emerald-200",
        warning: "bg-amber-100 text-amber-700 border-amber-200",
        error: "bg-red-100 text-red-700 border-red-200",
        outline: "bg-transparent border-zinc-200 text-zinc-600 border",
    };

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variants[variant]} ${className}`}>
            {children}
        </span>
    );
}
