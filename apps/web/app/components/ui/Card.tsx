import React from "react";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden ${className}`}>
            {children}
        </div>
    );
}

export function CardHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`px-6 py-4 border-b border-zinc-100 bg-zinc-50/50 ${className}`}>
            {children}
        </div>
    );
}

export function CardTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <h3 className={`font-semibold text-zinc-900 ${className}`}>
            {children}
        </h3>
    );
}

export function CardContent({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`p-6 ${className}`}>
            {children}
        </div>
    );
}
