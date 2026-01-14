
import { View, Text, SafeAreaView, TouchableOpacity } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { LogOut, Settings, CreditCard, Bell } from 'lucide-react-native';

export default function ProfileScreen() {
    const { signOut } = useAuth();

    const menuItems = [
        { icon: CreditCard, label: 'Payment Methods' },
        { icon: Bell, label: 'Notifications' },
        { icon: Settings, label: 'App Settings' },
    ];

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="px-6 pt-4 mb-6">
                <Text className="text-2xl font-bold text-zinc-900">Profile</Text>
            </View>

            <View className="flex-1 px-4">
                {/* User Info Card */}
                <View className="bg-zinc-50 p-6 rounded-2xl border border-zinc-100 mb-8 flex-row items-center gap-4">
                    <View className="w-16 h-16 rounded-full bg-zinc-200" />
                    <View>
                        <Text className="text-lg font-bold text-zinc-900">Student Name</Text>
                        <Text className="text-zinc-500">primary@email.com</Text>
                    </View>
                </View>

                {/* Menu */}
                <View className="space-y-2">
                    {menuItems.map((item, index) => (
                        <TouchableOpacity key={index} className="flex-row items-center p-4 bg-white border border-zinc-100 rounded-xl">
                            <item.icon size={20} color="#18181b" className="mr-3" />
                            <Text className="flex-1 font-medium text-zinc-900">{item.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Logout */}
                <TouchableOpacity
                    onPress={() => signOut()}
                    className="flex-row items-center justify-center p-4 mt-auto mb-8 bg-red-50 rounded-xl"
                >
                    <LogOut size={20} color="#ef4444" className="mr-2" />
                    <Text className="font-bold text-red-600">Sign Out</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
