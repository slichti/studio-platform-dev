import { Link, Outlet, useLocation, useOutletContext } from "react-router";
import { Upload, Download, Database } from "lucide-react";

export default function StudioDataLayout() {
    const { tenant } = useOutletContext<any>();
    const location = useLocation();

    const tabs = [
        { name: "Export Data", path: `/studio/${tenant.slug}/data/export`, icon: Download },
        { name: "Import Data", path: `/studio/${tenant.slug}/data/import`, icon: Upload },
    ];

    return (
        <div className="max-w-4xl p-8 animate-in fade-in duration-500">
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
                        <Database size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Data Management</h1>
                        <p className="text-zinc-500 dark:text-zinc-400">Manage your studio's data, exports, and migrations.</p>
                    </div>
                </div>
            </div>

            <div className="border-b border-zinc-200 dark:border-zinc-800 mb-8">
                <nav className="-mb-px flex space-x-8">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = location.pathname === tab.path || (tab.path.endsWith('/export') && location.pathname.endsWith('/data'));

                        return (
                            <Link
                                key={tab.name}
                                to={tab.path}
                                className={`
                                    flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                                    ${isActive
                                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                        : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-300'
                                    }
                                `}
                            >
                                <Icon size={16} />
                                {tab.name}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <Outlet context={useOutletContext()} />
        </div>
    );
}
