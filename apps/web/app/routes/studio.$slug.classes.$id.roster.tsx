
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { lazy, Suspense } from "react";
import { ClientOnly } from "../components/ClientOnly";

const ClassRosterPage = lazy(() => import("../components/routes/ClassRosterPage"));

export const action = async (args: ActionFunctionArgs) => {
    const { request, params } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const formData = await request.formData();
    const intent = formData.get("intent");
    const bookingId = formData.get("bookingId");
    const classId = params.id;

    if (intent === "check_in") {
        const checkedIn = formData.get("checkedIn") === "true";
        await apiRequest(`/classes/${classId}/bookings/${bookingId}/check-in`, token, {
            method: "PATCH",
            headers: { 'X-Tenant-Slug': params.slug! },
            body: JSON.stringify({ checkedIn })
        });
        return { success: true };
    }

    if (intent === "cancel_booking") {
        await apiRequest(`/classes/${classId}/bookings/${bookingId}/cancel`, token, {
            method: "POST",
            headers: { 'X-Tenant-Slug': params.slug! }
        });
        return { success: true };
    }

    if (intent === "promote") {
        await apiRequest(`/classes/${classId}/bookings/${bookingId}/promote`, token, {
            method: "POST",
            headers: { 'X-Tenant-Slug': params.slug! }
        });
        return { success: true };
    }

    if (intent === "check_in_all") {
        await apiRequest(`/classes/${classId}/check-in-all`, token, {
            method: "POST",
            headers: { 'X-Tenant-Slug': params.slug! },
            body: JSON.stringify({ checkedIn: true })
        });
        return { success: true };
    }

    return null;
};

export const loader = async (args: LoaderFunctionArgs) => {
    const { getToken } = await getAuth(args);
    const token = await getToken();
    const { slug, id } = args.params;

    try {
        const bookings = await apiRequest(`/classes/${id}/bookings`, token, {
            headers: { 'X-Tenant-Slug': slug! }
        });

        return { bookings };
    } catch (e: any) {
        console.error("Failed to load roster", e);
        throw new Response("Failed to load roster", { status: 500 });
    }
};

export default function ClassRoster() {
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
                <ClassRosterPage />
            </Suspense>
        </ClientOnly>
    );
}
