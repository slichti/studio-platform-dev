
import { Link } from "react-router";

interface PoweredByProps {
    tier: string;
    branding?: {
        hidePoweredBy?: boolean;
        primaryColor?: string;
        [key: string]: any;
    };
    className?: string;
}

export function PoweredBy({ tier, branding, className = "" }: PoweredByProps) {
    // Show by default
    let show = true;

    // If Scale tier, respect the setting
    if (tier === 'scale' && branding?.hidePoweredBy) {
        show = false;
    }

    if (!show) return null;

    return (
        <div className={`py-4 text-center ${className}`}>
            <Link
                to="https://studioplatform.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
            >
                <span className="font-semibold">Powered by</span>
                <span className="font-bold tracking-tight text-zinc-500 dark:text-zinc-500">StudioPlatform</span>
            </Link>
        </div>
    );
}
