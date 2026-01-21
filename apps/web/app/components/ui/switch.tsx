import { Switch as HeadlessSwitch } from '@headlessui/react'
import * as React from "react"

export interface SwitchProps {
    checked: boolean
    onCheckedChange: (checked: boolean) => void
    disabled?: boolean
    className?: string
}

export function Switch({ checked, onCheckedChange, disabled, className = "" }: SwitchProps) {
    return (
        <HeadlessSwitch
            checked={checked}
            onChange={onCheckedChange}
            disabled={disabled}
            className={`${checked ? 'bg-zinc-900 dark:bg-zinc-50' : 'bg-zinc-200 dark:bg-zinc-800'
                } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-zinc-300 dark:focus-visible:ring-offset-zinc-950 ${className}`}
        >
            <span
                className={`${checked ? 'translate-x-6' : 'translate-x-1'
                    } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
            />
        </HeadlessSwitch>
    )
}
