
import { createContext, useContext, useEffect, useState } from 'react';
import { AuthStore } from '../lib/auth';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

type TenantTheme = {
    primaryColor: string;
    logoUrl?: string;
    font?: string;
};

type TenantContextType = {
    slug: string | null;
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
    theme: DEFAULT_THEME,
    setSlug: async () => { },
    isLoading: true,
});

export function useTenant() {
    return useContext(TenantContext);
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
    const [slug, setSlugState] = useState<string | null>(null);
    const [theme, setTheme] = useState<TenantTheme>(DEFAULT_THEME);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadTenant();
    }, []);

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
                // TODO: Fetch theme from API
                // For now, use default
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
        // TODO: Fetch theme from API
    };

    return (
        <TenantContext.Provider value={{ slug, theme, setSlug, isLoading }}>
            {children}
        </TenantContext.Provider>
    );
}
