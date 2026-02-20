import React, { Suspense, lazy } from "react";
const ProjectionsCalculator = lazy(() => import("~/components/ProjectionsCalculator").then(mod => ({ default: mod.ProjectionsCalculator })));

export default function AnalyticsProjections() {
    return (
        <div className="animate-in fade-in duration-500">
            <Suspense fallback={<div className="h-96 flex items-center justify-center bg-zinc-50 dark:bg-zinc-800/50 rounded-xl animate-pulse text-zinc-400">Loading Projection Simulator...</div>}>
                <ProjectionsCalculator />
            </Suspense>
        </div>
    );
}
