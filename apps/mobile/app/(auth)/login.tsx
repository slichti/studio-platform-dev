import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { Link, useRouter } from 'expo-router';
import { apiRequest } from '../../lib/api';

export default function LoginScreen() {
    const { signIn } = useAuth();
    const { slug } = useTenant();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        setLoading(true);
        try {
            // Login to get User Token
            const data: any = await apiRequest('/users/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            // On success, AuthContext handles saving token
            await signIn(data.token);

            // AuthProvider will redirect to tabs, but we can also nudge it
            router.replace('/(tabs)');

        } catch (e: any) {
            Alert.alert('Login Failed', e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 bg-white"
        >
            <SafeAreaView className="flex-1 justify-center px-8">
                <View className="items-center mb-10">
                    <View className="w-20 h-20 bg-black rounded-2xl mb-4" />
                    <Text className="text-2xl font-bold text-gray-900">
                        {slug ? `Login to ${slug}` : "Studio Login"}
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
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="text-white font-bold text-lg">Sign In</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => router.replace('/')} // Go back to switch studio
                        className="mt-4 items-center"
                    >
                        <Text className="text-gray-500 text-sm">Switch Studio</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
}
