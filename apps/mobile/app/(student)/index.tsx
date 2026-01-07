import { View, Text } from 'react-native';

export default function StudentDashboard() {
    return (
        <View className="flex-1 items-center justify-center bg-gray-50">
            <Text className="text-xl font-bold">Student Dashboard</Text>
            <Text className="text-gray-500 mt-2">Your streaks and classes will appear here.</Text>
        </View>
    );
}
