import { Tabs } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';

export default function StudentLayout() {
    return (
        <Tabs screenOptions={{ tabBarActiveTintColor: '#2563eb' }}>
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ color }) => <FontAwesome name="home" size={24} color={color} />
                }}
            />
            <Tabs.Screen
                name="book"
                options={{
                    title: 'Book',
                    tabBarIcon: ({ color }) => <FontAwesome name="calendar" size={24} color={color} />
                }}
            />
        </Tabs>
    );
}
