import { LogoutButton } from "./LogoutButton";

export default function Layout({ children }: { children: React.ReactNode }) {
    const { user, isLoaded } = useUser();

    // Simplistic role check (in reality, check publicMetadata or DB)
    const isInstructor = true; // Hardcoded for now until we sync User roles

    return (
        <div style={{ display: 'flex', height: '100vh', fontFamily: "'Inter', sans-serif" }}>
            {/* Sidebar */}
            <aside style={{ width: '250px', background: '#f4f4f5', padding: '20px', borderRight: '1px solid #e4e4e7', display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: '40px' }}>
                    <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Studio Platform</h1>
                </div>

                <nav style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                    <NavLink to="/dashboard" style={({ isActive }) => ({ padding: '10px', borderRadius: '6px', background: isActive ? '#e4e4e7' : 'transparent', textDecoration: 'none', color: '#18181b' })}>
                        Overview
                    </NavLink>

                    <NavLink to="/dashboard/classes" style={({ isActive }) => ({ padding: '10px', borderRadius: '6px', background: isActive ? '#e4e4e7' : 'transparent', textDecoration: 'none', color: '#18181b' })}>
                        Classes
                    </NavLink>
                </nav>

                <div style={{ marginTop: 'auto', borderTop: '1px solid #e4e4e7', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div className="flex items-center gap-2">
                        <UserButton />
                        {isLoaded && user && <div style={{ fontSize: '0.875rem', color: '#71717a' }}>{user.fullName}</div>}
                    </div>
                    <LogoutButton className="w-full text-sm" />
                </div>
            </aside>

            {/* Main Content */}
            <main style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
                {children}
            </main>
        </div>
    );
}
