import { View, Text, SafeAreaView, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { apiRequest } from '../../lib/api';
import { Ionicons } from '@expo/vector-icons';

export default function ClassDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [classData, setClassData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        loadClass();
    }, [id]);

    const loadClass = async () => {
        try {
            const data = await apiRequest(`/classes/${id}`);
            setClassData(data);
        } catch (e) {
            Alert.alert('Error', 'Failed to load class details');
            router.back();
        } finally {
            setLoading(false);
        }
    };

    const handleBook = async () => {
        setProcessing(true);
        try {
            // Check if already booked
            if (classData.userBookingStatus) {
                // If booked, maybe cancel?
                // For MVP, just show status, maybe allow cancel via a different button or "Manage"
                Alert.alert('Info', 'You are already booked/waitlisted.');
                return;
            }

            await apiRequest('/bookings', {
                method: 'POST',
                body: JSON.stringify({ classId: id })
            });
            Alert.alert('Success', 'Class booked successfully!');
            router.back();
            // Or reload to show status
            // loadClass();
        } catch (e: any) {
            Alert.alert('Booking Failed', e.message);
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-white justify-center items-center">
                <ActivityIndicator size="large" color="black" />
            </SafeAreaView>
        );
    }

    if (!classData) return null;

    const date = new Date(classData.startTime);
    const instructorName = classData.instructor?.user?.profile
        ? `${classData.instructor.user.profile.firstName} ${classData.instructor.user.profile.lastName}`
        : 'Instructor';

    const isBooked = !!classData.userBookingStatus;

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="relative">
                {/* Back Button */}
                <TouchableOpacity
                    onPress={() => router.back()}
                    className="absolute top-4 left-4 z-10 bg-white/80 p-2 rounded-full"
                >
                    <Ionicons name="arrow-back" size={24} color="black" />
                </TouchableOpacity>

                {/* Hero Image or Placeholder */}
                <View className="h-64 bg-zinc-200 w-full items-center justify-center">
                    {classData.thumbnailUrl ? (
                        <Image source={{ uri: classData.thumbnailUrl }} className="w-full h-full" resizeMode="cover" />
                    ) : (
                        <View className="items-center">
                            <Text className="text-4xl">🧘</Text>
                        </View>
                    )}
                </View>
            </View>

            <ScrollView className="flex-1 px-6 pt-6">
                <Text className="text-3xl font-bold text-zinc-900 mb-2">{classData.title}</Text>

                <View className="flex-row items-center mb-4">
                    <View className="bg-zinc-100 px-3 py-1 rounded-md mr-2">
                        <Text className="text-zinc-700 font-medium">
                            {date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} • {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                    <View className="bg-zinc-100 px-3 py-1 rounded-md">
                        <Text className="text-zinc-700 font-medium">{classData.durationMinutes} min</Text>
                    </View>
                </View>

                <View className="flex-row items-center mb-6">
                    <View className="w-10 h-10 bg-zinc-200 rounded-full items-center justify-center mr-3">
                        <Text className="font-bold text-zinc-600">{instructorName[0]}</Text>
                    </View>
                    <View>
                        <Text className="text-zinc-900 font-bold">{instructorName}</Text>
                        <Text className="text-zinc-500 text-sm">Instructor</Text>
                    </View>
                </View>

                <Text className="text-zinc-800 leading-6 mb-8 text-lg">
                    {classData.description || "Join us for an energizing session focusing on strength, flexibility, and mindfulness."}
                </Text>

                {/* Additional Info items like Location could go here */}

            </ScrollView>

            <View className="p-6 border-t border-zinc-100 safe-bottom">
                <TouchableOpacity
                    onPress={handleBook}
                    disabled={isBooked || processing}
                    className={`w-full py-4 rounded-xl items-center flex-row justify-center ${isBooked ? 'bg-green-600' : 'bg-black'}`}
                >
                    {processing ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text className="text-white font-bold text-lg">
                            {isBooked ? (classData.userBookingStatus === 'waitlisted' ? 'Waitlisted' : 'Booked') : 'Book Class'}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
