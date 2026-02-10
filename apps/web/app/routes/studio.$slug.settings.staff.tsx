
import { Suspense, lazy } from "react";
import { ClientOnly } from "~/components/ClientOnly";

const StaffPage = lazy(() => import("~/components/routes/StaffPage"));

export default function StaffSettingsRoute() {
    return (
        <ClientOnly fallback={<div className="p-10 text-center text-zinc-500">Loading staff...</div>}>
            {() => (
                <Suspense fallback={<div className="p-10 text-center text-zinc-500">Loading staff...</div>}>
                    <StaffPage />
                </Suspense>
            )}
        </ClientOnly>
    );
}
