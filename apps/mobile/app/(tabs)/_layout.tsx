
import { Tabs } from 'expo-router';
import { Home, Calendar, User, Trophy, CreditCard } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: {
        borderTopWidth: 1,
        borderTopColor: '#f4f4f5', // zinc-100
        height: 85,
        paddingTop: 10,
      },
      tabBarActiveTintColor: '#000000',
      tabBarInactiveTintColor: '#a1a1aa',
      tabBarLabelStyle: {
        fontSize: 12,
        marginBottom: 5,
        fontWeight: '600'
      }
    }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Home size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Schedule',
          tabBarIcon: ({ color }) => <Calendar size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: 'Shop',
          tabBarIcon: ({ color }) => <CreditCard size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <User size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="challenges"
        options={{
          title: 'Challenges',
          tabBarIcon: ({ color }) => <Trophy size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
