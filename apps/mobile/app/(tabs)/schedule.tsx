import { View, Text, SafeAreaView, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../lib/api';
import { useRouter } from 'expo-router';

type ClassSession = {
    id: string;
    title: string;
    startTime: string;
    instructor: {
        user: {
            profile: { firstName: string; lastName: string; }
        }
    };
    capacity: number;
    confirmedCount: number;
    userBookingStatus: 'confirmed' | 'waitlisted' | null;
};

export default function ScheduleScreen() {
    const router = useRouter();
    const [classes, setClasses] = useState<ClassSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchSchedule = useCallback(async () => {
        try {
            const start = new Date();
            const end = new Date();
            end.setDate(end.getDate() + 14); // Next 2 weeks

            const query = `?startDate=${start.toISOString()}&endDate=${end.toISOString()}&includeArchived=false`;
            const data = await apiRequest(`/classes${query}`);
            setClasses(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchSchedule();
    }, [fetchSchedule]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchSchedule();
    };

    const renderItem = ({ item }: { item: ClassSession }) => {
        const date = new Date(item.startTime);
        const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const instructorName = item.instructor?.user?.profile
            ? `${item.instructor.user.profile.firstName} ${item.instructor.user.profile.lastName}`
            : 'Instructor';

        const isBooked = !!item.userBookingStatus;
        const isFull = (item.capacity && item.confirmedCount >= item.capacity);

        return (
            <TouchableOpacity
                className="bg-white p-4 rounded-xl border border-zinc-100 mb-3 flex-row justify-between items-center"
                onPress={() => router.push(`/class/${item.id}`)}
            >
                <View className="flex-1">
                    <Text className="text-zinc-500 text-xs mb-1 uppercase font-bold">{date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} • {time}</Text>
                    <Text className="text-lg font-bold text-zinc-900 mb-1">{item.title}</Text>
                    <Text className="text-zinc-500 text-sm">{instructorName}</Text>
                </View>

                <View>
                    {isBooked ? (
                        <View className="bg-green-100 px-3 py-1 rounded-full">
                            <Text className="text-green-700 text-xs font-bold uppercase">{item.userBookingStatus}</Text>
                        </View>
                    ) : (
                        <View className={`px-3 py-1 rounded-full ${isFull ? 'bg-zinc-100' : 'bg-black'}`}>
                            <Text className={`text-xs font-bold uppercase ${isFull ? 'text-zinc-400' : 'text-white'}`}>
                                {isFull ? 'Full' : 'Book'}
                            </Text>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="px-6 pt-4 pb-4 border-b border-zinc-100 bg-white">
                <Text className="text-2xl font-bold text-zinc-900">Schedule</Text>
            </View>
            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator color="black" />
                </View>
            ) : (
                <FlatList
                    data={classes}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 16 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListEmptyComponent={
                        <View className="items-center mt-20">
                            <Text className="text-zinc-400">No upcoming classes scheduled.</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}
