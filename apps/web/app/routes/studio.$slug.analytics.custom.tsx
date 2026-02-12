import { lazy, Suspense } from "react";
import { ClientOnly } from "~/components/ClientOnly";
import { SkeletonLoader } from "~/components/ui/SkeletonLoader";

const CustomAnalyticsPage = lazy(() => import("../components/routes/CustomAnalyticsPage"));

export default function AnalyticsCustom() {
    return (
        <ClientOnly fallback={<div className="p-8"><SkeletonLoader type="card" count={2} /></div>}>
            <Suspense fallback={<div className="p-8"><SkeletonLoader type="card" count={2} /></div>}>
                <CustomAnalyticsPage />
            </Suspense>
        </ClientOnly>
    );
}
