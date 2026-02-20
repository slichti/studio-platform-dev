import { lazy, Suspense } from "react";
import { ClientOnly } from "~/components/ClientOnly";

const CoursesPage = lazy(() => import("../components/routes/CoursesPage"));

export default function CoursesIndex() {
    return (
        <ClientOnly fallback={<div className="p-8 flex items-center justify-center min-h-[400px]">Loading Courses...</div>}>
            <Suspense fallback={<div className="p-8 flex items-center justify-center min-h-[400px]">Loading Courses...</div>}>
                <CoursesPage />
            </Suspense>
        </ClientOnly>
    );
}
