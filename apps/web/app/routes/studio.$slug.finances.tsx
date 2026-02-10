
import { useOutletContext } from "react-router";
import { apiRequest, API_URL } from "../utils/api";
import { useState, useEffect } from "react";
import { useAuth } from "@clerk/react-router";
import { ConfirmationDialog, ErrorDialog, SuccessDialog } from "~/components/Dialogs";


import { lazy, Suspense } from "react";
import { ClientOnly } from "~/components/ClientOnly";

const FinancesPage = lazy(() => import("../components/routes/FinancesPage"));

export default function StudioFinances() {
    return (
        <ClientOnly fallback={<div className="h-screen flex items-center justify-center">Loading Finances...</div>}>
            <Suspense fallback={<div className="h-screen flex items-center justify-center">Loading Finances...</div>}>
                <FinancesPage />
            </Suspense>
        </ClientOnly>
    );
}
