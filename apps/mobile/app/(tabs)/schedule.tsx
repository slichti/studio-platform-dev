
import { View, Text, SafeAreaView, ScrollView } from 'react-native';

export default function ScheduleScreen() {
    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="px-6 pt-4 pb-2 border-b border-zinc-100">
                <Text className="text-2xl font-bold text-zinc-900">Schedule</Text>
            </View>
            <ScrollView className="flex-1 px-4 pt-4">
                {/* Helper text until we fetch real classes */}
                <View className="items-center justify-center p-8 bg-zinc-50 rounded-2xl border border-zinc-100 border-dashed">
                    <Text className="text-zinc-400">Loading classes...</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
