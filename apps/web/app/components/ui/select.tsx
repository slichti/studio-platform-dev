import * as React from "react"
import { ChevronDown } from "lucide-react"

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> { }

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
    ({ className = "", children, ...props }, ref) => {
        return (
            <div className={`relative ${className}`}>
                <select
                    className="appearance-none flex h-10 w-full items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400 dark:focus:ring-zinc-300"
                    ref={ref}
                    {...props}
                >
                    {children}
                </select>
                <ChevronDown className="absolute right-3 top-3 h-4 w-4 opacity-50 pointer-events-none" />
            </div>
        )
    }
)
Select.displayName = "Select"

export { Select }
