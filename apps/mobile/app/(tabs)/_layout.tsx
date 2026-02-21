
import { Tabs } from 'expo-router';
import { Home, Calendar, User, Trophy, CreditCard } from 'lucide-react-native';

type IconComponent = typeof Home;
const Icon = ({ component: Component, color, size }: { component: IconComponent; color: string; size: number }) => (
  <Component size={size} stroke={color} />
);

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
          tabBarIcon: ({ color }) => <Icon component={Home} size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Schedule',
          tabBarIcon: ({ color }) => <Icon component={Calendar} size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: 'Shop',
          tabBarIcon: ({ color }) => <Icon component={CreditCard} size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Icon component={User} size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="referrals"
        options={{
          title: 'Refer & Earn',
          tabBarIcon: ({ color }) => <Icon component={Trophy} size={24} color={color} />, // Fallback icon or change to Gift if available. Lucide Gift is good.
        }}
      />
      <Tabs.Screen
        name="challenges"
        options={{
          title: 'Challenges',
          tabBarIcon: ({ color }) => <Icon component={Trophy} size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
