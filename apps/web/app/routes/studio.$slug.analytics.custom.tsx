import { lazy, Suspense } from "react";
import { ClientOnly } from "~/components/ClientOnly";

const CustomAnalyticsPage = lazy(() => import("../components/routes/CustomAnalyticsPage"));

export default function AnalyticsCustom() {
    return (
        <ClientOnly fallback={<div className="h-96 flex items-center justify-center">Loading Analytics...</div>}>
            <Suspense fallback={<div className="h-96 flex items-center justify-center">Loading Analytics...</div>}>
                <CustomAnalyticsPage />
            </Suspense>
        </ClientOnly>
    );
}
