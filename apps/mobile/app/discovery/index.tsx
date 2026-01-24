
import { View, Text, TextInput, FlatList, TouchableOpacity, Image, Alert } from 'react-native';
import { useState, useCallback } from 'react';
import { Stack, useRouter } from 'expo-router';
import { Search, MapPin, ArrowRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// We'll need a platform API helper or use fetch directly since apiRequest is tenant-scoped usually
import { API_URL } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

// TODO: Move to lib/api.ts
const platformRequest = async (path: string, token?: string) => {
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_URL}${path}`, { headers });
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
};

export default function DiscoveryScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { token } = useAuth();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async () => {
        if (!query.trim()) return;
        setLoading(true);
        setHasSearched(true);
        try {
            // Public endpoint, no auth strictly needed but good to allow if we filter by user location later
            const data = await platformRequest(`/studios?q=${encodeURIComponent(query)}`);
            setResults(data);
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Failed to search studios");
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = (studio: any) => {
        Alert.alert(
            `Join ${studio.name}?`,
            "This will add you as a member to this studio.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Join",
                    onPress: async () => {
                        try {
                            // Join logic: Need endpoint POST /members (self-register)
                            // or explicit Join endpoint.
                            // For now, let's just navigate to their "public" slug view or mock it.
                            Alert.alert("Coming Soon", "Joining logic to be implemented!");
                        } catch (e) { Alert.alert("Failed to join"); }
                    }
                }
            ]
        );
    };

    return (
        <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
            <Stack.Screen options={{ headerShown: false }} />

            <View className="px-6 pb-4 border-b border-zinc-100">
                <Text className="text-2xl font-bold text-zinc-900 mb-4">Find a Studio</Text>

                <View className="flex-row items-center bg-zinc-100 px-4 py-3 rounded-xl">
                    <Search size={20} color="#71717a" />
                    <TextInput
                        className="flex-1 ml-3 text-base text-zinc-900"
                        placeholder="Search by name or city..."
                        value={query}
                        onChangeText={setQuery}
                        onSubmitEditing={handleSearch}
                        returnKeyType="search"
                        autoCapitalize="none"
                    />
                </View>
            </View>

            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <Text className="text-zinc-500">Searching...</Text>
                </View>
            ) : (
                <FlatList
                    data={results}
                    keyExtractor={item => item.id}
                    contentContainerClassName="p-4"
                    ListEmptyComponent={
                        hasSearched ? (
                            <Text className="text-center text-zinc-500 mt-10">No studios found matching "{query}"</Text>
                        ) : (
                            <View className="items-center justify-center mt-20">
                                <MapPin size={48} color="#e4e4e7" />
                                <Text className="text-zinc-400 mt-4 text-center px-10">
                                    Search for your favorite yoga, pilate, or fitness studio to get started.
                                </Text>
                            </View>
                        )
                    }
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            className="bg-white border border-zinc-100 rounded-xl p-4 mb-3 shadow-sm flex-row items-center"
                            onPress={() => handleJoin(item)}
                        >
                            <View className="w-12 h-12 bg-zinc-100 rounded-full items-center justify-center overflow-hidden mr-4">
                                {item.logoUrl ? (
                                    <Image source={{ uri: item.logoUrl }} className="w-full h-full" />
                                ) : (
                                    <Text className="text-lg font-bold text-zinc-400">{item.name.charAt(0)}</Text>
                                )}
                            </View>
                            <View className="flex-1">
                                <Text className="font-bold text-lg text-zinc-900">{item.name}</Text>
                                <Text className="text-zinc-500 text-xs">studio-platform.com/{item.slug}</Text>
                            </View>
                            <ArrowRight size={20} color="#d4d4d8" />
                        </TouchableOpacity>
                    )}
                />
            )}
        </View>
    );
}
