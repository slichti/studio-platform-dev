
import { createContext, useContext, useEffect, useState } from 'react';
import { AuthStore } from '../lib/auth';
import { useRouter, useSegments } from 'expo-router';

type AuthContextType = {
    signIn: (token: string) => Promise<void>;
    signOut: () => Promise<void>;
    /** Request push permission and register token; returns true if granted and registered. Use for onboarding. */
    requestPushAndRegister: () => Promise<boolean>;
    token: string | null;
    isLoading: boolean;
};

const AuthContext = createContext<AuthContextType>({
    signIn: async () => { },
    signOut: async () => { },
    requestPushAndRegister: async () => false,
    token: null,
    isLoading: true,
});

export function useAuth() {
    return useContext(AuthContext);
}

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { apiRequest } from '../lib/api';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const segments = useSegments();

    const registerForPushNotificationsAsync = async (): Promise<boolean> => {
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        if (!Device.isDevice) {
            console.log('Must use physical device for Push Notifications');
            return false;
        }
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            console.log('Failed to get push token for push notification!');
            return false;
        }
        const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
        if (!projectId) {
            console.log("No Project ID found for push notifications");
            return false;
        }
        const pushTokenString = (
            await Notifications.getExpoPushTokenAsync({
                projectId,
            })
        ).data;

        try {
            await apiRequest('/users/push-token', {
                method: 'POST',
                body: JSON.stringify({ token: pushTokenString })
            });
            console.log('Push token registered:', pushTokenString);
            return true;
        } catch (e) {
            console.error('Failed to register push token with backend:', e);
            return false;
        }
    };

    useEffect(() => {
        // Check for stored token on mount
        const loadToken = async () => {
            const storedToken = await AuthStore.getToken();

            if (storedToken) {
                setToken(storedToken);
                // Register push on load if authorized
                registerForPushNotificationsAsync();
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
        // Register push on sign in
        registerForPushNotificationsAsync();
    };

    const signOut = async () => {
        await AuthStore.removeToken();
        setToken(null);
    };

    return (
        <AuthContext.Provider value={{ signIn, signOut, requestPushAndRegister: registerForPushNotificationsAsync, token, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
}
