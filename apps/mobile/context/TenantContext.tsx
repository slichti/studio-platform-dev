import Constants from 'expo-constants';
import { createContext, useContext, useEffect, useState } from 'react';
import { AuthStore } from '../lib/auth';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { apiRequest } from '../lib/api';

type TenantTheme = {
    primaryColor: string;
    logoUrl?: string;
    font?: string;
};

type TenantContextType = {
    slug: string | null;
    tenant: any; // Full tenant object
    theme: TenantTheme;
    setSlug: (slug: string) => Promise<void>;
    isLoading: boolean;
};

// Default Theme
const DEFAULT_THEME: TenantTheme = {
    primaryColor: '#3b82f6', // blue-500
};

const TenantContext = createContext<TenantContextType>({
    slug: null,
    tenant: null,
    theme: DEFAULT_THEME,
    setSlug: async () => { },
    isLoading: true,
});

export function useTenant() {
    return useContext(TenantContext);
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
    const [slug, setSlugState] = useState<string | null>(null);
    const [tenant, setTenant] = useState<any>(null);
    const [theme, setTheme] = useState<TenantTheme>(DEFAULT_THEME);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadTenant();
    }, []);

    const loadTheme = async (tenantSlug: string) => {
        try {
            const data = await apiRequest(`/public/tenant/${tenantSlug}`); // Use public/tenant for info
            if (data) {
                setTenant(data);
                if (data.branding) {
                    setTheme({
                        primaryColor: data.branding.primaryColor || DEFAULT_THEME.primaryColor,
                        logoUrl: data.branding.logoUrl,
                        font: data.branding.font
                    });
                }
            }
        } catch (e) {
            console.error('Failed to fetch tenant theme', e);
        }
    };

    const loadTenant = async () => {
        try {
            // Load slug from storage
            let storedSlug: string | null = null;
            if (Platform.OS === 'web') {
                storedSlug = localStorage.getItem('active_tenant_slug');
            } else {
                storedSlug = await SecureStore.getItemAsync('active_tenant_slug');
            }

            if (storedSlug) {
                setSlugState(storedSlug);
                // In a real app we might verify if it's still valid or just fetch info
                await loadTheme(storedSlug);
            } else {
                // Fallback to config (for single-tenant builds)
                const configSlug = Constants.expoConfig?.extra?.tenantSlug;
                if (configSlug) {
                    setSlugState(configSlug);
                    await loadTheme(configSlug);
                }
            }
        } catch (e) {
            console.error('Failed to load tenant', e);
        } finally {
            setIsLoading(false);
        }
    };

    const setSlug = async (newSlug: string) => {
        if (Platform.OS === 'web') {
            localStorage.setItem('active_tenant_slug', newSlug);
        } else {
            await SecureStore.setItemAsync('active_tenant_slug', newSlug);
        }
        setSlugState(newSlug);
        await loadTheme(newSlug);
    };

    return (
        <TenantContext.Provider value={{ slug, tenant, theme, setSlug, isLoading }}>
            {children}
        </TenantContext.Provider>
    );
}
