import React from "react";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden ${className}`}>
            {children}
        </div>
    );
}

export function CardHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 ${className}`}>
            {children}
        </div>
    );
}

export function CardTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <h3 className={`font-semibold text-zinc-900 dark:text-zinc-100 ${className}`}>
            {children}
        </h3>
    );
}

export function CardDescription({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <p className={`text-sm text-zinc-500 dark:text-zinc-400 ${className}`}>
            {children}
        </p>
    );
}

export function CardContent({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`p-6 ${className}`}>
            {children}
        </div>
    );
}

export function CardFooter({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 ${className}`}>
            {children}
        </div>
    );
}
