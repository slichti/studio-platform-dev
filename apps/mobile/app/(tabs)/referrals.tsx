import { View, Text, SafeAreaView, TouchableOpacity, Share, ScrollView, ActivityIndicator } from 'react-native';
import { apiRequest } from '../../lib/api';
import { useEffect, useState } from 'react';
import { Copy, Share as ShareIcon, Users, DollarSign, Gift } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useTenant } from '../../context/TenantContext';

export default function ReferralsScreen() {
    const { tenant } = useTenant();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const data = await apiRequest('/referrals/stats');
            setStats(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const referralLink = stats ? `https://${tenant?.slug}.studio.com/join?ref=${stats.code}` : '';

    const handleCopy = async () => {
        await Clipboard.setStringAsync(referralLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Join me at ${tenant?.name}! Use my link to get $20 off: ${referralLink}`,
                url: referralLink, // iOS only
            });
        } catch (error) {
            console.error(error);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center bg-white">
                <ActivityIndicator size="large" color="#000" />
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white">
            <ScrollView className="flex-1" contentContainerClassName="p-6 pb-24">
                <Text className="text-2xl font-bold text-zinc-900 mb-2">Refer & Earn</Text>
                <Text className="text-base text-zinc-500 mb-8">
                    Invite friends to {tenant?.name} and earn rewards.
                </Text>

                {/* Hero Card */}
                <View className="bg-blue-600 rounded-2xl p-6 mb-8 shadow-sm">
                    <View className="flex-row items-center gap-3 mb-4">
                        <Gift color="white" size={32} />
                        <Text className="text-white text-xl font-bold">Give $20, Get $20</Text>
                    </View>
                    <Text className="text-blue-100 text-base mb-6 leading-6">
                        Your friends get $20 off their first pack, and you get $20 in credit when they sign up.
                    </Text>

                    <View className="bg-white/20 rounded-xl p-4 flex-row items-center gap-3 border border-white/30">
                        <Text className="text-white font-mono flex-1 text-base" numberOfLines={1}>
                            {referralLink}
                        </Text>
                        <TouchableOpacity onPress={handleCopy} className="bg-white/20 p-2 rounded-lg">
                            <Copy color="white" size={20} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleShare} className="bg-white p-2 rounded-lg">
                            <ShareIcon color="#2563EB" size={20} />
                        </TouchableOpacity>
                    </View>
                    {copied && <Text className="text-white text-xs mt-2 text-center font-bold">Copied to clipboard!</Text>}
                </View>

                {/* Stats */}
                <View className="flex-row gap-4 mb-8">
                    <View className="flex-1 bg-zinc-50 p-4 rounded-xl border border-zinc-100">
                        <Users color="#71717a" size={20} />
                        <Text className="text-zinc-500 text-xs font-medium mt-2">Referred</Text>
                        <Text className="text-2xl font-bold text-zinc-900">{stats?.stats?.signups || 0}</Text>
                    </View>
                    <View className="flex-1 bg-zinc-50 p-4 rounded-xl border border-zinc-100">
                        <DollarSign color="#71717a" size={20} />
                        <Text className="text-zinc-500 text-xs font-medium mt-2">Earned</Text>
                        <Text className="text-2xl font-bold text-zinc-900">
                            ${(stats?.stats?.earnings / 100).toFixed(0)}
                        </Text>
                    </View>
                </View>

                {/* History */}
                <Text className="text-lg font-bold text-zinc-900 mb-4">History</Text>
                {stats?.history?.length === 0 ? (
                    <View className="py-8 items-center">
                        <Text className="text-zinc-400">No referrals yet.</Text>
                    </View>
                ) : (
                    stats?.history?.map((item: any) => (
                        <View key={item.id} className="flex-row items-center justify-between py-4 border-b border-zinc-100">
                            <View>
                                <Text className="font-medium text-zinc-900">{item.referredUser?.firstName || 'Friend'}</Text>
                                <Text className="text-xs text-zinc-400">{new Date(item.createdAt).toLocaleDateString()}</Text>
                            </View>
                            <View className="items-end">
                                <Text className="font-bold text-zinc-900">${item.amount / 100}</Text>
                                <Text className={`text-xs capitalize ${item.status === 'paid' ? 'text-green-600' : 'text-amber-600'
                                    }`}>{item.status}</Text>
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
