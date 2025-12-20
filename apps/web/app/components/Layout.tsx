import { UserButton, useUser } from "@clerk/react-router";
import { NavLink } from "react-router";
import { LogoutButton } from "./LogoutButton";

type LayoutProps = {
    children: React.ReactNode;
    tenantName?: string;
    role?: string;
    navItems?: React.ReactNode;
};

export default function Layout({ children, tenantName = "Studio Platform", role, navItems }: LayoutProps) {
    const { user, isLoaded } = useUser();

    return (
        <div style={{ display: 'flex', height: '100vh', fontFamily: "'Inter', sans-serif", background: '#f8f9fa' }}>
            {/* Sidebar */}
            <aside style={{ width: '260px', background: '#ffffff', borderRight: '1px solid #e9ecef', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '24px', borderBottom: '1px solid #f1f3f5' }}>
                    <h1 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#343a40', letterSpacing: '-0.5px' }}>
                        {tenantName}
                    </h1>
                    {tenantName !== "Studio Platform" && (
                        <div style={{ fontSize: '0.75rem', color: '#868e96', marginTop: '4px' }}>
                            Studio Management
                        </div>
                    )}
                </div>

                <nav style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
                    {navItems || (
                        <>
                            <NavLink to="/dashboard" style={({ isActive }) => ({ display: 'block', padding: '10px 12px', borderRadius: '8px', background: isActive ? '#f1f3f5' : 'transparent', textDecoration: 'none', color: isActive ? '#212529' : '#495057', fontSize: '0.95rem', fontWeight: isActive ? 600 : 400 })}>
                                Overview
                            </NavLink>
                            <NavLink to="/dashboard/classes" style={({ isActive }) => ({ display: 'block', padding: '10px 12px', borderRadius: '8px', background: isActive ? '#f1f3f5' : 'transparent', textDecoration: 'none', color: isActive ? '#212529' : '#495057', fontSize: '0.95rem', fontWeight: isActive ? 600 : 400 })}>
                                Classes
                            </NavLink>
                        </>
                    )}
                </nav>
            </aside>

            {/* Main Content Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Header */}
                <header style={{ height: '70px', background: '#ffffff', borderBottom: '1px solid #e9ecef', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                        {isLoaded && user && (
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: '600', fontSize: '0.9rem', color: '#343a40' }}>{user.fullName}</div>
                                <div style={{ fontSize: '0.75rem', color: '#adb5bd', fontWeight: '500', textTransform: 'uppercase' }}>{role || "Member"}</div>
                            </div>
                        )}
                        <UserButton afterSignOutUrl="/" />
                        <div style={{ width: '1px', height: '24px', background: '#e9ecef' }}></div>
                        <LogoutButton className="text-sm px-3 py-1.5" />
                    </div>
                </header>

                {/* Page Content */}
                <main style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
                    {children}
                </main>
            </div>
        </div>
    );
}
