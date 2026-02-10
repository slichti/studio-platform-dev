
import { useLoaderData } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { lazy, Suspense } from "react";
import { ClientOnly } from "../components/ClientOnly";

const LeadsPage = lazy(() => import("../components/routes/LeadsPage"));

export const loader = async (args: any) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const slug = args.params.slug;

    try {
        const res: any = await apiRequest("/leads", token, { headers: { 'X-Tenant-Slug': slug } });
        return { leads: res.leads || [], token, slug };
    } catch (e: any) {
        return { leads: [], token, slug, error: e.message };
    }
};

export default function Leads() {
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
                <LeadsPage />
            </Suspense>
        </ClientOnly>
    );
}
