import '../global.css';
import { Stack } from 'expo-router';
import { AuthProvider } from '../context/AuthContext';
import { TenantProvider } from '../context/TenantContext';
import { View } from 'react-native';

export default function RootLayout() {
  return (
    <TenantProvider>
      <AuthProvider>
        <View className="flex-1 bg-white">
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" options={{ gestureEnabled: false }} />
            <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
          </Stack>
        </View>
      </AuthProvider>
    </TenantProvider>
  );
}
