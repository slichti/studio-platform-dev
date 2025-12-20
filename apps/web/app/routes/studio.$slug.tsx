import { Outlet, useLoaderData, useParams } from "react-router";
import { LoaderFunction, LoaderFunctionArgs, redirect } from "react-router";
import { getAuth } from "@clerk/react-router/ssr.server";
import { API_URL, apiRequest } from "../utils/api";

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

    // Sidebar Items based on Role
    return (
        <div style={{ display: 'flex', height: '100vh', fontFamily: "'Inter', sans-serif" }}>
            <aside style={{ width: '250px', background: '#f4f4f5', padding: '20px', borderRight: '1px solid #e4e4e7' }}>
                <div style={{ marginBottom: '40px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>{tenant.name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#666' }}>{tenant.slug}</div>
                </div>

                <nav style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {isOwner && (
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#999', marginBottom: '5px' }}>ADMIN</div>
                            <NavPending to="dashboard">Overview</NavPending>
                            <NavPending to="settings">Settings</NavPending>
                            <NavPending to="finances">Finances</NavPending>
                        </div>
                    )}

                    {isInstructor && (
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#999', marginBottom: '5px' }}>INSTRUCTOR</div>
                            <NavPending to="schedule">My Schedule</NavPending>
                            <NavPending to="students">Students</NavPending>
                        </div>
                    )}

                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#999', marginBottom: '5px' }}>STUDENT</div>
                        <NavPending to="classes">Book Classes</NavPending>
                        <NavPending to="memberships">My Memberships</NavPending>
                    </div>
                </nav>
            </aside>
            <main style={{ flex: 1, padding: '40px' }}>
                <Outlet context={{ tenant, member, roles }} />
            </main>
        </div>
    );
}

function NavPending({ to, children }: { to: string, children: React.ReactNode }) {
    // Helper to just return a styled link
    // Using simple anchor if nested routes not fully set up, or Link with relative path
    return (
        <a href={to} style={{ display: 'block', padding: '8px 12px', borderRadius: '6px', textDecoration: 'none', color: '#333', marginBottom: '2px' }}>
            {children}
        </a>
    )
}
