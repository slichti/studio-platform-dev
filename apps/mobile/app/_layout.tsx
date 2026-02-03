import '../global.css';
import { Stack } from 'expo-router';
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

  useEffect(() => {
    registerForPushNotificationsAsync();

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log("Notification Received:", notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log("Notification Responded:", response);
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

async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }

    // Project ID is handled automatically in managed workflow usually, but good practice if using bare
    const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    console.log("Expo Push Token:", token);

    // We should save this token to the user profile via AuthContext, but let's do it in the AuthProvider or Login flow effectively.
    // For now, we store in global specific storage or pass to context.
  }
}
