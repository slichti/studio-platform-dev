import { UserButton, useUser, useClerk } from "@clerk/react-router";
import { NavLink } from "react-router";
import { useState, useEffect } from "react";

type LayoutProps = {
    children: React.ReactNode;
    tenantName?: string;
    role?: string;
    navItems?: React.ReactNode;
    title?: string;
};

type Theme = 'light' | 'dark';

const THEMES = {
    dark: {
        bg: '#1c1e2e',
        sidebarBg: '#181924',
        headerBg: '#181924',
        border: '#282a3a',
        text: '#e5e7eb',
        textMuted: '#9ca3af',
        accentText: '#818cf8',
        cardBg: '#232536',
        hoverBg: '#282a3a',
        navActiveBg: '#282a3a',
        navActiveText: '#fff',
    },
    light: {
        bg: '#f8f9fa',
        sidebarBg: '#ffffff',
        headerBg: '#ffffff',
        border: '#e9ecef',
        text: '#343a40',
        textMuted: '#868e96',
        accentText: '#4f46e5', // Indigo 600
        cardBg: '#ffffff',
        hoverBg: '#f1f3f5',
        navActiveBg: '#f1f3f5',
        navActiveText: '#212529',
    }
};

export default function Layout({ children, tenantName = "Studio Platform", role, navItems, title = "Overview" }: LayoutProps) {
    const { user, isLoaded } = useUser();
    const { signOut } = useClerk();
    const [theme, setTheme] = useState<Theme>('dark'); // Default to dark as requested initally
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [impersonationToken, setImpersonationToken] = useState<string | null>(null);

    useEffect(() => {
        // Load from local storage or prefer-color-scheme
        const stored = localStorage.getItem('theme') as Theme;
        if (stored) {
            setTheme(stored);
        } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
            setTheme('light');
        }

        // Check for impersonation token on mount to avoid hydration mismatch
        setImpersonationToken(localStorage.getItem("impersonation_token"));
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    };

    const colors = THEMES[theme];

    // Inject CSS variables
    const styleVariables = {
        '--bg': colors.bg,
        '--sidebar-bg': colors.sidebarBg,
        '--header-bg': colors.headerBg,
        '--border': colors.border,
        '--text': colors.text,
        '--text-muted': colors.textMuted,
        '--accent': colors.accentText,
        '--card-bg': colors.cardBg,
        '--hover-bg': colors.hoverBg,
        '--nav-active-bg': colors.navActiveBg,
        '--nav-active-text': colors.navActiveText,
    } as React.CSSProperties;

    const handleLogout = () => {
        if (typeof window !== "undefined") {
            localStorage.removeItem("impersonation_token");
            setImpersonationToken(null);
        }
        signOut({ redirectUrl: "/" });
    };

    return (
        <div style={{ ...styleVariables, display: 'flex', height: '100vh', fontFamily: "'Inter', sans-serif", background: 'var(--bg)', color: 'var(--text)', transition: 'background 0.3s, color 0.3s' }}>
            {/* Sidebar */}
            <aside style={{ width: '260px', background: 'var(--sidebar-bg)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', transition: 'background 0.3s, border-color 0.3s' }}>
                {/* Logo / Tenant Area */}
                <div style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '2rem' }}>🧘‍♀️</div>
                    <div>
                        <h1 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--accent)', lineHeight: '1.2' }}>
                            {tenantName}
                        </h1>
                    </div>
                </div>

                {/* Navigation */}
                <nav style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
                    {navItems || (
                        <>
                            <NavLink to="/dashboard" style={({ isActive }) => ({ display: 'block', padding: '10px 12px', borderRadius: '8px', background: isActive ? 'var(--nav-active-bg)' : 'transparent', textDecoration: 'none', color: isActive ? 'var(--nav-active-text)' : 'var(--text-muted)', fontSize: '0.95rem', fontWeight: isActive ? 600 : 400, transition: 'all 0.2s' })}>
                                Overview
                            </NavLink>
                        </>
                    )}
                </nav>
            </aside>

            {/* Main Content Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Impersonation Banner */}
                {impersonationToken && (
                    <div style={{ background: '#ef4444', color: 'white', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', fontSize: '0.9rem', fontWeight: '500' }}>
                        <span>⚠️ You are currently impersonating a user ({typeof window !== 'undefined' ? localStorage.getItem("impersonation_target_email") : "User"}). Financial actions are restricted.</span>
                        <button
                            onClick={() => {
                                localStorage.removeItem("impersonation_token");
                                localStorage.removeItem("impersonation_target_email");
                                setImpersonationToken(null);
                                window.location.href = "/";
                            }}
                            style={{ background: 'white', color: '#ef4444', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                            Exit Impersonation
                        </button>
                    </div>
                )}

                {/* Header */}
                <header style={{ height: '70px', background: 'var(--header-bg)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', transition: 'background 0.3s, border-color 0.3s' }}>
                    {/* Left: Page Title */}
                    <div style={{ fontSize: '1.1rem', fontWeight: '500', color: 'var(--text)' }}>
                        {title}
                    </div>

                    {/* Right: User Profile */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        {/* Theme Toggle */}
                        <button onClick={toggleTheme} style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--hover-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
                            {theme === 'dark' ? '☾' : '☀'}
                        </button>

                        {/* User Info Dropdown Trigger */}
                        {isLoaded && user && (
                            <div style={{ position: 'relative' }}>
                                <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsDropdownOpen(!isDropdownOpen); }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '8px', transition: 'background 0.2s' }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover-bg)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    {/* Avatar */}
                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem' }}>
                                        {user.imageUrl ? (
                                            <img src={user.imageUrl} alt={user.fullName || "User"} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <span>{user.firstName ? user.firstName[0] : 'U'}</span>
                                        )}
                                    </div>

                                    <div style={{ textAlign: 'left' }}>
                                        <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text)' }}>{user.fullName}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '400' }}>{role || "admin"}</div>
                                    </div>

                                    {/* Chevron */}
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                </div>

                                {/* Dropdown Menu */}
                                {isDropdownOpen && (
                                    <>
                                        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }} onClick={() => setIsDropdownOpen(false)} />
                                        <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: '200px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', zIndex: 50 }}>
                                            <NavLink to="/dashboard/profile" onClick={() => setIsDropdownOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: '6px', textDecoration: 'none', color: 'var(--text)', fontSize: '0.9rem', transition: 'background 0.2s' }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover-bg)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                                My Profile
                                            </NavLink>

                                            {impersonationToken && (
                                                <button
                                                    onClick={() => {
                                                        setIsDropdownOpen(false);
                                                        localStorage.removeItem("impersonation_token");
                                                        localStorage.removeItem("impersonation_target_email");
                                                        setImpersonationToken(null);
                                                        window.location.href = "/admin"; // Explicit redirect to admin
                                                    }}
                                                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '0.9rem', textAlign: 'left', transition: 'background 0.2s' }}
                                                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--hover-bg)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 0 0-10 10v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6a10 10 0 0 0-10-10Z" /><path d="M12 12v6" /><circle cx="12" cy="7" r="1" /></svg>
                                                    Return to Admin Console
                                                </button>
                                            )}

                                            <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }}></div>
                                            <button onClick={() => { setIsDropdownOpen(false); handleLogout(); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderRadius: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.9rem', textAlign: 'left', transition: 'background 0.2s' }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                                                Sign Out
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </header>

                {/* Page Content */}
                <main style={{ flex: 1, padding: '40px', overflowY: 'auto', background: 'var(--bg)', transition: 'background 0.3s' }}>
                    {children}
                </main>
            </div>
        </div>
    );
}
