import { LoaderFunctionArgs } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "~/utils/api";

export const loader = async (args: LoaderFunctionArgs) => {
    let token: string | null = null;

    const cookie = args.request.headers.get("Cookie");
    const isDev = import.meta.env.DEV || process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

    if (isDev && cookie?.includes("__e2e_bypass_user_id=")) {
        const match = cookie.match(/__e2e_bypass_user_id=([^;]+)/);
        if (match) token = match[1];
    }
    if (!token) {
        const { getToken } = await getAuth(args);
        token = await getToken();
    }

    const { slug, courseSlug } = args.params;
    const headers = { 'X-Tenant-Slug': slug! };

    // Fetch all courses to find by slug
    const allCourses: any[] = await apiRequest(`/courses?status=active`, null, { headers }).catch(() => []);
    const course = allCourses.find((c: any) => c.slug === courseSlug);

    if (!course) {
        return new Response("Course not found", { status: 404 });
    }

    try {
        // Fetch the certificate HTML string from the backend
        const certificateHtml = await apiRequest<string>(`/courses/${course.id}/certificate`, token, { headers });

        return new Response(certificateHtml, {
            status: 200,
            headers: {
                "Content-Type": "text/html; charset=utf-8"
            }
        });
    } catch (error: any) {
        return new Response(error.message || "Failed to generate certificate", { status: error.status || 500 });
    }
};
