
import { Suspense, lazy } from "react";
import { ClientOnly } from "~/components/ClientOnly";
// Keep apiRequest if it was used in loader... 
// actually the old loader was `return null`, so strictly speaking we don't need imports for it if we just reproduce `return null`.
// But let's keep it clean.

const AdminPlansPage = lazy(() => import("~/components/routes/AdminPlansPage"));

export async function loader() {
    // Preserving the previous logic which was just returning null/placeholder
    return null;
}

export default function AdminPlansRoute() {
    return (
        <ClientOnly fallback={<div className="p-10 text-center text-zinc-500">Loading plans...</div>}>
            {() => (
                <Suspense fallback={<div className="p-10 text-center text-zinc-500">Loading plans...</div>}>
                    <AdminPlansPage />
                </Suspense>
            )}
        </ClientOnly>
    );
}
