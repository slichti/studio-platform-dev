
import { type LoaderFunctionArgs, redirect } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import AdminBookingsPage from "../components/routes/AdminBookingsPage";

export const loader = async (args: LoaderFunctionArgs) => {
    let token;
    try {
        const { getToken } = await getAuth(args);
        token = await getToken();
    } catch (authErr) {
        return redirect('/sign-in');
    }

    if (!token) {
        return redirect('/sign-in?redirect_url=/admin/bookings');
    }

    const url = new URL(args.request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const status = url.searchParams.get("status") || "";
    const offset = (page - 1) * limit;

    const env = (args.context as any).cloudflare?.env || (args.context as any).env || {};
    const apiUrl = env.VITE_API_URL || "https://studio-platform-api.slichti.workers.dev";

    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    params.append("offset", offset.toString());
    if (status) params.append("status", status);

    try {
        const data = await apiRequest<any>(`/admin/bookings?${params.toString()}`, token, {}, apiUrl);
        return {
            bookings: data.bookings,
            total: data.total,
            page,
            limit,
            status,
            error: null
        };
    } catch (err: any) {
        return {
            bookings: [],
            total: 0,
            page,
            limit,
            status,
            error: err.message
        };
    }
};

export default function BookingsRoute() {
    return <AdminBookingsPage />;
}
