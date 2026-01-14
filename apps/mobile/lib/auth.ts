
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

const TOKEN_KEY = 'auth_token';
const TENANT_KEY = 'active_tenant_slug';

export const AuthStore = {
    // Store the JWT Securely
    async saveToken(token: string) {
        if (Platform.OS === 'web') {
            localStorage.setItem(TOKEN_KEY, token); // Fallback for web dev
        } else {
            await SecureStore.setItemAsync(TOKEN_KEY, token);
        }
    },

    // Retrieve JWT
    async getToken() {
        if (Platform.OS === 'web') {
            return localStorage.getItem(TOKEN_KEY);
        }
        return await SecureStore.getItemAsync(TOKEN_KEY);
    },

    // Remove JWT (Logout)
    async removeToken() {
        if (Platform.OS === 'web') {
            localStorage.removeItem(TOKEN_KEY);
        } else {
            await SecureStore.deleteItemAsync(TOKEN_KEY);
        }
    },

    // Basic Biometric Prompt
    async authenticateBiometric(): Promise<boolean> {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        if (!hasHardware || !isEnrolled) return true; // Skip if not available (or forced true for simplified flow)

        const result = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Authenticate to access your studio',
            fallbackLabel: 'Enter Password',
        });

        return result.success;
    }
};
