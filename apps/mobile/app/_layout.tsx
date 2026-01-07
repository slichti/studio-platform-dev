import '../global.css';
import { Slot, Stack } from 'expo-router';
import { View } from 'react-native';

export default function RootLayout() {
  // In a real app, we would wrap this with ClerkProvider
  // For now, simple layout
  return (
    <View className="flex-1 bg-white">
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
