import { type LoaderFunctionArgs, redirect } from "react-router";
import { getAuth } from "~/utils/auth-wrapper.server";
import { apiRequest } from "~/utils/api";
import { API_URL } from "~/utils/api";

/**
 * Resource route: redirects to Google OAuth for GBP connect.
 * User must be authenticated; loader calls API /studios/gbp-connect?tenantId=... which returns 302 to Google.
 */
export async function loader(args: LoaderFunctionArgs) {
    const { request, params } = args;
    const { getToken } = await getAuth(args);
    const token = await getToken();
    if (!token) return redirect(`/sign-in?redirect_url=${encodeURIComponent(request.url)}`);

    const slug = params.slug;
    if (!slug) return redirect("/");

    const tenant = await apiRequest<{ id: string; error?: string }>("/tenant/info", token, {
        headers: { "X-Tenant-Slug": slug }
    });
    if (tenant?.error || !tenant?.id) return redirect(`/studio/${slug}/settings/seo`);

    const res = await fetch(`${API_URL}/studios/gbp-connect?tenantId=${encodeURIComponent(tenant.id)}`, {
        redirect: "manual",
        headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status === 302) {
        const location = res.headers.get("Location");
        if (location) return redirect(location);
    }
    return redirect(`/studio/${slug}/settings/seo?gbp_error=1`);
}

export default function ConnectGbpRedirect() {
    return null;
}
