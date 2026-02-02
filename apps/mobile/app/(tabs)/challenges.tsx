
import { View, Text, SafeAreaView, ScrollView, RefreshControl } from 'react-native';
import { Trophy, Flame, Check } from 'lucide-react-native';
import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../../lib/api';

type Challenge = {
    id: string;
    title: string;
    description: string;
    type: 'count' | 'streak';
    targetValue: number;
    startDate?: string;
    endDate?: string;
    userProgress: {
        progress: number;
        status: string;
    };
};

export default function ChallengesScreen() {
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchChallenges = useCallback(async () => {
        try {
            const data = await apiRequest('/challenges/my-progress');
            setChallenges(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchChallenges();
    }, [fetchChallenges]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchChallenges();
    }, [fetchChallenges]);

    const getDaysLeft = (endDateStr?: string) => {
        if (!endDateStr) return null;
        const end = new Date(endDateStr);
        const now = new Date();
        const diff = end.getTime() - now.getTime();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        return days > 0 ? days : 0;
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="px-6 pt-4 pb-4 border-b border-zinc-100 bg-white">
                <Text className="text-2xl font-bold text-zinc-900">Challenges</Text>
                <Text className="text-zinc-500">Push yourself to the next level</Text>
            </View>

            <ScrollView
                className="flex-1 bg-zinc-50 px-4 pt-6"
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {loading && challenges.length === 0 ? (
                    <Text className="text-zinc-500 text-center">Loading challenges...</Text>
                ) : (
                    <>
                        {/* Active Section */}
                        <View className="mb-6">
                            <Text className="text-lg font-bold text-zinc-800 mb-3 flex-row items-center">
                                Active Challenges
                            </Text>

                            {challenges.length === 0 && (
                                <Text className="text-zinc-400 italic mb-4">No active challenges right now.</Text>
                            )}

                            {challenges.map(challenge => {
                                const progress = challenge.userProgress?.progress || 0;
                                const goal = challenge.targetValue;
                                const percentage = Math.min(100, Math.round((progress / goal) * 100));
                                const completed = progress >= goal;
                                const daysLeft = getDaysLeft(challenge.endDate);

                                return (
                                    <View key={challenge.id} className="bg-white p-4 rounded-2xl mb-4 border border-zinc-100 shadow-sm">
                                        <View className="flex-row items-start gap-4">
                                            <View className={`p-3 rounded-xl ${completed ? 'bg-green-100' : 'bg-orange-100'}`}>
                                                {completed ?
                                                    <Check size={24} color={completed ? '#16a34a' : '#ea580c' as any} /> :
                                                    <Trophy size={24} color="#ea580c" as any />
                                                }
                                            </View>
                                            <View className="flex-1">
                                                <Text className="font-bold text-zinc-900 text-lg">{challenge.title}</Text>
                                                <Text className="text-zinc-500 text-sm mt-1">{challenge.description}</Text>

                                                {!completed && (
                                                    <View className="mt-3">
                                                        <View className="flex-row justify-between mb-1">
                                                            <Text className="text-xs font-bold text-zinc-700">{progress} / {goal}</Text>
                                                            <Text className="text-xs text-orange-600">{percentage}%</Text>
                                                        </View>
                                                        <View className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                                                            <View
                                                                className="h-full bg-orange-500 rounded-full"
                                                                style={{ width: `${percentage}%` }}
                                                            />
                                                        </View>
                                                        {daysLeft !== null && (
                                                            <Text className="text-xs text-zinc-400 mt-2">{daysLeft} days left</Text>
                                                        )}
                                                    </View>
                                                )}

                                                {completed && (
                                                    <View className="mt-3 bg-green-50 px-3 py-2 rounded-lg self-start">
                                                        <Text className="text-green-700 font-bold text-xs uppercase tracking-wide">Completed</Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>

                        {/* Coming Soon Teaser */}
                        <View className="p-6 bg-zinc-900 rounded-2xl mb-8 items-center">
                            <Flame size={32} color={"#fbbf24" as any} style={{ marginBottom: 10 }} />
                            <Text className="text-white font-bold text-xl text-center">More Challenges Coming Soon</Text>
                            <Text className="text-zinc-400 text-center mt-2">Earn points and redeem them for exclusive rewards in the studio shop.</Text>
                        </View>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
