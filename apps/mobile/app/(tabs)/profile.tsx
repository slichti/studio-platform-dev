import { View, Text, SafeAreaView, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { LogOut, Settings, CreditCard, Bell, Users } from 'lucide-react-native';
import StreakCard from '../../components/StreakCard';
import { useRouter, Link } from 'expo-router';

export default function ProfileScreen() {
    const { signOut } = useAuth();
    const router = useRouter();

    const [myBookings, setMyBookings] = useState<any[]>([]);
    const [user, setUser] = useState<any>(null);
    const [streak, setStreak] = useState<{ currentStreak?: number; longestStreak?: number }>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [bookingsData, userData, streakData] = await Promise.all([
                apiRequest('/bookings/my-upcoming'),
                apiRequest('/tenant/me'),
                apiRequest('/members/me/streak').catch(() => ({ currentStreak: 0, longestStreak: 0 }))
            ]);
            setMyBookings(bookingsData);
            setUser(userData);
            setStreak(Array.isArray(streakData) ? {} : (streakData || {}));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const renderBooking = (booking: any) => {
        const date = new Date(booking.class.startTime);
        return (
            <View key={booking.id} className="bg-zinc-50 p-4 rounded-xl border border-zinc-100 mb-2">
                <Text className="font-bold text-zinc-900">{booking.class.title}</Text>
                <Text className="text-zinc-500 text-sm">
                    {date.toLocaleDateString()} • {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <View className="mt-2 flex-row">
                    <View className={`px-2 py-0.5 rounded ${booking.status === 'confirmed' ? 'bg-green-100' : 'bg-amber-100'}`}>
                        <Text className={`text-xs font-bold uppercase ${booking.status === 'confirmed' ? 'text-green-700' : 'text-amber-700'}`}>
                            {booking.status}
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    const menuItems = [
        { icon: CreditCard, label: 'Payment Methods', href: '/(tabs)/shop' },
        { icon: Bell, label: 'Notifications', href: '/settings/notifications' },
        { icon: Users, label: 'Refer & Earn', href: '/(tabs)/referrals' },
        { icon: Settings, label: 'App Settings', href: '/(tabs)/profile' }, // Fallback
    ];

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="px-6 pt-4 mb-6">
                <Text className="text-2xl font-bold text-zinc-900">Profile</Text>
            </View>

            <ScrollView className="flex-1 px-4">
                {/* User Info Card */}
                <View className="bg-zinc-50 p-6 rounded-2xl border border-zinc-100 mb-6 flex-row items-center gap-4">
                    <View className="w-16 h-16 rounded-full bg-zinc-200 items-center justify-center">
                        <Text className="text-2xl font-bold text-zinc-400">
                            {user?.firstName?.[0] || 'U'}
                        </Text>
                    </View>
                    <View>
                        <Text className="text-lg font-bold text-zinc-900">
                            {user?.firstName} {user?.lastName}
                        </Text>
                        <Text className="text-zinc-500">{user?.user?.email || 'Member'}</Text>
                    </View>
                </View>

                {/* Streak (from GET /members/me/streak) */}
                <StreakCard streak={streak?.currentStreak ?? user?.stats?.currentStreak ?? 0} />

                <View className="mb-8">
                    <Text className="text-lg font-bold text-zinc-900 mb-4">My Bookings</Text>
                    {loading ? (
                        <Text className="text-zinc-400">Loading...</Text>
                    ) : myBookings.length === 0 ? (
                        <Text className="text-zinc-400">No upcoming bookings.</Text>
                    ) : (
                        myBookings.map(renderBooking)
                    )}
                </View>

                <View className="mb-8">
                    {menuItems.map((item, index) => (
                        <Link key={index} href={item.href as any} asChild>
                            <TouchableOpacity className="flex-row items-center p-4 bg-white border border-zinc-100 rounded-xl mb-2">
                                <item.icon size={20} stroke="#18181b" className="mr-3" />
                                <Text className="flex-1 font-medium text-zinc-900">{item.label}</Text>
                            </TouchableOpacity>
                        </Link>
                    ))}
                </View>

                {/* Logout */}
                <TouchableOpacity
                    testID="sign-out-mem-btn"
                    onPress={() => signOut()}
                    className="flex-row items-center justify-center p-4 mt-auto mb-4 bg-zinc-100 rounded-xl"
                >
                    <LogOut size={20} stroke="#18181b" className="mr-2" />
                    <Text className="font-bold text-zinc-900">Sign Out</Text>
                </TouchableOpacity>

                {/* Delete Account */}
                <TouchableOpacity
                    onPress={() => {
                        Alert.alert(
                            "Delete Account",
                            "Are you sure you want to delete your account? This action is permanent and cannot be undone.",
                            [
                                { text: "Cancel", style: "cancel" },
                                {
                                    text: "Delete",
                                    style: "destructive",
                                    onPress: async () => {
                                        setLoading(true);
                                        try {
                                            await apiRequest('/users/me', { method: 'DELETE' });
                                            await signOut();
                                        } catch (e: any) {
                                            Alert.alert("Error", e.message || "Failed to delete account");
                                            setLoading(false);
                                        }
                                    }
                                }
                            ]
                        );
                    }}
                    className="flex-row items-center justify-center p-4 mb-8 bg-red-50 rounded-xl"
                >
                    <Text className="font-bold text-red-600">Delete Account</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}
