
import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../lib/api';

type Booking = {
    id: string;
    status: 'confirmed' | 'waitlisted' | 'cancelled';
    waitlistPosition?: number;
    waitlistNotifiedAt?: string;
    class: {
        title: string;
        startTime: string;
        endTime: string;
        instructor: string;
    }
};

export default function ScheduleScreen() {
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchBookings = useCallback(async () => {
        try {
            const data = await apiRequest('/bookings/my-upcoming');
            setBookings(data);
        } catch (e) {
            console.error(e);
            // Optionally show error, but silent fail on refresh is standard
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchBookings();
    }, [fetchBookings]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchBookings();
    }, [fetchBookings]);

    const acceptSpot = async (bookingId: string) => {
        try {
            await apiRequest(`/bookings/waitlist/${bookingId}/accept`, { method: 'POST' });
            Alert.alert("Success", "You have accepted the spot!");
            fetchBookings(); // Refresh list to show confirmed status
        } catch (e: any) {
            Alert.alert("Error", e.message || "Failed to accept spot");
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString() + ", " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="px-6 pt-4 pb-2 border-b border-zinc-100">
                <Text className="text-2xl font-bold text-zinc-900">Schedule</Text>
            </View>
            <ScrollView
                className="flex-1 px-4 pt-4"
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {loading && bookings.length === 0 ? (
                    <Text className="text-zinc-500 text-center mt-10">Loading classes...</Text>
                ) : bookings.length === 0 ? (
                    <View className="items-center mt-10">
                        <Text className="text-zinc-500">No upcoming classes.</Text>
                        <Text className="text-zinc-400 text-sm mt-2">Book a class from the Home tab!</Text>
                    </View>
                ) : (
                    <View className="space-y-4 pb-10">
                        {bookings.map((booking) => (
                            <View
                                key={booking.id}
                                className={`bg-white p-4 rounded-xl border shadow-sm ${booking.status === 'waitlisted' ? 'border-amber-100 opacity-90' : 'border-zinc-100'}`}
                            >
                                <View className="flex-row justify-between mb-2">
                                    <View className="flex-1 mr-2">
                                        <Text className="font-bold text-lg text-zinc-900" numberOfLines={1}>{booking.class.title}</Text>
                                    </View>
                                    <View className={`px-2 py-1 rounded ${booking.status === 'confirmed' ? 'bg-green-100' : 'bg-amber-100'}`}>
                                        <Text className={`text-xs font-bold uppercase ${booking.status === 'confirmed' ? 'text-green-700' : 'text-amber-700'}`}>
                                            {booking.status === 'waitlisted' ? `Waitlist #${booking.waitlistPosition}` : 'Confirmed'}
                                        </Text>
                                    </View>
                                </View>
                                <Text className="text-zinc-500 mb-1">{formatDate(booking.class.startTime)}</Text>
                                <Text className="text-zinc-400 text-xs">Instructor: {booking.class.instructor}</Text>

                                {/* Waitlist Offer Logic */}
                                {booking.status === 'waitlisted' && booking.waitlistNotifiedAt && (
                                    <View className="mt-3 bg-amber-50 p-2 rounded border border-amber-100">
                                        <Text className="text-amber-800 text-xs mb-2">
                                            Good news! A spot has opened up for you.
                                            Tap 'Accept' to confirm your spot.
                                        </Text>
                                        <TouchableOpacity
                                            className="bg-amber-500 py-2 px-4 rounded-lg items-center"
                                            onPress={() => acceptSpot(booking.id)}
                                        >
                                            <Text className="text-white font-bold text-sm">Accept Spot</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        ))}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
