import React from "react";

export function Table({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`w-full overflow-auto ${className}`}>
            <table className="w-full text-sm text-left text-zinc-600 dark:text-zinc-300">
                {children}
            </table>
        </div>
    );
}

export function TableHeader({ children }: { children: React.ReactNode }) {
    return (
        <thead className="text-xs text-zinc-500 dark:text-zinc-400 uppercase bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
            {children}
        </thead>
    );
}

export function TableRow({ children, className = "" }: { children: React.ReactNode, className?: string }) {
    return (
        <tr className={`border-b border-zinc-100 dark:border-zinc-800 last:border-0 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors ${className}`}>
            {children}
        </tr>
    );
}

export function TableHead({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <th className={`px-6 py-3 font-medium ${className}`}>
            {children}
        </th>
    );
}

export function TableCell({ children, className = "", ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
    return (
        <td className={`px-6 py-4 ${className}`} {...props}>
            {children}
        </td>
    );
}
