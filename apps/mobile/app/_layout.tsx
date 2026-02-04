import '../global.css';
import { Stack, useRouter } from 'expo-router';
import { AuthProvider } from '../context/AuthContext';
import { TenantProvider } from '../context/TenantContext';
import { View, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

// Configure standard behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Note: Permission request & Token registration is handled in AuthContext upon login.

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log("Notification Received:", notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log("Notification Responded:", response);
      const data = response.notification.request.content.data as { url?: string };
      if (data?.url) {
        try {
          // Handle deep link (e.g. /class/123)
          // Ensure it's a relative path or handle scheme
          const path = data.url.replace(/^.*:\/\//, ''); // rudimentary strip scheme
          router.push(path as any);
        } catch (e) {
          console.error("Deep link failed", e);
        }
      }
    });

    return () => {
      if (notificationListener.current) notificationListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
    };
  }, []);

  return (
    <TenantProvider>
      <AuthProvider>
        <View className="flex-1 bg-white">
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" options={{ gestureEnabled: false }} />
            <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
            <Stack.Screen name="class/[id]" options={{ presentation: 'modal' }} />
          </Stack>
        </View>
      </AuthProvider>
    </TenantProvider>
  );
}


