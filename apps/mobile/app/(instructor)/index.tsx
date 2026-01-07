import { View, Text } from 'react-native';

export default function InstructorDashboard() {
    return (
        <View className="flex-1 items-center justify-center bg-gray-50">
            <Text className="text-xl font-bold">Instructor Schedule</Text>
            <Text className="text-gray-500 mt-2">Manage your classes here.</Text>
        </View>
    );
}
