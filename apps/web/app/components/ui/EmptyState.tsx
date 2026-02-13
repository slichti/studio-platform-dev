import { cn } from '~/lib/utils';
import { Link } from 'react-router';

interface EmptyStateProps {
    icon?: string;
    title: string;
    description: string;
    action?: {
        label: string;
        href?: string;
        onClick?: () => void;
    };
    className?: string;
}

export function EmptyState({
    icon = '📭',
    title,
    description,
    action,
    className,
}: EmptyStateProps) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center p-12 text-center',
                'bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700',
                className
            )}
        >
            <div className="text-6xl mb-4" role="img" aria-hidden="true">
                {icon}
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {title}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mb-6">
                {description}
            </p>
            {action && (
                <>
                    {action.href ? (
                        <Link
                            to={action.href}
                            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                        >
                            {action.label}
                        </Link>
                    ) : (
                        <button
                            onClick={action.onClick}
                            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                        >
                            {action.label}
                        </button>
                    )}
                </>
            )}
        </div>
    );
}

// Preset empty states for common scenarios
export function NoBookingsEmptyState({ onBrowseClasses }: { onBrowseClasses?: () => void }) {
    return (
        <EmptyState
            icon="📅"
            title="No Bookings Yet"
            description="You haven't booked any classes yet. Browse our schedule to find the perfect class for you!"
            action={{
                label: 'Browse Classes',
                onClick: onBrowseClasses,
                href: onBrowseClasses ? undefined : '../classes',
            }}
        />
    );
}

export function NoCreditsEmptyState({ onBuyPack }: { onBuyPack?: () => void }) {
    return (
        <EmptyState
            icon="💳"
            title="No Class Credits"
            description="You're out of class credits. Purchase a class pack to start booking!"
            action={{
                label: 'Buy Class Pack',
                onClick: onBuyPack,
            }}
        />
    );
}

export function NoClassesAvailableEmptyState() {
    return (
        <EmptyState
            icon="🗓️"
            title="No Classes Available"
            description="There are no classes scheduled for this time period. Check back soon or try a different date range."
        />
    );
}
