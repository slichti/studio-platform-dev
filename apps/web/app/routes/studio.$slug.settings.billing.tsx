
import { useLoaderData, Link } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { CreditCard, Check, BarChart } from "lucide-react";
import { toast } from "sonner";

export const loader = async (args: any) => {
    const { getToken, userId } = await getAuth(args);
    const token = await getToken();
    const slug = args.params.slug;

    try {
        const [tenant, usageRes, plansRes] = await Promise.all([
            apiRequest(`/tenant/info`, token, { headers: { 'X-Tenant-Slug': slug } }),
            apiRequest(`/tenant/usage`, token, { headers: { 'X-Tenant-Slug': slug } }),
            apiRequest(`/public/plans`, token)
        ]);

        if (!tenant.roles?.includes('owner') && !tenant.roles?.includes('admin')) {
            if ((usageRes as any).error) {
                throw new Response("Unauthorized", { status: 403 });
            }
        }

        return { tenant, usage: usageRes, plans: plansRes, slug, token };
    } catch (e: any) {
        throw new Response("Unauthorized", { status: 401 });
    }
};


import { lazy, Suspense } from "react";
import { ClientOnly } from "~/components/ClientOnly";

const BillingPage = lazy(() => import("~/components/routes/BillingPage"));

export default function Billing() {
    return (
        <ClientOnly fallback={<div className="p-8">Loading Billing...</div>}>
            <Suspense fallback={<div className="p-8">Loading Billing...</div>}>
                <BillingPage />
            </Suspense>
        </ClientOnly>
    );
}
