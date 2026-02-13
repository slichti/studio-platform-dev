import { useEffect, useRef } from 'react';

interface ProgressRingProps {
    progress: number; // 0-100
    size?: number;
    strokeWidth?: number;
    color?: string;
    backgroundColor?: string;
    showPercentage?: boolean;
    label?: string;
    animate?: boolean;
}

export function ProgressRing({
    progress,
    size = 120,
    strokeWidth = 8,
    color = 'rgb(59, 130, 246)', // blue-500
    backgroundColor = 'rgb(229, 231, 235)', // gray-200
    showPercentage = true,
    label,
    animate = true,
}: ProgressRingProps) {
    const normalizedProgress = Math.min(Math.max(progress, 0), 100);
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (normalizedProgress / 100) * circumference;

    const circleRef = useRef<SVGCircleElement>(null);

    useEffect(() => {
        if (animate && circleRef.current) {
            // Trigger animation by setting initial offset then animating to target
            circleRef.current.style.strokeDashoffset = `${circumference}`;
            setTimeout(() => {
                if (circleRef.current) {
                    circleRef.current.style.strokeDashoffset = `${offset}`;
                }
            }, 100);
        }
    }, [animate, circumference, offset]);

    return (
        <div className="relative inline-flex items-center justify-center">
            <svg width={size} height={size} className="transform -rotate-90">
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={backgroundColor}
                    strokeWidth={strokeWidth}
                    fill="none"
                />
                {/* Progress circle */}
                <circle
                    ref={circleRef}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={animate ? circumference : offset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                {showPercentage && (
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                        {Math.round(normalizedProgress)}%
                    </span>
                )}
                {label && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {label}
                    </span>
                )}
            </div>
        </div>
    );
}
