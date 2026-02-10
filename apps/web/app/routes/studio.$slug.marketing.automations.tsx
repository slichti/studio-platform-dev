
import { LoaderFunctionArgs, ActionFunctionArgs, redirect } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { lazy, Suspense } from "react";
import { ClientOnly } from "../components/ClientOnly";

const MarketingAutomationsPage = lazy(() => import("../components/routes/MarketingAutomationsPage"));

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken, userId } = await getAuth(args);
    const { slug } = args.params;
    if (!userId) return redirect("/sign-in");

    const token = await getToken();
    const tenantSlug = slug || '';

    try {
        const [automationsData, statsData] = await Promise.all([
            apiRequest('/marketing/automations', token, { headers: { 'X-Tenant-Slug': tenantSlug } }),
            apiRequest('/marketing/automations/stats', token, { headers: { 'X-Tenant-Slug': tenantSlug } }).catch(() => null)
        ]) as any[];

        return { automations: automationsData?.automations || [], stats: statsData };
    } catch (e) {
        console.error("Automations Loader Error", e);
        return { automations: [], stats: null };
    }
};

export const action = async (args: ActionFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const { slug } = args.params;
    const token = await getToken();
    const formData = await args.request.formData();
    const intent = formData.get("intent");
    const tenantSlug = slug || '';

    if (intent === 'create' || intent === 'update') {
        const data: any = {};
        for (const [key, val] of formData.entries()) {
            if (key === 'intent') continue;
            try {
                data[key] = JSON.parse(val as string);
            } catch (e) {
                data[key] = val;
            }
        }

        if (intent === 'update') {
            const id = data.id;
            await apiRequest(`/marketing/automations/${id}`, token, {
                method: 'PATCH',
                headers: { 'X-Tenant-Slug': tenantSlug },
                body: JSON.stringify(data)
            });
        } else {
            await apiRequest('/marketing/automations', token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': tenantSlug },
                body: JSON.stringify(data)
            });
        }
        return { success: true };
    }

    if (intent === 'toggle') {
        const id = formData.get("id");
        await apiRequest(`/marketing/automations/${id}/toggle`, token, {
            method: 'POST',
            headers: { 'X-Tenant-Slug': tenantSlug }
        });
        return { success: true };
    }

    if (intent === 'delete') {
        const id = formData.get("id");
        await apiRequest(`/marketing/automations/${id}`, token, {
            method: 'DELETE',
            headers: { 'X-Tenant-Slug': tenantSlug }
        });
        return { success: true };
    }

    return { success: true };
};

export default function AutomatedCampaigns() {
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
                <MarketingAutomationsPage />
            </Suspense>
        </ClientOnly>
    );
}
