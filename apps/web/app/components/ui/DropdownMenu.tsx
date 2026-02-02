import { Menu, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { cn } from "../../lib/utils"

export function DropdownMenu({ children }: { children: React.ReactNode }) {
    return (
        <Menu as="div" className="relative inline-block text-left">
            {children}
        </Menu>
    )
}

export function DropdownMenuTrigger({ children, className, ...props }: { children: React.ReactNode; className?: string } & any) {
    return (
        <Menu.Button className={cn("inline-flex justify-center", className)} {...props}>
            {children}
        </Menu.Button>
    )
}

export function DropdownMenuContent({ children, className, align = 'end' }: { children: React.ReactNode; className?: string; align?: 'start' | 'end' }) {
    return (
        <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
        >
            <Menu.Items className={cn(
                "absolute z-50 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-zinc-950 dark:ring-zinc-800",
                align === 'end' ? 'right-0' : 'left-0',
                className
            )}>
                <div className="py-1">
                    {children}
                </div>
            </Menu.Items>
        </Transition>
    )
}

export function DropdownMenuItem({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
    return (
        <Menu.Item>
            {({ active }) => (
                <button
                    onClick={onClick}
                    className={cn(
                        "flex w-full items-center px-4 py-2 text-sm",
                        active ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100" : "text-zinc-700 dark:text-zinc-300",
                        className
                    )}
                >
                    {children}
                </button>
            )}
        </Menu.Item>
    )
}

export function DropdownMenuLabel({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn("px-4 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider dark:text-zinc-400", className)}>
            {children}
        </div>
    )
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
    return <div className={cn("my-1 h-px bg-zinc-100 dark:bg-zinc-800", className)} />
}
