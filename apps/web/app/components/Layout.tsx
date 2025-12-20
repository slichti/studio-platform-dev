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

    useEffect(() => {
        // Load from local storage or prefer-color-scheme
        const stored = localStorage.getItem('theme') as Theme;
        if (stored) {
            setTheme(stored);
        } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
            setTheme('light');
        }
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    };

    const colors = THEMES[theme];

    const handleLogout = () => {
        if (typeof window !== "undefined") {
            localStorage.removeItem("impersonation_token");
        }
        signOut({ redirectUrl: "/" });
    };

    return (
        <div style={{ display: 'flex', height: '100vh', fontFamily: "'Inter', sans-serif", background: colors.bg, color: colors.text, transition: 'background 0.3s, color 0.3s' }}>
            {/* Sidebar */}
            <aside style={{ width: '260px', background: colors.sidebarBg, borderRight: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', transition: 'background 0.3s, border-color 0.3s' }}>
                {/* Logo / Tenant Area */}
                <div style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px', borderBottom: `1px solid ${colors.border}` }}>
                    <div style={{ fontSize: '2rem' }}>🧘‍♀️</div>
                    <div>
                        <h1 style={{ fontSize: '1.2rem', fontWeight: '700', color: colors.accentText, lineHeight: '1.2' }}>
                            {tenantName}
                        </h1>
                    </div>
                </div>

                {/* Navigation */}
                <nav style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
                    {navItems || (
                        <>
                            <NavLink to="/dashboard" style={({ isActive }) => ({ display: 'block', padding: '10px 12px', borderRadius: '8px', background: isActive ? colors.navActiveBg : 'transparent', textDecoration: 'none', color: isActive ? colors.navActiveText : colors.textMuted, fontSize: '0.95rem', fontWeight: isActive ? 600 : 400, transition: 'all 0.2s' })}>
                                Overview
                            </NavLink>
                        </>
                    )}
                </nav>
            </aside>

            {/* Main Content Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Header */}
                <header style={{ height: '70px', background: colors.headerBg, borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', transition: 'background 0.3s, border-color 0.3s' }}>
                    {/* Left: Page Title */}
                    <div style={{ fontSize: '1.1rem', fontWeight: '500', color: colors.text }}>
                        {title}
                    </div>

                    {/* Right: User Profile */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        {/* Theme Toggle */}
                        <button onClick={toggleTheme} style={{ width: '32px', height: '32px', borderRadius: '50%', background: colors.hoverBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textMuted, border: 'none', cursor: 'pointer', transition: 'all 0.2s' }} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
                            {theme === 'dark' ? '☾' : '☀'}
                        </button>

                        {/* User Info Block */}
                        {isLoaded && user && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {/* Initial Avatar */}
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: colors.accentText, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem' }}>
                                    {user.firstName ? user.firstName[0] : 'U'}
                                </div>

                                <div style={{ textAlign: 'left' }}>
                                    <div style={{ fontWeight: '600', fontSize: '0.9rem', color: colors.text }}>{user.fullName}</div>
                                    <div style={{ fontSize: '0.75rem', color: colors.textMuted, fontWeight: '400' }}>{role || "admin"}</div>
                                </div>
                            </div>
                        )}

                        {/* Logout Icon Button */}
                        <button onClick={handleLogout} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textMuted, padding: '8px', display: 'flex', alignItems: 'center' }} title="Sign Out">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                <polyline points="16 17 21 12 16 7"></polyline>
                                <line x1="21" y1="12" x2="9" y2="12"></line>
                            </svg>
                        </button>
                    </div>
                </header>

                {/* Page Content */}
                <main style={{ flex: 1, padding: '40px', overflowY: 'auto', background: colors.bg, transition: 'background 0.3s' }}>
                    {children}
                </main>
            </div>
        </div>
    );
}
