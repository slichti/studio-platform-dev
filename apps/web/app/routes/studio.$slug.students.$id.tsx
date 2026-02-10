
import { lazy, Suspense } from "react";
import { ClientOnly } from "../components/ClientOnly";

const StudentProfilePage = lazy(() => import("../components/routes/StudentProfilePage"));

export default function StudentProfile() {
    return (
        <ClientOnly fallback={
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        }>
            <Suspense fallback={
                <div className="p-8 flex items-center justify-center min-h-[400px]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            }>
                <StudentProfilePage />
            </Suspense>
        </ClientOnly>
    );
}
