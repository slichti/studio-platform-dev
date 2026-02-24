import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useCallback, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { useFocusEffect } from '@react-navigation/native';
import { useOnboarding } from '../../hooks/useOnboarding';
import { Bell, Calendar, X, BookOpen } from 'lucide-react-native';

export default function HomeScreen() {
  const router = useRouter();
  const { signOut, requestPushAndRegister } = useAuth();
  const {
    showOnboarding,
    firstBooked,
    notificationsEnabled,
    hydrated,
    markFirstBooked,
    markNotificationsEnabled,
    markDismissed,
  } = useOnboarding();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [upcoming, setUpcoming] = useState<any>(null);
  const [credits, setCredits] = useState(0);
  const [streak, setStreak] = useState<{ current?: number } | null>(null);
  const [latestBlog, setLatestBlog] = useState<any>(null);
  const [notificationsRequesting, setNotificationsRequesting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const memberData = await apiRequest('/members/me');
      if (memberData?.member) {
        setProfile(memberData.member);
        const packs = memberData.member.purchasedPacks || [];
        const total = packs.reduce((acc: number, p: any) => acc + (p.remainingCredits || 0), 0);
        setCredits(total);
      }

      const [upcomingData, blogData] = await Promise.all([
        apiRequest('/bookings/my-upcoming'),
        apiRequest('/community?type=blog&limit=1')
      ]);

      if (Array.isArray(upcomingData) && upcomingData.length > 0) {
        setUpcoming(upcomingData[0]);
      } else {
        setUpcoming(null);
      }

      if (Array.isArray(blogData) && blogData.length > 0) {
        setLatestBlog(blogData[0]);
      } else {
        setLatestBlog(null);
      }

      try {
        const streakData = await apiRequest('/members/me/streak');
        setStreak(streakData ?? null);
      } catch {
        setStreak(null);
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

  const hasBooked = !!upcoming || (Number(streak?.current) ?? 0) > 0;
  useEffect(() => {
    if (hydrated && hasBooked && !firstBooked) markFirstBooked();
  }, [hydrated, hasBooked, firstBooked, markFirstBooked]);

  const showOnboardingCard = hydrated && showOnboarding && !loading && !upcoming && (Number(streak?.current) ?? 0) === 0;

  const handleEnableNotifications = async () => {
    setNotificationsRequesting(true);
    try {
      const ok = await requestPushAndRegister();
      if (ok) await markNotificationsEnabled();
    } finally {
      setNotificationsRequesting(false);
    }
  };

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

        {/* First 7 days onboarding */}
        {showOnboardingCard && (
          <View className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
            <View className="flex-row justify-between items-start mb-3">
              <Text className="text-lg font-bold text-amber-900">Get the most out of your first week</Text>
              <TouchableOpacity onPress={markDismissed} hitSlop={12} className="p-1">
                <X size={18} color="#92400e" />
              </TouchableOpacity>
            </View>
            <Text className="text-amber-800 text-sm mb-4">Book a class, turn on reminders, and we’ll help you stay on track.</Text>
            <View className="gap-3">
              <TouchableOpacity
                className="flex-row items-center gap-3 py-3 px-4 bg-white rounded-xl border border-amber-200"
                onPress={() => router.push('/(tabs)/schedule')}
              >
                <View className="w-10 h-10 rounded-full bg-amber-100 items-center justify-center">
                  <Calendar size={20} color="#b45309" />
                </View>
                <View className="flex-1">
                  <Text className="font-semibold text-zinc-900">Book your first class</Text>
                  <Text className="text-zinc-500 text-xs">See the schedule and pick a time</Text>
                </View>
              </TouchableOpacity>
              {!notificationsEnabled && (
                <TouchableOpacity
                  className="flex-row items-center gap-3 py-3 px-4 bg-white rounded-xl border border-amber-200"
                  onPress={handleEnableNotifications}
                  disabled={notificationsRequesting}
                >
                  <View className="w-10 h-10 rounded-full bg-amber-100 items-center justify-center">
                    <Bell size={20} color="#b45309" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-semibold text-zinc-900">Enable notifications</Text>
                    <Text className="text-zinc-500 text-xs">Reminders and streak nudges</Text>
                  </View>
                  {notificationsRequesting && <ActivityIndicator size="small" color="#b45309" />}
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={markDismissed} className="mt-3 py-2">
              <Text className="text-amber-700 text-sm font-medium text-center">Maybe later</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Action Items */}
        <Text className="text-lg font-bold text-zinc-900 mb-4">Quick Actions</Text>
        <View className="flex-row gap-4 mb-8">

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

        {/* Recent Insights (Local Blogging) */}
        {latestBlog && (
          <View className="mb-8">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-bold text-zinc-900">Recent Insights</Text>
              <TouchableOpacity>
                <Text className="text-zinc-500 text-sm font-medium">See all</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              className="bg-white border border-zinc-200 rounded-3xl overflow-hidden shadow-sm"
              activeOpacity={0.9}
            >
              {latestBlog.imageUrl && (
                <View className="h-40 bg-zinc-100">
                  <View className="w-full h-full bg-zinc-200" />
                </View>
              )}
              <View className="p-5">
                <View className="flex-row items-center gap-2 mb-2">
                  <View className="px-2 py-1 bg-indigo-50 rounded-md">
                    <Text className="text-indigo-600 text-[10px] font-bold uppercase tracking-wider">New Article</Text>
                  </View>
                  <Text className="text-zinc-400 text-xs">{new Date(latestBlog.createdAt).toLocaleDateString()}</Text>
                </View>
                <Text className="text-lg font-bold text-zinc-900 mb-2">
                  {latestBlog.content?.match(/^## (.*)\n/)?.[1] || 'Untitled Article'}
                </Text>
                <Text className="text-zinc-500 text-sm leading-relaxed" numberOfLines={2}>
                  {latestBlog.content?.replace(/^## .*\n/, '').replace(/[#\*`\n]/g, '').trim()}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}
