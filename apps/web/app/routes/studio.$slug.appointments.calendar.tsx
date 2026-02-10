
import { LoaderFunctionArgs, ActionFunctionArgs, redirect } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";
import { Suspense, lazy } from "react";
import { ClientOnly } from "~/components/ClientOnly";

const AppointmentsPage = lazy(() => import("~/components/routes/AppointmentsPage"));

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken, userId } = await getAuth(args);
    const { slug } = args.params;
    if (!userId) return redirect("/sign-in");

    const url = new URL(args.request.url);
    const weekStart = url.searchParams.get("week") || new Date().toISOString().split("T")[0];

    const token = await getToken();

    try {
        const [appointmentsData, servicesData, instructorsData] = await Promise.all([
            apiRequest(`/appointments?weekStart=${weekStart}`, token, { headers: { 'X-Tenant-Slug': slug } }),
            apiRequest('/appointment-services', token, { headers: { 'X-Tenant-Slug': slug } }),
            apiRequest('/members?role=instructor', token, { headers: { 'X-Tenant-Slug': slug } })
        ]) as any[];

        return {
            appointments: appointmentsData || [],
            services: servicesData || [],
            instructors: instructorsData || [],
            weekStart
        };
    } catch (e) {
        console.error("Appointments Loader Error", e);
        return { appointments: [], services: [], instructors: [], weekStart };
    }
};

export const action = async (args: ActionFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const { slug } = args.params;
    const token = await getToken();
    const formData = await args.request.formData();
    const intent = formData.get("intent");

    if (intent === 'create') {
        await apiRequest('/appointments', token, {
            method: 'POST',
            headers: { 'X-Tenant-Slug': slug },
            body: JSON.stringify({
                serviceId: formData.get("serviceId"),
                instructorId: formData.get("instructorId"),
                memberId: formData.get("memberId"),
                startTime: formData.get("startTime"),
                notes: formData.get("notes")
            })
        });
    }

    if (intent === 'update-status') {
        const id = formData.get("id");
        await apiRequest(`/appointments/${id}`, token, {
            method: 'PATCH',
            headers: { 'X-Tenant-Slug': slug },
            body: JSON.stringify({ status: formData.get("status") })
        });
    }

    if (intent === 'cancel') {
        const id = formData.get("id");
        await apiRequest(`/appointments/${id}`, token, {
            method: 'PATCH',
            headers: { 'X-Tenant-Slug': slug },
            body: JSON.stringify({ status: 'cancelled' })
        });
    }

    return { success: true };
};

export default function AppointmentsRoute() {
    return (
        <ClientOnly fallback={<div className="p-10 text-center text-zinc-500">Loading calendar...</div>}>
            {() => (
                <Suspense fallback={<div className="p-10 text-center text-zinc-500">Loading calendar...</div>}>
                    <AppointmentsPage />
                </Suspense>
            )}
        </ClientOnly>
    );
}
