
import { cn } from "~/utils/cn";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    className?: string;
}

export function Skeleton({ className, ...props }: SkeletonProps) {
    return (
        <div
            className={cn(
                "animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800",
                className
            )}
            {...props}
        />
    );
}

export function SkeletonLoader({
    type = "list",
    count = 3,
    className
}: {
    type?: "list" | "card" | "text" | "button";
    count?: number;
    className?: string;
}) {
    return (
        <div className={cn("space-y-4", className)}>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i}>
                    {type === "list" && (
                        <div className="flex items-center space-x-4 p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900">
                            <Skeleton className="h-12 w-12 rounded-full" />
                            <div className="space-y-2 flex-1">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-3 w-1/2" />
                            </div>
                        </div>
                    )}
                    {type === "card" && (
                        <div className="p-6 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 shadow-sm">
                            <div className="space-y-3">
                                <Skeleton className="h-5 w-1/3" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-5/6" />
                                <div className="pt-4 flex gap-2">
                                    <Skeleton className="h-8 w-24" />
                                    <Skeleton className="h-8 w-24" />
                                </div>
                            </div>
                        </div>
                    )}
                    {type === "text" && <Skeleton className="h-4 w-full" />}
                    {type === "button" && <Skeleton className="h-10 w-28" />}
                </div>
            ))}
        </div>
    );
}
