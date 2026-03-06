import { lazy, Suspense } from "react";
import { ClientOnly } from "~/components/ClientOnly";

const CommunityHub = lazy(() => import("../components/routes/CommunityHub"));

export default function AdminCommunity() {
    return (
        <ClientOnly fallback={<div className="p-8 flex items-center justify-center min-h-[400px]">Loading Community...</div>}>
            <Suspense fallback={<div className="p-8 flex items-center justify-center min-h-[400px]">Loading Community...</div>}>
                <CommunityHub slug="platform" />
            </Suspense>
        </ClientOnly>
    );
}
