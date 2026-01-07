import { Tabs } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';

export default function InstructorLayout() {
    return (
        <Tabs screenOptions={{ tabBarActiveTintColor: '#dc2626' }}>
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Schedule',
                    tabBarIcon: ({ color }) => <FontAwesome name="list-ul" size={24} color={color} />
                }}
            />
            <Tabs.Screen
                name="scan"
                options={{
                    title: 'Scan',
                    tabBarIcon: ({ color }) => <FontAwesome name="qrcode" size={24} color={color} />
                }}
            />
        </Tabs>
    );
}
