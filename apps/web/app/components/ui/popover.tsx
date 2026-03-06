import { Popover as HeadlessPopover, Transition } from '@headlessui/react'
import React, { Fragment } from 'react'
import { cn } from '../../lib/utils'

function Popover({ children }: { children: React.ReactNode }) {
    return (
        <HeadlessPopover className="relative">
            {children}
        </HeadlessPopover>
    )
}

function PopoverTrigger({ children, asChild, ...props }: any) {
    return (
        <HeadlessPopover.Button as={asChild ? React.Fragment : 'button'} {...props}>
            {children}
        </HeadlessPopover.Button>
    )
}

function PopoverContent({ children, className, align = 'center', sideOffset = 4 }: any) {
    return (
        <Transition
            as={Fragment}
            enter="transition ease-out duration-200"
            enterFrom="opacity-0 translate-y-1"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-1"
        >
            <HeadlessPopover.Panel
                className={cn(
                    "absolute z-50 w-screen max-w-[240px] px-4 mt-3 transform -translate-x-1/2 left-1/2 sm:px-0 lg:max-w-3xl",
                    className
                )}
                style={{ marginTop: sideOffset }}
            >
                <div className="overflow-hidden rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 bg-white dark:bg-zinc-950 dark:border dark:border-zinc-800">
                    <div className="relative bg-white dark:bg-zinc-950 p-2">
                        {children}
                    </div>
                </div>
            </HeadlessPopover.Panel>
        </Transition>
    )
}

export { Popover, PopoverTrigger, PopoverContent }
