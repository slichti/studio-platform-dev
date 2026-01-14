
import { createContext, useContext, useEffect, useState } from 'react';
import { AuthStore } from '../lib/auth';
import { useRouter, useSegments } from 'expo-router';

type AuthContextType = {
    signIn: (token: string) => Promise<void>;
    signOut: () => Promise<void>;
    token: string | null;
    isLoading: boolean;
};

const AuthContext = createContext<AuthContextType>({
    signIn: async () => { },
    signOut: async () => { },
    token: null,
    isLoading: true,
});

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const segments = useSegments();

    useEffect(() => {
        // Check for stored token on mount
        const loadToken = async () => {
            const storedToken = await AuthStore.getToken();

            if (storedToken) {
                // Optional: Validate token with API or check expiration
                // For now, assume valid.

                // Try Biometric re-auth if configured?
                // const bioSuccess = await AuthStore.authenticateBiometric();
                // if (bioSuccess) setToken(storedToken);
                setToken(storedToken);
            }
            setIsLoading(false);
        };

        loadToken();
    }, []);

    useEffect(() => {
        if (isLoading) return;

        const inAuthGroup = segments[0] === '(auth)';

        if (!token && !inAuthGroup) {
            // Redirect to login if not authenticated
            router.replace('/login');
        } else if (token && inAuthGroup) {
            // Redirect to home if authenticated
            router.replace('/(tabs)');
        }
    }, [token, segments, isLoading]);

    const signIn = async (newToken: string) => {
        await AuthStore.saveToken(newToken);
        setToken(newToken);
    };

    const signOut = async () => {
        await AuthStore.removeToken();
        setToken(null);
    };

    return (
        <AuthContext.Provider value={{ signIn, signOut, token, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
}
