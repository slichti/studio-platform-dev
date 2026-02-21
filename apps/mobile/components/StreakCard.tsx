import { View, Text } from 'react-native';
import { Flame } from 'lucide-react-native';

export default function StreakCard({ streak = 0 }: { streak: number }) {
    return (
        <View className="bg-orange-50 rounded-2xl p-4 flex-row items-center border border-orange-100 mb-6">
            <View className="bg-orange-100 p-3 rounded-full mr-4">
                <Flame stroke="#f97316" size={24} fill="#f97316" />
            </View>
            <View className="flex-1">
                <Text className="text-orange-900 font-bold text-lg">
                    {streak} Day Streak
                </Text>
                <Text className="text-orange-700 text-xs">
                    {streak > 0
                        ? "You're on fire! Keep it up."
                        : "Book a class to start your streak!"}
                </Text>
            </View>
        </View>
    );
}
