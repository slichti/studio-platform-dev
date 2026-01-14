
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const { signOut } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="px-6 pt-4">
        <View className="flex-row justify-between items-center mb-8">
          <View>
            <Text className="text-zinc-500 font-medium">Welcome back,</Text>
            <Text className="text-2xl font-bold text-zinc-900">Student</Text>
          </View>
          <TouchableOpacity
            onPress={() => signOut()}
            className="bg-zinc-100 p-2 rounded-full"
          >
            {/* Avatar Placeholder */}
            <View className="w-8 h-8 rounded-full bg-zinc-300" />
          </TouchableOpacity>
        </View>

        {/* Stats / Highlights */}
        <View className="flex-row gap-4 mb-8">
          <View className="flex-1 bg-black p-4 rounded-2xl">
            <Text className="text-white/60 text-sm font-medium">Upcoming</Text>
            <Text className="text-white text-lg font-bold mt-1">Yoga Flow</Text>
            <Text className="text-white/80 text-xs mt-1">Today, 5:00 PM</Text>
          </View>
          <View className="flex-1 bg-zinc-100 p-4 rounded-2xl">
            <Text className="text-zinc-500 text-sm font-medium">Credits</Text>
            <Text className="text-zinc-900 text-2xl font-bold mt-1">3 <Text className="text-sm font-normal text-zinc-500">left</Text></Text>
          </View>
        </View>

        {/* Action Items */}
        <Text className="text-lg font-bold text-zinc-900 mb-4">Quick Actions</Text>
        <View className="flex-row gap-4">
          <TouchableOpacity className="flex-1 aspect-square bg-blue-50 rounded-2xl justify-center items-center border border-blue-100">
            <Text className="text-blue-700 font-bold">Book Class</Text>
          </TouchableOpacity>
          <TouchableOpacity className="flex-1 aspect-square bg-orange-50 rounded-2xl justify-center items-center border border-orange-100">
            <Text className="text-orange-700 font-bold">Buy Pass</Text>
          </TouchableOpacity>
          <TouchableOpacity className="flex-1 aspect-square bg-green-50 rounded-2xl justify-center items-center border border-green-100">
            <Text className="text-green-700 font-bold">Check In</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
