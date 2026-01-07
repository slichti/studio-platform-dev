import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@studio/ui';

export default function LoginScreen() {
    const handleLogin = (role: 'student' | 'instructor') => {
        // Mock login logic
        if (role === 'student') {
            router.replace('/(student)');
        } else {
            router.replace('/(instructor)');
        }
    };

    return (
        <View className="flex-1 justify-center items-center p-4 bg-white">
            <Text className="text-2xl font-bold mb-8">Studio Mobile</Text>

            <View className="w-full gap-4">
                <Button
                    label="Login as Student"
                    onPress={() => handleLogin('student')}
                />
                <Button
                    label="Login as Instructor"
                    variant="secondary"
                    onPress={() => handleLogin('instructor')}
                />
            </View>
        </View>
    );
}
