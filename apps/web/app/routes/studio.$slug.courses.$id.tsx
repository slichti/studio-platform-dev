import { lazy, Suspense } from "react";
import { ClientOnly } from "~/components/ClientOnly";

const CourseEditorPage = lazy(() => import("../components/routes/CourseEditorPage"));

export default function CourseEditor() {
    return (
        <ClientOnly fallback={<div className="p-8 flex items-center justify-center min-h-[400px]">Loading Curriculum Builder...</div>}>
            <Suspense fallback={<div className="p-8 flex items-center justify-center min-h-[400px]">Loading Curriculum Builder...</div>}>
                <CourseEditorPage />
            </Suspense>
        </ClientOnly>
    );
}
