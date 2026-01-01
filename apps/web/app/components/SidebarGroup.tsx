import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router";

interface SidebarGroupProps {
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

export function SidebarGroup({ title, children, defaultOpen = true }: SidebarGroupProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="mb-2">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
            >
                {title}
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {isOpen && (
                <div className="mt-1 space-y-0.5">
                    {children}
                </div>
            )}
        </div>
    );
}

// Re-export NavItem here if we want to share it, or keep it in the main file
// keeping it separate for now as requested by the plan structure, but I will likely use the existing NavItem in studio.$slug.tsx
