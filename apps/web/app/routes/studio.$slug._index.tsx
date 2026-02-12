
import { useLoaderData, useOutletContext, Link } from "react-router";

import type { LoaderFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { useUser } from "@clerk/react-router";
import { apiRequest } from "~/utils/api";
import { Users, Calendar, DollarSign, ArrowRight, Activity, TrendingUp, FileSignature, Ticket, Award, Target, Flame, RotateCcw } from "lucide-react";

export const loader = async (args: LoaderFunctionArgs) => {
    // [E2E BYPASS] Skip Clerk for E2E tests
    let token: string | null = null;
    const cookie = args.request.headers.get("Cookie");
    if (cookie?.includes("__e2e_bypass_user_id=")) {
        const match = cookie.match(/__e2e_bypass_user_id=([^;]+)/);
        if (match) token = match[1];
    }

    // Only call getAuth if we didn't bypass
    if (!token) {
        const { getToken } = await getAuth(args);
        token = await getToken();
    }

    const { slug } = args.params;

    try {
        const [stats, myProgress, upcomingRenewals] = await Promise.all([
            apiRequest(`/tenant/stats`, token, { headers: { 'X-Tenant-Slug': slug! } }).catch(() => ({ activeStudents: 0 })),
            apiRequest(`/challenges/my-progress`, token, { headers: { 'X-Tenant-Slug': slug! } }).catch(() => []),
            apiRequest(`/reports/upcoming-renewals?days=14`, token, { headers: { 'X-Tenant-Slug': slug! } }).catch(() => ({ count: 0, renewals: [] }))
        ]);
        return { stats, myProgress, upcomingRenewals };
    } catch (e) {
        console.error("Dashboard loader failed:", e);
        return { stats: { activeStudents: 0, upcomingBookings: 0, monthlyRevenueCents: 0 }, myProgress: [], upcomingRenewals: { count: 0, renewals: [] } };
    }
}


import { lazy, Suspense } from "react";
import { ClientOnly } from "~/components/ClientOnly";
import { SkeletonLoader } from "~/components/ui/SkeletonLoader";

const DashboardPage = lazy(() => import("../components/routes/DashboardPage"));

export default function StudioDashboardIndex() {
    return (
        <ClientOnly fallback={<div className="p-8"><SkeletonLoader type="card" count={3} /></div>}>
            <Suspense fallback={<div className="p-8"><SkeletonLoader type="card" count={3} /></div>}>
                <DashboardPage />
            </Suspense>
        </ClientOnly>
    );
}
