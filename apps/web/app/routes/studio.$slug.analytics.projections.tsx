import React, { Suspense, lazy } from "react";
const ProjectionsCalculator = lazy(() => import("~/components/ProjectionsCalculator").then(mod => ({ default: mod.ProjectionsCalculator })));
import { SkeletonLoader } from "~/components/ui/SkeletonLoader";

export default function AnalyticsProjections() {
    return (
        <div className="animate-in fade-in duration-500">
            <Suspense fallback={<SkeletonLoader type="card" count={1} className="h-[500px]" />}>
                <ProjectionsCalculator />
            </Suspense>
        </div>
    );
}
