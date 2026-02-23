import { View, Text, SafeAreaView, SectionList, TouchableOpacity, RefreshControl, ActivityIndicator, ScrollView } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../lib/api';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

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

    // Filters
    const [selectedInstructor, setSelectedInstructor] = useState<string | null>(null);
    const [selectedInstructorId, setSelectedInstructorId] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [instructors, setInstructors] = useState<string[]>([]);
    const [instructorIds, setInstructorIds] = useState<Record<string, string>>({});
    const [categories, setCategories] = useState<string[]>([]);

    const fetchSchedule = useCallback(async () => {
        try {
            const start = new Date();
            const end = new Date();
            end.setDate(end.getDate() + 14); // Next 2 weeks

            const params = new URLSearchParams({
                startDate: start.toISOString(),
                endDate: end.toISOString()
            });
            if (selectedInstructorId) params.set('instructorId', selectedInstructorId);
            if (selectedCategory && ['class', 'workshop', 'event', 'appointment', 'course'].includes(selectedCategory)) {
                params.set('category', selectedCategory);
            }
            const data = await apiRequest(`/classes?${params.toString()}`);
            setClasses(data);

            // Extract unique instructors (name -> id) and categories
            const insts = new Set<string>();
            const idMap: Record<string, string> = {};
            const cats = new Set<string>();
            data.forEach((c: any) => {
                const name = c.instructor?.user?.profile ? `${c.instructor.user.profile.firstName} ${c.instructor.user.profile.lastName}` : 'Staff';
                insts.add(name);
                if (c.instructor?.id) idMap[name] = c.instructor.id;
                if (c.category) cats.add(c.category);
                else if (c.type) cats.add(c.type);
                else cats.add('General');
            });
            setInstructors(Array.from(insts));
            setInstructorIds(idMap);
            setCategories(Array.from(cats));

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedInstructorId, selectedCategory]);

    useEffect(() => {
        fetchSchedule();
    }, [fetchSchedule]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchSchedule();
    };

    const filteredClasses = classes.filter(c => {
        const name = c.instructor?.user?.profile ? `${c.instructor.user.profile.firstName} ${c.instructor.user.profile.lastName}` : 'Staff';
        const matchesInstructor = !selectedInstructor || name === selectedInstructor;
        const matchesCategory = !selectedCategory || (c as any).category === selectedCategory || (selectedCategory === 'General' && !(c as any).category);
        return matchesInstructor && matchesCategory;
    });

    const groupedData = filteredClasses.reduce((acc: any, curr) => {
        const date = new Date(curr.startTime);
        const day = date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
        if (!acc[day]) acc[day] = [];
        acc[day].push(curr);
        return acc;
    }, {});

    const sections = Object.keys(groupedData).map(day => ({
        title: day,
        data: groupedData[day]
    }));

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
                className="bg-white p-4 rounded-xl border border-zinc-100 mb-3 flex-row justify-between items-center shadow-sm"
                onPress={() => router.push(`/class/${item.id}`)}
            >
                <View className="flex-1">
                    <Text className="text-zinc-500 text-xs mb-1 uppercase font-bold">{time}</Text>
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
            <View className="px-6 pt-4 pb-4 bg-white">
                <Text className="text-2xl font-bold text-zinc-900">Schedule</Text>
            </View>

            {/* Filters */}
            <View className="mb-2">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-6 pb-2">
                    {/* Category Filter */}
                    <TouchableOpacity
                        onPress={() => {
                            Haptics.selectionAsync();
                            setSelectedCategory(null);
                        }}
                        className={`mr-2 px-4 py-2 rounded-full border ${!selectedCategory ? 'bg-black border-black' : 'bg-white border-zinc-200'}`}
                    >
                        <Text className={`text-xs font-bold ${!selectedCategory ? 'text-white' : 'text-zinc-600'}`}>All</Text>
                    </TouchableOpacity>
                    {categories.map(cat => (
                        <TouchableOpacity
                            key={cat}
                            onPress={() => {
                                Haptics.selectionAsync();
                                setSelectedCategory(cat);
                            }}
                            className={`mr-2 px-4 py-2 rounded-full border ${selectedCategory === cat ? 'bg-black border-black' : 'bg-white border-zinc-200'}`}
                        >
                            <Text className={`text-xs font-bold ${selectedCategory === cat ? 'text-white' : 'text-zinc-600'}`}>{cat}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-6 pb-4">
                    {/* Instructor Filter */}
                    <TouchableOpacity
                        onPress={() => {
                            Haptics.selectionAsync();
                            setSelectedInstructor(null);
                            setSelectedInstructorId(null);
                        }}
                        className={`mr-2 px-4 py-2 rounded-full border ${!selectedInstructor ? 'bg-zinc-800 border-zinc-800' : 'bg-zinc-50 border-zinc-100'}`}
                    >
                        <Text className={`text-xs font-bold ${!selectedInstructor ? 'text-white' : 'text-zinc-500'}`}>Any Instructor</Text>
                    </TouchableOpacity>
                    {instructors.map(name => (
                        <TouchableOpacity
                            key={name}
                            onPress={() => {
                                Haptics.selectionAsync();
                                setSelectedInstructor(name);
                                setSelectedInstructorId(instructorIds[name] ?? null);
                            }}
                            className={`mr-2 px-4 py-2 rounded-full border ${selectedInstructor === name ? 'bg-zinc-800 border-zinc-800' : 'bg-zinc-50 border-zinc-100'}`}
                        >
                            <Text className={`text-xs font-bold ${selectedInstructor === name ? 'text-white' : 'text-zinc-500'}`}>{name}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <View className="h-[1px] bg-zinc-100 w-full" />
            {loading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator color="black" />
                </View>
            ) : (
                <SectionList
                    sections={sections}
                    renderItem={renderItem}
                    renderSectionHeader={({ section: { title } }) => (
                        <Text className="text-zinc-900 font-bold text-lg bg-white pt-4 pb-2 px-1">{title}</Text>
                    )}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 16 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    stickySectionHeadersEnabled={false}
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
