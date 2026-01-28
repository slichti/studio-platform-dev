import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, SafeAreaView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTenant } from '../context/TenantContext';

export default function Index() {
    const router = useRouter();
    const { slug, setSlug, isLoading } = useTenant();
    const [code, setCode] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!isLoading && slug) {
            // Already have a studio selected, go to login
            router.replace('/(auth)/login');
        }
    }, [isLoading, slug]);

    const handleContinue = async () => {
        if (!code.trim()) {
            Alert.alert('Error', 'Please enter a Studio Code');
            return;
        }

        setSubmitting(true);
        try {
            // Verify if studio exists?
            // Optional: Call public API to check slug validity.
            // For now, just save it.
            await setSlug(code.toLowerCase().trim());
            // Redirect happens via useEffect or manual
            router.replace('/(auth)/login');
        } catch (e) {
            Alert.alert('Error', 'Failed to save studio code');
        } finally {
            setSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color="#000" />
            </View>
        );
    }

    // If slug exists, we are redirecting...
    if (slug) return null;

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-1 px-8 justify-center">
                <View className="items-center mb-12">
                    <View className="w-24 h-24 bg-black rounded-3xl mb-6 items-center justify-center">
                        <Text className="text-white text-3xl font-bold">S</Text>
                    </View>
                    <Text className="text-3xl font-bold text-gray-900 text-center">
                        Studio Platform
                    </Text>
                    <Text className="text-gray-500 text-center mt-2 px-4">
                        Enter your studio code or scan the QR code to get started.
                    </Text>
                </View>

                <View className="space-y-4">
                    <View>
                        <Text className="text-gray-700 font-medium mb-1 ml-1">Studio Code</Text>
                        <TextInput
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-900 text-lg"
                            placeholder="e.g. yoga-central"
                            autoCapitalize="none"
                            autoCorrect={false}
                            value={code}
                            onChangeText={setCode}
                        />
                    </View>

                    <TouchableOpacity
                        onPress={handleContinue}
                        className="w-full bg-black py-4 rounded-xl items-center mt-2"
                        disabled={submitting}
                    >
                        {submitting ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="text-white font-bold text-lg">Continue</Text>
                        )}
                    </TouchableOpacity>

                    {/* Placeholder for QR Logic */}
                    <TouchableOpacity
                        className="w-full py-4 rounded-xl items-center mt-2 border border-gray-200"
                        onPress={() => Alert.alert('Coming Soon', 'QR Scanning implementation pending')}
                    >
                        <Text className="text-gray-700 font-medium">Scan QR Code</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}
