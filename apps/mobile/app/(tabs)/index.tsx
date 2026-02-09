import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { apiRequest } from '../../lib/api';
import { useFocusEffect } from '@react-navigation/native';

export default function HomeScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [upcoming, setUpcoming] = useState<any>(null);
  const [credits, setCredits] = useState(0);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch Member Profile & Credits
      const memberData = await apiRequest('/members/me');
      if (memberData?.member) {
        setProfile(memberData.member);
        // Calculate total remaining credits
        const packs = memberData.member.purchasedPacks || [];
        const total = packs.reduce((acc: number, p: any) => acc + (p.remainingCredits || 0), 0);
        setCredits(total);
      }

      // Fetch Upcoming
      const upcomingData = await apiRequest('/bookings/my-upcoming');
      if (Array.isArray(upcomingData) && upcomingData.length > 0) {
        setUpcoming(upcomingData[0]);
      } else {
        setUpcoming(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="px-6 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View className="flex-row justify-between items-center mb-8">
          <View>
            <Text className="text-zinc-500 font-medium">Welcome back,</Text>
            {loading && !profile ? (
              <View className="h-8 w-32 bg-zinc-100 rounded animate-pulse mt-1" />
            ) : (
              <Text className="text-2xl font-bold text-zinc-900">
                {profile?.user?.profile?.firstName || 'Student'}
              </Text>
            )}
          </View>
          <TouchableOpacity
            testID="header-sign-out-btn"
            onPress={() => signOut()}
            className="bg-zinc-100 p-2 rounded-full"
          >
            {profile?.user?.profile?.portraitUrl ? (
              <View className="w-8 h-8 rounded-full overflow-hidden">
                {/* Image component would go here, using View for now */}
                <View className="w-full h-full bg-zinc-300" />
              </View>
            ) : (
              <View className="w-8 h-8 rounded-full bg-zinc-300 items-center justify-center">
                <Text className="text-zinc-500 text-xs font-bold">
                  {(profile?.user?.profile?.firstName || 'S')[0]}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Stats / Highlights */}
        <View className="flex-row gap-4 mb-8">
          <TouchableOpacity
            className="flex-1 bg-black p-4 rounded-2xl shadow-sm min-h-[120px] justify-between"
            onPress={() => router.push('/(tabs)/schedule')}
          >
            <Text className="text-white/60 text-sm font-medium uppercase tracking-wider">Upcoming</Text>
            {loading ? (
              <ActivityIndicator color="white" />
            ) : upcoming ? (
              <View>
                <Text className="text-white text-lg font-bold leading-tight mb-1" numberOfLines={2}>
                  {upcoming.class.title}
                </Text>
                <Text className="text-white/80 text-xs">
                  {new Date(upcoming.class.startTime).toLocaleDateString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
                </Text>
              </View>
            ) : (
              <View>
                <Text className="text-white text-lg font-bold">No classes</Text>
                <Text className="text-white/60 text-xs">Book now</Text>
              </View>
            )}
          </TouchableOpacity>

          <View className="flex-1 bg-zinc-100 p-4 rounded-2xl border border-zinc-200 min-h-[120px] justify-between">
            <Text className="text-zinc-500 text-sm font-medium uppercase tracking-wider">Credits</Text>
            {loading ? (
              <ActivityIndicator color="black" />
            ) : (
              <Text className="text-zinc-900 text-3xl font-bold">
                {credits} <Text className="text-sm font-normal text-zinc-500">left</Text>
              </Text>
            )}
          </View>
        </View>

        {/* Action Items */}
        <Text className="text-lg font-bold text-zinc-900 mb-4">Quick Actions</Text>
        <View className="flex-row gap-4">

          <TouchableOpacity
            className="flex-1 aspect-square bg-blue-50 rounded-2xl justify-center items-center border border-blue-100 active:bg-blue-100"
            onPress={() => router.push('/(tabs)/schedule')}
          >
            <Text className="text-blue-700 font-bold mt-2">Book Class</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 aspect-square bg-orange-50 rounded-2xl justify-center items-center border border-orange-100 active:bg-orange-100"
            onPress={() => router.push('/(tabs)/shop')}
          >
            <Text className="text-orange-700 font-bold mt-2">Buy Pass</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 aspect-square bg-green-50 rounded-2xl justify-center items-center border border-green-100 active:bg-green-100"
            onPress={() => router.push('/(instructor)/scan')}
          // Note: Scan is usually for instructors, but for student check-in maybe QR code?
          // Using scan route for now as per button
          >
            <Text className="text-green-700 font-bold mt-2">Check In</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
