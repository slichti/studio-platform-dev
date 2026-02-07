import { Outlet, useOutletContext, Link, useLocation } from "react-router";
import { useState, useEffect } from "react";
import { DateRange } from "~/hooks/useAnalytics";
import { useAdminPrivacy } from "~/hooks/useAdminPrivacy";

export default function AnalyticsLayout() {
    const { tenant } = useOutletContext<any>();
    const [dateRange, setDateRange] = useState<DateRange>('30d');
    const location = useLocation();

    // Privacy Logic (lifted from reports)
    const [impersonating, setImpersonating] = useState(false);
    useEffect(() => {
        setImpersonating(!!localStorage.getItem('impersonation_token'));
    }, []);
    const { isPrivacyMode } = useAdminPrivacy();
    const shouldBlur = impersonating && isPrivacyMode;

    // Tabs for navigation
    const tabs = [
        { name: 'Financials', path: 'financials' },
        { name: 'Attendance', path: 'attendance' },
        { name: 'Projections', path: 'projections' },
        { name: 'Reports', path: 'reports' },
    ];

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Analytics</h1>
                    <p className="text-zinc-500 dark:text-zinc-400">Performance metrics and insights.</p>
                </div>
                <div className="flex gap-4 items-center">
                    {/* Date Range Picker - Global for all analytics */}
                    <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                        {(['30d', '90d', '1y'] as const).map(range => (
                            <button
                                key={range}
                                onClick={() => setDateRange(range)}
                                className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${dateRange === range ? 'bg-white dark:bg-zinc-700 shadow text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700'}`}
                            >
                                {range}
                            </button>
                        ))}
                    </div>

                    <Link
                        to="custom"
                        className="px-4 py-2 text-sm font-medium rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow hover:opacity-90 transition-opacity"
                    >
                        Custom Query
                    </Link>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="border-b border-zinc-200 dark:border-zinc-800 mb-6">
                <nav className="-mb-px flex space-x-8">
                    {tabs.map((tab) => {
                        const isActive = location.pathname.includes(tab.path);
                        return (
                            <Link
                                key={tab.name}
                                to={tab.path}
                                className={`
                                    whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors
                                    ${isActive
                                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                        : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-300'}
                                `}
                            >
                                {tab.name}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <Outlet context={{ tenant, dateRange, shouldBlur }} />
        </div>
    );
}
