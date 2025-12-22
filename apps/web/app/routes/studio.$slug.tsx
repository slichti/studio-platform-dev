import { Outlet, useLoaderData, useParams, NavLink } from "react-router";
import { LoaderFunction, LoaderFunctionArgs, redirect } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { API_URL, apiRequest } from "../utils/api";
import Layout from "../components/Layout";

type StudioLayoutData = {
    member: any;
    roles: string[];
    tenant: any;
};

export const loader: LoaderFunction = async (args) => {
    const { params, request } = args;
    const { userId, getToken } = await getAuth(args);

    if (!userId) {
        return redirect(`/sign-in?redirect_url=${request.url}`);
    }

    const { slug } = params;
    if (!slug) return redirect("/");

    const token = await getToken();

    // 1. Fetch Tenant Info by Slug
    // We can use the public API or just hit the tenant endpoints with knowledge of the slug.
    // However, the api middleware expects subdomain or header.
    // We can pass X-Tenant-Id? We don't have ID yet.
    // We can rely on the API to lookup by subdomain if we were on one.
    // If we are on main platform (app.platform.com/studio/zenflow), we need to pass a header.
    // Let's assume we can't easily pass slug in header if header expects ID.
    // Maybe we need a "lookup tenant by slug" endpoint that is public?
    // Current public/studios might list them.

    // For now, let's assume we hit `${API_URL}/tenant/info` but we need to tell it WHICH tenant.
    // The current middleware uses Host header.
    // If we can control the Host header in server-side fetch? 
    // Host header is usually restricted.

    // Better Approach:
    // Update API to support `X-Tenant-Slug` header too.

    // Let's assume we update API to support slug header.
    // I'll update the middleware shortly.

    try {
        const tenantInfo = await apiRequest(`/tenant/info`, token, {
            headers: { 'X-Tenant-Slug': slug }
        });

        // 2. Fetch My Role in this specific tenant
        // /tenant/me will use the context set by middleware (which uses the header)
        const me = await apiRequest(`/tenant/me`, token, {
            headers: { 'X-Tenant-Slug': slug }
        });

        return {
            tenant: tenantInfo,
            member: me.member,
            roles: me.roles
        };
    } catch (e) {
        console.error("Failed to load studio data", e);
        // If 404, maybe invalid slug
        throw new Response("Studio Not Found", { status: 404 });
    }
};

export default function StudioLayout() {
    const { tenant, member, roles } = useLoaderData<StudioLayoutData>();

    // Determine Role
    const isOwner = roles.includes('owner');
    const isInstructor = roles.includes('instructor');
    const isStudent = roles.includes('student'); // or implicit if member exists?

    const activeRole = isOwner ? "Owner" : isInstructor ? "Instructor" : "Student";

    // Sidebar Items based on Role
    const navItems = (
        <>
            {isOwner && (
                <div style={{ marginBottom: '24px' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#adb5bd', marginBottom: '8px', paddingLeft: '12px', letterSpacing: '0.5px' }}>ADMIN</div>
                    <NavPending to="." end>Overview</NavPending>
                    <NavPending to="settings">Settings</NavPending>
                    <NavPending to="finances">Finances</NavPending>
                </div>
            )}

            {isInstructor && (
                <div style={{ marginBottom: '24px' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#adb5bd', marginBottom: '8px', paddingLeft: '12px', letterSpacing: '0.5px' }}>INSTRUCTOR</div>
                    <NavPending to="schedule">My Schedule</NavPending>
                    <NavPending to="students">Students</NavPending>
                </div>
            )}

            <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#adb5bd', marginBottom: '8px', paddingLeft: '12px', letterSpacing: '0.5px' }}>STUDENT</div>
                <NavPending to="classes">Book Classes</NavPending>
                <NavPending to="memberships">My Memberships</NavPending>
                <NavPending to="waivers">Waivers</NavPending>
            </div>
        </>
    );

    return (
        <Layout tenantName={tenant.name} role={activeRole} navItems={navItems}>
            <Outlet context={{ tenant, member, roles }} />
        </Layout>
    );
}

function NavPending({ to, children, end }: { to: string, children: React.ReactNode, end?: boolean }) {
    return (
        <NavLink
            to={to}
            end={end}
            className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm transition-colors mb-0.5 ${isActive
                    ? 'bg-zinc-100 text-zinc-900 font-medium'
                    : 'text-zinc-600 hover:bg-zinc-50'
                }`
            }
        >
            {children}
        </NavLink>
    )
}


