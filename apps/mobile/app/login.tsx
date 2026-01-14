
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Link } from 'expo-router';
import Constants from 'expo-constants';

export default function LoginScreen() {
    const { signIn } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    // Get config from app.config.ts / app.json
    const config = Constants.expoConfig?.extra;
    const tenantSlug = config?.tenantSlug; // If compiled for a specific tenant
    const apiUrl = config?.apiUrl || "https://studio-platform-api.slichti.workers.dev"; // Fallback URL

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        setLoading(true);
        try {
            // Login Logic
            // 1. If tenantSlug is known (White Label build), we login directly to that tenant?
            //    Or we use a global login and then find their tenant membership?

            // Assume Global Login for now to get User JWT
            // Then we need to pick a tenant if they have multiple.

            // For MVP: Simple login to get a Token.
            const response = await fetch(`${apiUrl}/users/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            // Success
            await signIn(data.token);

            // On success, AuthContext redirects to /(tabs)

        } catch (e: any) {
            Alert.alert('Login Failed', e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 bg-white justify-center px-8"
        >
            <View className="items-center mb-10">
                {/* Dynamic Logo if available */}
                <View className="w-20 h-20 bg-black rounded-2xl mb-4" />
                <Text className="text-2xl font-bold text-gray-900">
                    {tenantSlug ? `Welcome to ${tenantSlug}` : "Studio Login"}
                </Text>
                <Text className="text-gray-500 mt-2">Sign in to manage your account</Text>
            </View>

            <View className="space-y-4">
                <View>
                    <Text className="text-gray-700 font-medium mb-1">Email</Text>
                    <TextInput
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-900"
                        placeholder="you@example.com"
                        autoCapitalize="none"
                        keyboardType="email-address"
                        value={email}
                        onChangeText={setEmail}
                    />
                </View>

                <View>
                    <Text className="text-gray-700 font-medium mb-1">Password</Text>
                    <TextInput
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-900"
                        placeholder="••••••••"
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                    />
                </View>

                <TouchableOpacity
                    onPress={handleLogin}
                    disabled={loading}
                    className={`w-full bg-black py-4 rounded-xl items-center mt-4 ${loading ? 'opacity-70' : ''}`}
                >
                    <Text className="text-white font-bold text-lg">
                        {loading ? 'Signing in...' : 'Sign In'}
                    </Text>
                </TouchableOpacity>
            </View>

            <View className="mt-8 flex-row justify-center">
                <Text className="text-gray-500">Don't have an account? </Text>
                <Link href="/register" asChild>
                    <TouchableOpacity>
                        <Text className="text-blue-600 font-medium">Sign Up</Text>
                    </TouchableOpacity>
                </Link>
            </View>
        </KeyboardAvoidingView>
    );
}
