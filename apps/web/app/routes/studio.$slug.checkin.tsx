
import { useState, useEffect } from "react";

import { useLoaderData, useOutletContext, useParams, Link } from "react-router";

import type { LoaderFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import {
    CheckCircle2,
    Circle,
    Users,
    Calendar,
    ArrowLeft,
    Search,
    Loader2,
    UserPlus,
    CreditCard,
    AlertCircle
} from "lucide-react";

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const { slug } = args.params;

    // Fetch classes for "Today"
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    try {
        const classes: any = await apiRequest(`/classes?startDate=${startOfDay.toISOString()}&endDate=${endOfDay.toISOString()}`, token, {
            headers: { 'X-Tenant-Slug': slug! }
        });
        return { classes, token };
    } catch (e) {
        console.error("Check-in loader failed", e);
        return { classes: [], token };
    }
}

import { lazy, Suspense } from "react";
import { ClientOnly } from "~/components/ClientOnly";

const CheckInPage = lazy(() => import("../components/routes/CheckInPage"));

export default function StaffCheckInRoute() {
    return (
        <ClientOnly fallback={<div className="h-screen flex items-center justify-center">Loading Check-in...</div>}>
            <Suspense fallback={<div className="h-screen flex items-center justify-center">Loading Check-in...</div>}>
                <CheckInPage />
            </Suspense>
        </ClientOnly>
    );
}

