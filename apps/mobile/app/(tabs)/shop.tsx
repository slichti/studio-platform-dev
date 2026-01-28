import { View, Text, SafeAreaView } from 'react-native';

export default function ShopScreen() {
    return (
        <SafeAreaView className="flex-1 bg-white items-center justify-center">
            <Text className="text-xl font-bold">Shop</Text>
            <Text className="text-gray-500 mt-2">Buy Credits & Memberships</Text>
        </SafeAreaView>
    );
}
