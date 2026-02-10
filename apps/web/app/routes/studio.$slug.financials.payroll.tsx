
import { lazy, Suspense } from "react";
import { ClientOnly } from "~/components/ClientOnly";

const PayrollPage = lazy(() => import("~/components/routes/PayrollPage"));

export default function PayrollDashboard() {
    return (
        <ClientOnly fallback={<div className="p-8">Loading Payroll...</div>}>
            <Suspense fallback={<div className="p-8">Loading Payroll...</div>}>
                <PayrollPage />
            </Suspense>
        </ClientOnly>
    );
}
