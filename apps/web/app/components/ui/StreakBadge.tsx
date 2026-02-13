import { cn } from '~/lib/utils';

interface StreakBadgeProps {
    streak: number;
    className?: string;
    showLabel?: boolean;
}

export function StreakBadge({ streak, className, showLabel = true }: StreakBadgeProps) {
    const getMilestoneEmoji = (count: number) => {
        if (count >= 100) return '🏆';
        if (count >= 50) return '💎';
        if (count >= 25) return '⭐';
        if (count >= 10) return '🔥';
        if (count >= 5) return '✨';
        return '🌟';
    };

    const getMilestoneColor = (count: number) => {
        if (count >= 100) return 'from-yellow-400 to-orange-500';
        if (count >= 50) return 'from-purple-400 to-pink-500';
        if (count >= 25) return 'from-blue-400 to-cyan-500';
        if (count >= 10) return 'from-orange-400 to-red-500';
        if (count >= 5) return 'from-green-400 to-emerald-500';
        return 'from-gray-400 to-gray-500';
    };

    if (streak === 0) return null;

    return (
        <div
            className={cn(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-full',
                'bg-gradient-to-r',
                getMilestoneColor(streak),
                'text-white font-semibold shadow-lg',
                'animate-pulse-subtle',
                className
            )}
        >
            <span className="text-lg" role="img" aria-label="streak">
                {getMilestoneEmoji(streak)}
            </span>
            <span className="text-sm">
                {streak} {showLabel && 'day streak'}
            </span>
        </div>
    );
}

interface MilestoneBadgeProps {
    milestone: number;
    label: string;
    achieved?: boolean;
    className?: string;
}

export function MilestoneBadge({
    milestone,
    label,
    achieved = false,
    className,
}: MilestoneBadgeProps) {
    return (
        <div
            className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-lg border-2',
                achieved
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-300 bg-gray-50 dark:bg-gray-800 opacity-60',
                'transition-all duration-300',
                achieved && 'scale-105',
                className
            )}
        >
            <div
                className={cn(
                    'text-3xl',
                    achieved ? 'grayscale-0' : 'grayscale'
                )}
            >
                {milestone >= 100 ? '🏆' : milestone >= 50 ? '💎' : milestone >= 25 ? '⭐' : '🔥'}
            </div>
            <div className="text-center">
                <div className="font-bold text-lg">{milestone}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">{label}</div>
            </div>
            {achieved && (
                <div className="text-xs font-semibold text-green-600 dark:text-green-400">
                    Unlocked! 🎉
                </div>
            )}
        </div>
    );
}
